import type {
	RequirementType,
	RequirementStatus,
	Priority,
	RiskLevel,
	ArchitectureReview,
	TaskStatus,
	EffortSize,
	ArchitectureType,
	ArchitectureStatus
} from '$lib/types/lifecycle.js';

// Base validation result interface
export interface ValidationResult {
	isValid: boolean;
	errors: Record<string, string[]>;
	warnings?: Record<string, string[]>;
}

// Field validation rule interface
export interface FieldRule {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	pattern?: RegExp;
	email?: boolean;
	custom?: (value: any, formData: any) => string | null;
	businessRule?: (value: any, formData: any) => Promise<string | null>;
}

// Schema definition interface
export interface ValidationSchema {
	[fieldName: string]: FieldRule;
}

// Requirement validation schema
export const requirementSchema: ValidationSchema = {
	title: {
		required: true,
		minLength: 3,
		maxLength: 200,
		custom: (value: string) => {
			if (value && value.trim() !== value) {
				return 'Title should not have leading/trailing whitespace';
			}
			return null;
		}
	},
	type: {
		required: true,
		custom: (value: RequirementType) => {
			const validTypes: RequirementType[] = ['FUNC', 'NFUNC', 'TECH', 'BUS', 'INTF'];
			if (value && !validTypes.includes(value)) {
				return 'Invalid requirement type';
			}
			return null;
		}
	},
	priority: {
		required: true,
		custom: (value: Priority) => {
			const validPriorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
			if (value && !validPriorities.includes(value)) {
				return 'Invalid priority level';
			}
			return null;
		}
	},
	risk_level: {
		required: false,
		custom: (value: RiskLevel) => {
			if (value) {
				const validRiskLevels: RiskLevel[] = ['High', 'Medium', 'Low'];
				if (!validRiskLevels.includes(value)) {
					return 'Invalid risk level';
				}
			}
			return null;
		}
	},
	current_state: {
		required: true,
		minLength: 10,
		maxLength: 2000
	},
	desired_state: {
		required: true,
		minLength: 10,
		maxLength: 2000
	},
	business_value: {
		required: false,
		maxLength: 1000
	},
	author: {
		required: true,
		minLength: 2,
		maxLength: 100,
		email: true
	},
	functional_requirements: {
		required: false,
		custom: (value: string[]) => {
			if (value && Array.isArray(value)) {
				for (const req of value) {
					if (typeof req !== 'string' || req.length < 5) {
						return 'Each functional requirement must be at least 5 characters';
					}
				}
			}
			return null;
		}
	},
	acceptance_criteria: {
		required: false,
		custom: (value: string[]) => {
			if (value && Array.isArray(value)) {
				for (const criteria of value) {
					if (typeof criteria !== 'string' || criteria.length < 10) {
						return 'Each acceptance criterion must be at least 10 characters';
					}
				}
			}
			return null;
		}
	}
};

// Task validation schema
export const taskSchema: ValidationSchema = {
	title: {
		required: true,
		minLength: 3,
		maxLength: 200,
		custom: (value: string) => {
			if (value && value.trim() !== value) {
				return 'Title should not have leading/trailing whitespace';
			}
			return null;
		}
	},
	priority: {
		required: true,
		custom: (value: Priority) => {
			const validPriorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
			if (value && !validPriorities.includes(value)) {
				return 'Invalid priority level';
			}
			return null;
		}
	},
	effort: {
		required: false,
		custom: (value: EffortSize) => {
			if (value) {
				const validEfforts: EffortSize[] = ['XS', 'S', 'M', 'L', 'XL'];
				if (!validEfforts.includes(value)) {
					return 'Invalid effort size';
				}
			}
			return null;
		}
	},
	user_story: {
		required: false,
		minLength: 10,
		maxLength: 1000,
		custom: (value: string) => {
			if (value && !value.match(/^As a .+, I want .+, so that .+$/i)) {
				return 'User story should follow format: "As a [user], I want [goal], so that [benefit]"';
			}
			return null;
		}
	},
	assignee: {
		required: false,
		email: true
	},
	acceptance_criteria: {
		required: false,
		custom: (value: string[]) => {
			if (value && Array.isArray(value)) {
				// Filter out empty strings to allow for user interaction
				const nonEmptyCriteria = value.filter(criteria => criteria && criteria.trim() !== '');
				for (const criteria of nonEmptyCriteria) {
					if (typeof criteria !== 'string' || criteria.trim().length < 5) {
						return 'Each acceptance criterion must be at least 5 characters';
					}
				}
			}
			return null;
		}
	},
	requirement_ids: {
		required: true,
		custom: (value: string[]) => {
			if (!Array.isArray(value) || value.length === 0) {
				return 'At least one requirement must be selected';
			}
			for (const id of value) {
				if (!id.match(/^REQ-\d{4}-[A-Z]{2,5}-\d{2}$/)) {
					return 'Invalid requirement ID format (expected: REQ-XXXX-TYPE-XX)';
				}
			}
			return null;
		}
	},
	parent_task_id: {
		required: false,
		custom: (value: string | undefined) => {
			// Empty string, undefined, or null is valid (no parent task)
			if (!value || value === '' || value === undefined || value === null) {
				return null;
			}
			// If a value is provided, it should be a valid task ID format
			if (!value.match(/^TASK-\d{4}-\d{2}-\d{2}$/)) {
				return 'Invalid task ID format (expected: TASK-XXXX-XX-XX)';
			}
			return null;
		}
	}
};

// Architecture Decision validation schema
export const architectureSchema: ValidationSchema = {
	title: {
		required: true,
		minLength: 5,
		maxLength: 200,
		custom: (value: string) => {
			if (value && value.trim() !== value) {
				return 'Title should not have leading/trailing whitespace';
			}
			return null;
		}
	},
	type: {
		required: true,
		custom: (value: ArchitectureType) => {
			const validTypes: ArchitectureType[] = ['ADR', 'TDD', 'INTG'];
			if (value && !validTypes.includes(value)) {
				return 'Invalid architecture type';
			}
			return null;
		}
	},
	context: {
		required: true,
		minLength: 20,
		maxLength: 5000
	},
	decision_outcome: {
		required: true,
		minLength: 10,
		maxLength: 3000
	},
	authors: {
		required: true,
		custom: (value: string[]) => {
			if (!Array.isArray(value) || value.length === 0) {
				return 'At least one author is required';
			}
			for (const author of value) {
				if (!author.includes('@')) {
					return 'Author emails must be valid email addresses';
				}
			}
			return null;
		}
	},
	decision_drivers: {
		required: false,
		custom: (value: string[]) => {
			if (value && Array.isArray(value)) {
				for (const driver of value) {
					if (typeof driver !== 'string' || driver.length < 5) {
						return 'Each decision driver must be at least 5 characters';
					}
				}
			}
			return null;
		}
	},
	considered_options: {
		required: false,
		custom: (value: string[]) => {
			if (value && Array.isArray(value)) {
				if (value.length > 0 && value.length < 2) {
					return 'If options are provided, at least 2 options should be considered';
				}
				for (const option of value) {
					if (typeof option !== 'string' || option.length < 5) {
						return 'Each considered option must be at least 5 characters';
					}
				}
			}
			return null;
		}
	},
	requirement_ids: {
		required: true,
		custom: (value: string[]) => {
			if (!Array.isArray(value) || value.length === 0) {
				return 'At least one requirement must be linked';
			}
			for (const id of value) {
				if (!id.match(/^REQ-\d{4}-[A-Z]{2,5}-\d{2}$/)) {
					return 'Invalid requirement ID format (expected: REQ-XXXX-TYPE-XX)';
				}
			}
			return null;
		}
	},
	consequences: {
		required: false,
		custom: (value: { good?: string[]; bad?: string[]; neutral?: string[] }) => {
			if (value && typeof value === 'object') {
				const checkArray = (arr: string[] | undefined, type: string) => {
					if (arr && Array.isArray(arr)) {
						for (const item of arr) {
							if (typeof item === 'string' && item.trim() && item.length < 5) {
								return `Each ${type} consequence must be at least 5 characters`;
							}
						}
					}
					return null;
				};

				const goodError = checkArray(value.good, 'good');
				if (goodError) return goodError;

				const badError = checkArray(value.bad, 'bad');
				if (badError) return badError;

				const neutralError = checkArray(value.neutral, 'neutral');
				if (neutralError) return neutralError;
			}
			return null;
		}
	}
};

// Format validation utilities
export const formatValidators = {
	email: (value: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(value);
	},

	requirementId: (value: string): boolean => {
		return /^REQ-\d{4}-[A-Z]{2,4}-\d{2}$/.test(value);
	},

	taskId: (value: string): boolean => {
		return /^TASK-\d{4}-\d{2}-\d{2}$/.test(value);
	},

	architectureId: (value: string): boolean => {
		return /^(ADR|TDD|INTG)-\d{4}(-[A-Za-z0-9-]+)?(-\d{2})?$/.test(value);
	}
};

// Business rule validation functions
export const businessRules = {
	// Check for duplicate titles using MCP client integration
	checkDuplicateTitle: async (
		title: string,
		entityType: 'requirement' | 'task' | 'architecture',
		excludeId?: string
	): Promise<string | null> => {
		try {
			// Import MCP client dynamically to avoid circular dependencies
			const { mcpClient } = await import('$lib/services/mcp-client.js');

			// Get connected MCP client
			if (!mcpClient.isConnected()) {
				console.warn('MCP client not connected, skipping duplicate check');
				return null; // Graceful degradation
			}

			let existingEntities = [];

			// Query existing entities based on type
			switch (entityType) {
				case 'requirement':
					const reqResult = await mcpClient.getRequirements();
					existingEntities = reqResult.success ? reqResult.data : [];
					break;
				case 'task':
					const taskResult = await mcpClient.getTasks();
					existingEntities = taskResult.success ? taskResult.data : [];
					break;
				case 'architecture':
					const archResult = await mcpClient.getArchitectureDecisions();
					existingEntities = archResult.success ? archResult.data : [];
					break;
			}

			// Check for exact title matches (case-insensitive, excluding current entity)
			const duplicates = existingEntities.filter(
				(entity: any) =>
					entity.title.toLowerCase() === title.toLowerCase() && entity.id !== excludeId
			);

			return duplicates.length > 0
				? `A ${entityType} with the title "${title}" already exists`
				: null;
		} catch (error) {
			console.warn(`Duplicate checking failed for ${entityType}:`, error);
			return null; // Don't block form submission on network errors
		}
	},

	// Validate requirement status progression
	validateStatusProgression: (
		currentStatus: RequirementStatus,
		newStatus: RequirementStatus
	): string | null => {
		const validTransitions: Record<RequirementStatus, RequirementStatus[]> = {
			Draft: ['Under Review'],
			'Under Review': ['Draft', 'Approved'],
			Approved: ['Under Review', 'Architecture', 'Ready'],
			Architecture: ['Approved', 'Ready'],
			Ready: ['Architecture', 'Implemented'],
			Implemented: ['Ready', 'Validated'],
			Validated: ['Implemented'],
			Deprecated: [] // No transitions from deprecated
		};

		if (!validTransitions[currentStatus]?.includes(newStatus)) {
			return `Invalid status transition from ${currentStatus} to ${newStatus}`;
		}
		return null;
	},

	// Validate task can be created for requirement in current status
	validateTaskCreationForRequirement: (requirementStatus: RequirementStatus): string | null => {
		const validStatesForTaskCreation: RequirementStatus[] = [
			'Approved',
			'Architecture',
			'Ready',
			'Implemented',
			'Validated'
		];

		if (!validStatesForTaskCreation.includes(requirementStatus)) {
			return `Tasks cannot be created for requirements in ${requirementStatus} status. Requirement must be Approved or later.`;
		}
		return null;
	},

	// Validate requirement exists and is in proper state for task creation (async with MCP client)
	validateRequirementStatus: async (requirementIds: string[]): Promise<string | null> => {
		try {
			// Import MCP client dynamically to avoid circular dependencies
			const { mcpClient } = await import('$lib/services/mcp-client.js');

			if (!mcpClient.isConnected()) {
				console.warn('MCP client not connected, skipping requirement validation');
				return null; // Graceful degradation
			}

			const invalidRequirements = [];

			for (const id of requirementIds) {
				const result = await mcpClient.getRequirementDetails(id);
				if (!result.success || !result.data) {
					return `Requirement ${id} not found`;
				}

				const requirement = result.data;
				const validStates = ['Approved', 'Architecture', 'Ready', 'Implemented', 'Validated'];

				if (!validStates.includes(requirement.status)) {
					invalidRequirements.push(`${requirement.title} (${requirement.status})`);
				}
			}

			if (invalidRequirements.length > 0) {
				return `Cannot create tasks for requirements in invalid states: ${invalidRequirements.join(', ')}`;
			}

			return null;
		} catch (error) {
			console.warn('Requirement status validation failed:', error);
			return null; // Don't block form submission on network errors
		}
	}
};
