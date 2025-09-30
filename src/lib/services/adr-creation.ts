// Service layer for ADR creation with MCP integration
// Handles data transformation, error handling, and retry logic

import { mcpClient } from './lifecycle-mcp-client.js';
import type {
	ADRFormData,
	ArchitectureDecision,
	Requirement,
	MCPResponse
} from '$lib/types/lifecycle.js';

export interface ADRCreationResult {
	success: boolean;
	data?: ArchitectureDecision;
	error?: string;
	isRetryable?: boolean;
}

export interface ADRCreationOptions {
	retries?: number;
	timeout?: number;
	optimistic?: boolean;
}

export class ADRCreationService {
	private readonly defaultOptions: Required<ADRCreationOptions> = {
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
	private transformFormData(formData: ADRFormData): any {
		// Basic validation
		if (!formData.title?.trim()) {
			throw new Error('ADR title is required');
		}

		if (!formData.context?.trim()) {
			throw new Error('Context is required');
		}

		if (!formData.decision_outcome?.trim()) {
			throw new Error('Decision outcome is required');
		}

		if (!formData.authors || formData.authors.length === 0) {
			throw new Error('At least one author is required');
		}

		if (!formData.requirement_ids || formData.requirement_ids.length === 0) {
			throw new Error('At least one requirement must be linked');
		}

		// Validate authors are valid emails
		for (const author of formData.authors) {
			if (author && !this.isValidEmail(author)) {
				throw new Error(`Invalid email format: ${author}`);
			}
		}

		// Validate considered options (minimum 2 for ADR)
		const validOptions = formData.considered_options?.filter((option) => option.trim()) || [];
		if (validOptions.length < 2) {
			throw new Error('At least 2 considered options are required for ADR');
		}

		// Transform and sanitize data
		const params: any = {
			requirement_ids: formData.requirement_ids,
			title: this.sanitizeInput(formData.title),
			type: formData.type,
			context: this.sanitizeInput(formData.context),
			decision: this.sanitizeInput(formData.decision_outcome),
			authors: formData.authors.filter((author) => author.trim()).map((author) => author.trim()),
			decision_drivers: formData.decision_drivers?.length
				? this.sanitizeArray(formData.decision_drivers)
				: undefined,
			considered_options: formData.considered_options?.length
				? this.sanitizeArray(formData.considered_options)
				: undefined,
			consequences: formData.consequences
				? {
						good: formData.consequences.good?.length
							? this.sanitizeArray(formData.consequences.good)
							: undefined,
						bad: formData.consequences.bad?.length
							? this.sanitizeArray(formData.consequences.bad)
							: undefined,
						neutral: formData.consequences.neutral?.length
							? this.sanitizeArray(formData.consequences.neutral)
							: undefined
					}
				: undefined
		};

		// Remove undefined values
		Object.keys(params).forEach((key) => {
			if (params[key] === undefined) {
				delete params[key];
			}
		});

		// Clean up consequences object if all sub-arrays are undefined
		if (
			params.consequences &&
			!params.consequences.good &&
			!params.consequences.bad &&
			!params.consequences.neutral
		) {
			delete params.consequences;
		}

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
	 * Get approved requirements that can have ADRs created for them
	 */
	async getApprovedRequirements(): Promise<MCPResponse<Requirement[]>> {
		try {
			// Connect if not already connected
			if (!(await mcpClient.isConnected())) {
				await mcpClient.connect();
			}

			// Get all requirements first, then filter client-side
			const response = await mcpClient.requirements.getRequirementsJson();

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
	 * Create a new ADR with error handling and retry logic
	 */
	async createADR(
		formData: ADRFormData,
		options: ADRCreationOptions = {}
	): Promise<ADRCreationResult> {
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
				const createPromise = mcpClient.architecture.createArchitectureDecision(params);
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
					throw new Error(response.error || 'ADR creation failed');
				}
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');

				// Don't retry on validation errors or client-side errors
				if (
					lastError.message.includes('validation') ||
					lastError.message.includes('required') ||
					lastError.message.includes('invalid') ||
					lastError.message.includes('email') ||
					lastError.message.includes('minimum') ||
					lastError.message.includes('format')
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
			!lastError.message.includes('email') &&
			!lastError.message.includes('minimum') &&
			!lastError.message.includes('format');

		return {
			success: false,
			error: lastError?.message || 'ADR creation failed',
			isRetryable: Boolean(isRetryable)
		};
	}

	/**
	 * Validate ADR form data without creating
	 */
	async validateFormData(formData: ADRFormData): Promise<{ isValid: boolean; errors: string[] }> {
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

		if (formData.context && formData.context.length > 5000) {
			errors.push('Context must be 5000 characters or less');
		}

		if (formData.decision_outcome && formData.decision_outcome.length > 3000) {
			errors.push('Decision outcome must be 3000 characters or less');
		}

		if (formData.authors && formData.authors.length > 10) {
			errors.push('Maximum 10 authors allowed');
		}

		if (formData.decision_drivers && formData.decision_drivers.length > 20) {
			errors.push('Maximum 20 decision drivers allowed');
		}

		if (formData.considered_options && formData.considered_options.length > 10) {
			errors.push('Maximum 10 considered options allowed');
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
export const adrCreationService = new ADRCreationService();
