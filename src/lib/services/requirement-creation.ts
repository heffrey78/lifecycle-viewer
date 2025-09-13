// Service layer for requirement creation with MCP integration
// Handles data transformation, error handling, and retry logic

import { mcpClient } from './lifecycle-mcp-client.js';
import type { 
	RequirementFormData, 
	CreateRequirementParams,
	Requirement,
	MCPResponse
} from '$lib/types/lifecycle.js';

export interface RequirementCreationResult {
	success: boolean;
	data?: Requirement;
	error?: string;
	isRetryable?: boolean;
}

export interface RequirementCreationOptions {
	retries?: number;
	timeout?: number;
	optimistic?: boolean;
}

export class RequirementCreationService {
	private readonly defaultOptions: Required<RequirementCreationOptions> = {
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
		
		return input
			.trim()
			// Remove script tags and other dangerous elements
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
			.replace(/javascript:/gi, '')
			.replace(/on\w+\s*=/gi, '')
			// Limit length to prevent DOS attacks
			.substring(0, 10000);
	}

	/**
	 * Transform form data to MCP create_requirement parameters
	 */
	private transformFormData(formData: RequirementFormData): CreateRequirementParams {
		// Clean up acceptance criteria - remove empty strings and sanitize
		const cleanAcceptanceCriteria = formData.acceptance_criteria
			?.map(criteria => this.sanitizeInput(criteria))
			.filter(criteria => criteria !== '') || [];

		// Clean up functional requirements - remove empty strings and sanitize
		const cleanFunctionalRequirements = formData.functional_requirements
			?.map(req => this.sanitizeInput(req))
			.filter(req => req !== '') || [];

		return {
			type: formData.type,
			title: this.sanitizeInput(formData.title),
			priority: formData.priority,
			current_state: this.sanitizeInput(formData.current_state),
			desired_state: this.sanitizeInput(formData.desired_state),
			business_value: formData.business_value ? this.sanitizeInput(formData.business_value) : undefined,
			risk_level: formData.risk_level,
			functional_requirements: cleanFunctionalRequirements.length > 0 ? cleanFunctionalRequirements : undefined,
			acceptance_criteria: cleanAcceptanceCriteria,
			author: formData.author ? this.sanitizeInput(formData.author) : 'System'
		};
	}

	/**
	 * Validate form data before submission
	 */
	private validateFormData(formData: RequirementFormData): string[] {
		const errors: string[] = [];

		// Required fields
		if (!formData.title?.trim()) {
			errors.push('Title is required');
		}

		if (!formData.current_state?.trim()) {
			errors.push('Current state is required');
		}

		if (!formData.desired_state?.trim()) {
			errors.push('Desired state is required');
		}

		// Acceptance criteria validation
		const validCriteria = formData.acceptance_criteria?.filter(
			(criteria) => criteria.trim() !== ''
		) || [];

		if (validCriteria.length === 0) {
			errors.push('At least one acceptance criterion is required');
		}

		// Type-specific validations
		if (formData.type === 'BUS' && !formData.business_value?.trim()) {
			errors.push('Business value is required for business requirements');
		}

		// Title length validation
		if (formData.title?.length > 100) {
			errors.push('Title must be 100 characters or less');
		}

		return errors;
	}

	/**
	 * Determine if an error is retryable
	 */
	private isRetryableError(error: any): boolean {
		if (typeof error === 'object' && error.code) {
			// JSON-RPC error codes - server errors are retryable
			if (error.code >= -32099 && error.code <= -32000) return true;
			if (error.code === -32603) return true; // Internal error
			if (error.code === -32000) return true; // Generic server error
			
			// Client errors are not retryable
			if (error.code === -32602) return false; // Invalid params
			if (error.code === -32601) return false; // Method not found
		}

		// WebSocket/Network errors are typically retryable
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes('websocket connection failed')) return true;
			if (message.includes('network')) return true;
			if (message.includes('timeout') || message.includes('timed out')) return true;
			if (message.includes('connection')) return true;
		}

		// Default to not retryable for unknown errors
		return false;
	}

	/**
	 * Get user-friendly error message
	 */
	private getUserFriendlyError(error: any): string {
		if (typeof error === 'string') {
			return error;
		}

		if (typeof error === 'object' && error.message) {
			// Handle common MCP errors
			const message = error.message.toLowerCase();
			
			if (message.includes('duplicate') || message.includes('already exists') || message.includes('unique constraint failed')) {
				return 'A requirement with this title already exists. Please use a different title.';
			}
			
			if (message.includes('validation') || message.includes('invalid')) {
				return 'The provided data is invalid. Please check your inputs and try again.';
			}
			
			if (message.includes('permission') || message.includes('authorized')) {
				return 'You do not have permission to create requirements.';
			}
			
			if (message.includes('connection') || message.includes('network')) {
				return 'Connection to the server failed. Please check your network connection.';
			}
			
			if (message.includes('timeout')) {
				return 'The operation timed out. Please try again.';
			}
			
			return error.message;
		}

		return 'An unexpected error occurred while creating the requirement.';
	}

	/**
	 * Sleep for specified milliseconds (for retry delays)
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Check MCP connection status
	 */
	async checkConnection(): Promise<boolean> {
		try {
			if (!mcpClient.isConnected()) {
				await mcpClient.connect();
			}
			return mcpClient.isConnected();
		} catch {
			return false;
		}
	}

	/**
	 * Disable rate limiting (for testing purposes)
	 */
	disableRateLimiting(): void {
		this.rateLimitingEnabled = false;
	}

	/**
	 * Enable rate limiting
	 */
	enableRateLimiting(): void {
		this.rateLimitingEnabled = true;
	}

	/**
	 * Create requirement with retry logic and error handling
	 */
	async createRequirement(
		formData: RequirementFormData,
		options: RequirementCreationOptions = {}
	): Promise<RequirementCreationResult> {
		const opts = { ...this.defaultOptions, ...options };

		// Rate limiting check (can be disabled for testing)
		if (this.rateLimitingEnabled) {
			const now = Date.now();
			if (now - this.lastSubmission < this.minInterval) {
				return {
					success: false,
					error: 'Please wait before submitting again. Rate limit exceeded.',
					isRetryable: true
				};
			}
			this.lastSubmission = now;
		}

		// Validate form data first
		const validationErrors = this.validateFormData(formData);
		if (validationErrors.length > 0) {
			return {
				success: false,
				error: validationErrors.join('; '),
				isRetryable: false
			};
		}

		// Check connection status
		const isConnected = await this.checkConnection();
		if (!isConnected) {
			return {
				success: false,
				error: 'Unable to connect to the server. Please check your connection and try again.',
				isRetryable: true
			};
		}

		// Transform form data to MCP parameters
		const mcpParams = this.transformFormData(formData);

		// Attempt creation with retry logic
		let lastError: any = null;
		const maxAttempts = Math.min(opts.retries + 1, 10); // Hard limit to prevent infinite loops
		
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			let timeoutId: NodeJS.Timeout | null = null;
			
			try {
				// Set a timeout for the operation with proper cleanup
				const timeoutPromise = new Promise<never>((_, reject) => {
					timeoutId = setTimeout(() => reject(new Error('Operation timed out')), opts.timeout);
				});

				const createPromise = mcpClient.requirements.createRequirement(mcpParams);
				const response = await Promise.race([createPromise, timeoutPromise]) as MCPResponse<Requirement>;

				// Clear timeout on success
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}

				if (response.success && response.data) {
					return {
						success: true,
						data: response.data
					};
				} else {
					throw new Error(response.error || 'Failed to create requirement');
				}

			} catch (error) {
				// Clear timeout on error
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
				
				lastError = error;
				
				// If this is the last attempt or error is not retryable, don't retry
				if (attempt >= maxAttempts - 1 || !this.isRetryableError(error)) {
					break;
				}

				// Wait before retrying (exponential backoff with jitter)
				const baseDelay = Math.min(1000 * Math.pow(2, attempt), 5000);
				const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
				await this.sleep(baseDelay + jitter);
			}
		}

		// If we get here, all attempts failed
		return {
			success: false,
			error: this.getUserFriendlyError(lastError),
			isRetryable: this.isRetryableError(lastError)
		};
	}

	/**
	 * Create requirement with optimistic UI updates
	 */
	async createRequirementOptimistic(
		formData: RequirementFormData,
		options: RequirementCreationOptions = {}
	): Promise<RequirementCreationResult> {
		const opts = { ...this.defaultOptions, ...options, optimistic: true };
		
		// For optimistic updates, we could return a temporary requirement
		// and then update it when the actual response comes back
		// For now, we'll just use the regular creation flow
		return this.createRequirement(formData, opts);
	}
}

// Export singleton instance
export const requirementCreationService = new RequirementCreationService();