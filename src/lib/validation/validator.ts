import type { ValidationResult, ValidationSchema, FieldRule } from './schemas.js';
import { formatValidators, businessRules } from './schemas.js';
import { MCPValidationService } from './mcp-integration.js';

// Validation context for more complex rules
export interface ValidationContext {
	isEdit?: boolean;
	existingId?: string;
	relatedData?: Record<string, any>;
	entityType?: string;
	currentStatus?: string;
}

// Error priority levels
export type ErrorPriority = 'server' | 'client' | 'format';
export type ErrorSource = 'mcp' | 'schema' | 'business';

// Validation error with priority and source tracking
export interface ValidationError {
	message: string;
	priority: ErrorPriority;
	source: ErrorSource;
}

// Individual field validation result
export interface FieldValidationResult {
	isValid: boolean;
	errors: string[] | ValidationError[];
	warnings?: string[];
	isValidating?: boolean;
}

// Main validator class
export class FormValidator {
	private schema: ValidationSchema;
	private context?: ValidationContext;
	private mcpService: MCPValidationService;

	constructor(schema: ValidationSchema, context?: ValidationContext) {
		this.schema = schema;
		this.context = context;
		this.mcpService = new MCPValidationService();
	}

	/**
	 * Validate a single field value
	 */
	async validateField(
		fieldName: string,
		value: any,
		formData?: Record<string, any>
	): Promise<FieldValidationResult> {
		const rule = this.schema[fieldName];
		if (!rule) {
			return { isValid: true, errors: [] };
		}

		const errors: string[] = [];
		const warnings: string[] = [];
		let isValidating = false;

		// Required validation
		if (rule.required && this.isEmpty(value)) {
			errors.push(`${this.formatFieldName(fieldName)} is required`);
			return { isValid: false, errors, warnings };
		}

		// Skip other validations if field is empty and not required
		if (this.isEmpty(value) && !rule.required) {
			return { isValid: true, errors: [], warnings };
		}

		// String length validations
		if (typeof value === 'string') {
			if (rule.minLength && value.length < rule.minLength) {
				errors.push(
					`${this.formatFieldName(fieldName)} must be at least ${rule.minLength} characters`
				);
			}

			if (rule.maxLength && value.length > rule.maxLength) {
				errors.push(
					`${this.formatFieldName(fieldName)} must be no more than ${rule.maxLength} characters`
				);
			}
		}

		// Pattern validation
		if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
			errors.push(`${this.formatFieldName(fieldName)} format is invalid`);
		}

		// Email validation
		if (rule.email && typeof value === 'string' && !formatValidators.email(value)) {
			errors.push(`${this.formatFieldName(fieldName)} must be a valid email address`);
		}

		// Custom validation
		if (rule.custom) {
			const customError = rule.custom(value, formData || {});
			if (customError) {
				errors.push(customError);
			}
		}

		// Business rule validation (async)
		if (rule.businessRule) {
			try {
				const businessError = await rule.businessRule(value, formData || {});
				if (businessError) {
					errors.push(businessError);
				}
			} catch (error) {
				warnings.push(`Could not validate business rule for ${this.formatFieldName(fieldName)}`);
			}
		}

		// MCP real-time validation layer
		try {
			isValidating = true;
			const mcpError = await this.mcpService.validateWithMCP(fieldName, value, this.context || {});
			isValidating = false;
			if (mcpError) {
				errors.push(mcpError);
			}
		} catch (error) {
			isValidating = false;
			warnings.push(
				`Could not complete real-time validation for ${this.formatFieldName(fieldName)}`
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings: warnings.length > 0 ? warnings : undefined,
			isValidating
		};
	}

	/**
	 * Validate field with loading states for UX - returns immediately with isValidating=true if MCP validation is needed
	 */
	async validateFieldWithLoadingState(
		fieldName: string,
		value: any,
		formData?: Record<string, any>
	): Promise<FieldValidationResult> {
		const rule = this.schema[fieldName];
		if (!rule) {
			return { isValid: true, errors: [] };
		}

		const errors: string[] = [];
		const warnings: string[] = [];

		// Quick synchronous validations first
		if (rule.required && this.isEmpty(value)) {
			errors.push(`${this.formatFieldName(fieldName)} is required`);
			return { isValid: false, errors, warnings };
		}

		if (this.isEmpty(value) && !rule.required) {
			return { isValid: true, errors: [], warnings };
		}

		// Synchronous string length validations
		if (typeof value === 'string') {
			if (rule.minLength && value.length < rule.minLength) {
				errors.push(
					`${this.formatFieldName(fieldName)} must be at least ${rule.minLength} characters`
				);
			}
			if (rule.maxLength && value.length > rule.maxLength) {
				errors.push(
					`${this.formatFieldName(fieldName)} must be no more than ${rule.maxLength} characters`
				);
			}
		}

		// Format validations
		if (rule.format && formatValidators[rule.format]) {
			const formatError = formatValidators[rule.format](value);
			if (formatError) {
				errors.push(formatError);
			}
		}

		// If we have sync errors, return immediately
		if (errors.length > 0) {
			return { isValid: false, errors, warnings };
		}

		// Check if we need async MCP validation
		const needsMCPValidation = ['title', 'requirement_ids', 'status'].includes(fieldName);
		if (needsMCPValidation) {
			// Return loading state immediately, then perform async validation
			return { isValid: true, errors: [], warnings: [], isValidating: true };
		}

		return { isValid: true, errors: [], warnings };
	}

	/**
	 * Prioritize and format validation errors
	 */
	private prioritizeErrors(errors: ValidationError[]): string[] {
		// Sort by priority: server > business > client > format
		const priorityOrder: Record<ErrorPriority, number> = {
			server: 0,
			client: 1,
			format: 2
		};

		const sorted = errors.sort((a, b) => {
			const aPriority = priorityOrder[a.priority] ?? 999;
			const bPriority = priorityOrder[b.priority] ?? 999;
			return aPriority - bPriority;
		});

		// Remove duplicates and return messages
		const seen = new Set<string>();
		return sorted
			.filter((error) => {
				if (seen.has(error.message)) return false;
				seen.add(error.message);
				return true;
			})
			.map((error) => error.message);
	}

	/**
	 * Validate entire form data
	 */
	async validateForm(formData: Record<string, any>): Promise<ValidationResult> {
		const errors: Record<string, string[]> = {};
		const warnings: Record<string, string[]> = {};
		let isValid = true;

		// Validate each field in the schema
		for (const [fieldName, rule] of Object.entries(this.schema)) {
			const fieldResult = await this.validateField(fieldName, formData[fieldName], formData);

			if (!fieldResult.isValid) {
				errors[fieldName] = fieldResult.errors;
				isValid = false;
			}

			if (fieldResult.warnings && fieldResult.warnings.length > 0) {
				warnings[fieldName] = fieldResult.warnings;
			}
		}

		return {
			isValid,
			errors,
			warnings: Object.keys(warnings).length > 0 ? warnings : undefined
		};
	}

	/**
	 * Validate form with business rules (e.g., duplicate checking)
	 */
	async validateWithBusinessRules(formData: Record<string, any>): Promise<ValidationResult> {
		const basicValidation = await this.validateForm(formData);

		if (!basicValidation.isValid) {
			return basicValidation;
		}

		// Additional business rule validations can be added here
		// For example, duplicate title checking would happen here

		return basicValidation;
	}

	/**
	 * Get required fields from schema
	 */
	getRequiredFields(): string[] {
		return Object.entries(this.schema)
			.filter(([_, rule]) => rule.required)
			.map(([fieldName, _]) => fieldName);
	}

	/**
	 * Get all field names from schema
	 */
	getAllFields(): string[] {
		return Object.keys(this.schema);
	}

	/**
	 * Get MCP validation cache statistics
	 */
	getCacheStats(): { size: number; hitRate?: number } {
		return this.mcpService.getCacheStats();
	}

	/**
	 * Clear MCP validation cache
	 */
	clearCache(): void {
		this.mcpService.clearCache();
	}

	/**
	 * Check if a value is considered empty
	 */
	private isEmpty(value: any): boolean {
		if (value === null || value === undefined) return true;
		if (typeof value === 'string') return value.trim() === '';
		if (Array.isArray(value)) return value.length === 0;
		if (typeof value === 'object') return Object.keys(value).length === 0;
		return false;
	}

	/**
	 * Format field name for display in error messages
	 */
	private formatFieldName(fieldName: string): string {
		return fieldName
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
}

// Debounced validation for real-time field validation
export class DebouncedValidator {
	private validator: FormValidator;
	private debounceTimeout: number | null = null;
	private debounceDelay: number;

	constructor(validator: FormValidator, debounceDelay: number = 300) {
		this.validator = validator;
		this.debounceDelay = debounceDelay;
	}

	/**
	 * Validate field with debouncing
	 */
	validateFieldDebounced(
		fieldName: string,
		value: any,
		formData: Record<string, any>,
		callback: (result: FieldValidationResult) => void
	): void {
		// Clear existing timeout
		if (this.debounceTimeout !== null) {
			clearTimeout(this.debounceTimeout);
		}

		// Set new timeout
		this.debounceTimeout = setTimeout(async () => {
			try {
				const result = await this.validator.validateField(fieldName, value, formData);
				callback(result);
			} catch (error) {
				callback({
					isValid: false,
					errors: ['Validation error occurred'],
					warnings: ['Could not complete validation']
				});
			}
		}, this.debounceDelay);
	}

	/**
	 * Cancel any pending validation
	 */
	cancel(): void {
		if (this.debounceTimeout !== null) {
			clearTimeout(this.debounceTimeout);
			this.debounceTimeout = null;
		}
	}
}

// Utility functions for common validation scenarios
export const validationUtils = {
	/**
	 * Create validator for requirements
	 */
	createRequirementValidator: (context?: ValidationContext) => {
		// Import is done dynamically to avoid circular dependency
		return import('./schemas.js').then(
			({ requirementSchema }) => new FormValidator(requirementSchema, context)
		);
	},

	/**
	 * Create validator for tasks
	 */
	createTaskValidator: (context?: ValidationContext) => {
		return import('./schemas.js').then(({ taskSchema }) => new FormValidator(taskSchema, context));
	},

	/**
	 * Create validator for architecture decisions
	 */
	createArchitectureValidator: (context?: ValidationContext) => {
		return import('./schemas.js').then(
			({ architectureSchema }) => new FormValidator(architectureSchema, context)
		);
	},

	/**
	 * Validate requirement status transition
	 */
	validateStatusTransition: businessRules.validateStatusProgression,

	/**
	 * Validate task creation eligibility
	 */
	validateTaskCreation: businessRules.validateTaskCreationForRequirement
};
