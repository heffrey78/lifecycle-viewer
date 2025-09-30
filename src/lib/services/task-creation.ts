// Service layer for task creation with MCP integration
// Handles data transformation, error handling, and retry logic

import { mcpClient } from './mcp-client.js';
import type { TaskFormData, Task, Requirement, MCPResponse } from '$lib/types/lifecycle.js';

export interface TaskCreationResult {
	success: boolean;
	data?: Task;
	error?: string;
	isRetryable?: boolean;
}

export interface TaskCreationOptions {
	retries?: number;
	timeout?: number;
	optimistic?: boolean;
}

export class TaskCreationService {
	private readonly defaultOptions: Required<TaskCreationOptions> = {
		retries: 3,
		timeout: 10000, // 10 seconds
		optimistic: false
	};

	// Rate limiting
	private lastSubmission = 0;
	private readonly minInterval = 1000; // 1 second between submissions
	private rateLimitingEnabled = true;

	/**
	 * Sanitize input string to prevent security issues
	 */
	private sanitizeInput(input: string): string {
		if (!input) return '';

		return (
			input
				.trim()
				// Remove script tags and other dangerous elements
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
				.replace(/javascript:/gi, '')
				.replace(/on\w+\s*=/gi, '')
				// Limit length for safety
				.slice(0, 10000)
		);
	}

	/**
	 * Sanitize array of strings
	 */
	private sanitizeArray(arr: string[]): string[] {
		if (!Array.isArray(arr)) return [];
		return arr.map((item) => this.sanitizeInput(item)).filter((item) => item.length > 0);
	}

	/**
	 * Validate email format
	 */
	private isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	/**
	 * Transform form data to MCP parameters with validation and sanitization
	 */
	private transformFormData(formData: TaskFormData): any {
		// Basic validation
		if (!formData.title?.trim()) {
			throw new Error('Task title is required');
		}

		if (!formData.requirement_ids || formData.requirement_ids.length === 0) {
			throw new Error('At least one requirement must be linked');
		}

		if (formData.assignee && !this.isValidEmail(formData.assignee)) {
			throw new Error('Assignee must be a valid email address');
		}

		// Transform and sanitize data
		const params: any = {
			requirement_ids: formData.requirement_ids,
			title: this.sanitizeInput(formData.title),
			priority: formData.priority,
			effort: formData.effort,
			user_story: formData.user_story ? this.sanitizeInput(formData.user_story) : undefined,
			acceptance_criteria: formData.acceptance_criteria?.length
				? this.sanitizeArray(formData.acceptance_criteria)
				: undefined,
			assignee: formData.assignee ? this.sanitizeInput(formData.assignee) : undefined,
			parent_task_id: formData.parent_task_id || undefined
		};

		// Remove undefined values
		Object.keys(params).forEach((key) => {
			if (params[key] === undefined) {
				delete params[key];
			}
		});

		return params;
	}

	/**
	 * Check connection to MCP server
	 */
	async checkConnection(): Promise<boolean> {
		try {
			// If not connected, try to connect first
			if (!(await mcpClient.isConnected())) {
				await mcpClient.connect();
			}
			return await mcpClient.isConnected();
		} catch (error) {
			console.error('Connection check failed:', error);
			return false;
		}
	}

	/**
	 * Get approved requirements that can have tasks created for them
	 */
	async getApprovedRequirements(): Promise<MCPResponse<Requirement[]>> {
		try {
			// Connect if not already connected
			if (!(await mcpClient.isConnected())) {
				await mcpClient.connect();
			}

			// Get all requirements first, then filter client-side
			// This is a workaround for the MCP server validation issue with status arrays
			const response = await mcpClient.getRequirementsJson();

			if (response.success && response.data) {
				// Filter for approved statuses client-side
				const approvedStatuses = ['Approved', 'Architecture', 'Ready', 'Implemented', 'Validated'];
				const filteredRequirements = response.data.filter((req) =>
					approvedStatuses.includes(req.status)
				);

				return {
					success: true,
					data: filteredRequirements
				};
			}

			return response;
		} catch (error) {
			console.error('Failed to get approved requirements:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to load requirements'
			};
		}
	}

	/**
	 * Get all tasks for parent task selection
	 */
	async getAllTasks(): Promise<MCPResponse<Task[]>> {
		try {
			// Connect if not already connected
			if (!(await mcpClient.isConnected())) {
				await mcpClient.connect();
			}

			const response = await mcpClient.getTasksJson();
			return response;
		} catch (error) {
			console.error('Failed to get tasks:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to load tasks'
			};
		}
	}

	/**
	 * Create a new task with error handling and retry logic
	 */
	async createTask(
		formData: TaskFormData,
		options: TaskCreationOptions = {}
	): Promise<TaskCreationResult> {
		const opts = { ...this.defaultOptions, ...options };

		// Rate limiting check
		if (this.rateLimitingEnabled) {
			const now = Date.now();
			if (now - this.lastSubmission < this.minInterval) {
				const waitTime = this.minInterval - (now - this.lastSubmission);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
			}
			this.lastSubmission = Date.now();
		}

		let lastError: Error | null = null;
		const maxAttempts = opts.retries + 1;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				// Transform and validate form data
				const params = this.transformFormData(formData);

				// Connect if not already connected
				if (!(await mcpClient.isConnected())) {
					await mcpClient.connect();
				}

				// Create promise with timeout
				const createPromise = mcpClient.createTask(params);
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Request timeout')), opts.timeout)
				);

				const response = await Promise.race([createPromise, timeoutPromise]);

				if (response.success && response.data) {
					return {
						success: true,
						data: response.data
					};
				} else {
					throw new Error(response.error || 'Task creation failed');
				}
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');

				// Don't retry on validation errors or client-side errors
				if (
					lastError.message.includes('validation') ||
					lastError.message.includes('required') ||
					lastError.message.includes('invalid') ||
					lastError.message.includes('email')
				) {
					break;
				}

				// Wait before retry (exponential backoff)
				if (attempt < maxAttempts) {
					const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		// Determine if error is retryable
		const isRetryable =
			lastError &&
			!lastError.message.includes('validation') &&
			!lastError.message.includes('required') &&
			!lastError.message.includes('invalid') &&
			!lastError.message.includes('email');

		return {
			success: false,
			error: lastError?.message || 'Task creation failed',
			isRetryable: Boolean(isRetryable)
		};
	}

	/**
	 * Validate task form data without creating
	 */
	async validateFormData(formData: TaskFormData): Promise<{ isValid: boolean; errors: string[] }> {
		const errors: string[] = [];

		try {
			this.transformFormData(formData);
		} catch (error) {
			if (error instanceof Error) {
				errors.push(error.message);
			}
		}

		// Additional business logic validation
		if (formData.title && formData.title.length > 200) {
			errors.push('Title must be 200 characters or less');
		}

		if (formData.user_story && formData.user_story.length > 2000) {
			errors.push('User story must be 2000 characters or less');
		}

		if (formData.acceptance_criteria && formData.acceptance_criteria.length > 20) {
			errors.push('Maximum 20 acceptance criteria allowed');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Enable or disable rate limiting (for testing)
	 */
	setRateLimitingEnabled(enabled: boolean): void {
		this.rateLimitingEnabled = enabled;
	}

	/**
	 * Reset rate limiting counter
	 */
	resetRateLimit(): void {
		this.lastSubmission = 0;
	}
}

// Export singleton instance
export const taskCreationService = new TaskCreationService();
