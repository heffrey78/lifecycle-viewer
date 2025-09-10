import { describe, it, expect, beforeEach } from 'vitest';
import {
	requirementSchema,
	taskSchema,
	architectureSchema,
	formatValidators,
	businessRules
} from './schemas.js';
import { FormValidator, DebouncedValidator } from './validator.js';

describe('Validation Schemas', () => {
	describe('Requirement Schema', () => {
		let validator: FormValidator;

		beforeEach(() => {
			validator = new FormValidator(requirementSchema);
		});

		it('should validate required fields', async () => {
			const invalidData = {
				title: '',
				type: '',
				priority: '',
				current_state: '',
				desired_state: '',
				author: ''
			};

			const result = await validator.validateForm(invalidData);
			expect(result.isValid).toBe(false);
			expect(result.errors.title).toContain('Title is required');
			expect(result.errors.type).toContain('Type is required');
			expect(result.errors.priority).toContain('Priority is required');
			expect(result.errors.current_state).toContain('Current State is required');
			expect(result.errors.desired_state).toContain('Desired State is required');
			expect(result.errors.author).toContain('Author is required');
		});

		it('should validate minimum length requirements', async () => {
			const result = await validator.validateField('title', 'ab');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Title must be at least 3 characters');
		});

		it('should validate maximum length requirements', async () => {
			const longTitle = 'a'.repeat(201);
			const result = await validator.validateField('title', longTitle);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Title must be no more than 200 characters');
		});

		it('should validate email format for author', async () => {
			const result = await validator.validateField('author', 'invalid-email');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Author must be a valid email address');
		});

		it('should validate requirement type enum', async () => {
			const result = await validator.validateField('type', 'INVALID');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid requirement type');
		});

		it('should validate priority enum', async () => {
			const result = await validator.validateField('priority', 'P5');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid priority level');
		});

		it('should validate functional requirements array', async () => {
			const result = await validator.validateField('functional_requirements', ['a', 'b']);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Each functional requirement must be at least 5 characters');
		});

		it('should accept valid requirement data', async () => {
			const validData = {
				title: 'Valid Requirement Title',
				type: 'FUNC',
				priority: 'P1',
				current_state: 'Current state description with sufficient length',
				desired_state: 'Desired state description with sufficient length',
				author: 'user@example.com',
				functional_requirements: ['Valid functional requirement description'],
				acceptance_criteria: ['Valid acceptance criteria with sufficient length']
			};

			const result = await validator.validateForm(validData);
			expect(result.isValid).toBe(true);
			expect(Object.keys(result.errors)).toHaveLength(0);
		});
	});

	describe('Task Schema', () => {
		let validator: FormValidator;

		beforeEach(() => {
			validator = new FormValidator(taskSchema);
		});

		it('should validate required fields', async () => {
			const invalidData = {
				title: '',
				priority: '',
				requirement_ids: []
			};

			const result = await validator.validateForm(invalidData);
			expect(result.isValid).toBe(false);
			expect(result.errors.title).toContain('Title is required');
			expect(result.errors.priority).toContain('Priority is required');
			expect(result.errors.requirement_ids).toContain('Requirement Ids is required');
		});

		it('should validate user story format', async () => {
			const result = await validator.validateField('user_story', 'Invalid user story format');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain(
				'User story should follow format: "As a [user], I want [goal], so that [benefit]"'
			);
		});

		it('should accept valid user story format', async () => {
			const result = await validator.validateField(
				'user_story',
				'As a user, I want to create tasks, so that I can track work'
			);
			expect(result.isValid).toBe(true);
		});

		it('should validate requirement ID format', async () => {
			const result = await validator.validateField('requirement_ids', ['INVALID-ID']);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid requirement ID format (expected: REQ-XXXX-TYPE-XX)');
		});

		it('should accept valid requirement IDs', async () => {
			const result = await validator.validateField('requirement_ids', [
				'REQ-0001-FUNC-01',
				'REQ-0002-TECH-01'
			]);
			expect(result.isValid).toBe(true);
		});

		it('should validate effort size enum', async () => {
			const result = await validator.validateField('effort', 'INVALID');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Invalid effort size');
		});

		it('should accept valid task data', async () => {
			const validData = {
				title: 'Valid Task Title',
				priority: 'P2',
				effort: 'M',
				user_story:
					'As a developer, I want to implement validation, so that data quality is maintained',
				assignee: 'developer@example.com',
				requirement_ids: ['REQ-0001-FUNC-01'],
				acceptance_criteria: ['Validation works correctly', 'Error messages are clear']
			};

			const result = await validator.validateForm(validData);
			expect(result.isValid).toBe(true);
		});
	});

	describe('Architecture Schema', () => {
		let validator: FormValidator;

		beforeEach(() => {
			validator = new FormValidator(architectureSchema);
		});

		it('should validate required fields', async () => {
			const invalidData = {
				title: '',
				type: '',
				context: '',
				decision_outcome: '',
				authors: [],
				requirement_ids: []
			};

			const result = await validator.validateForm(invalidData);
			expect(result.isValid).toBe(false);
			expect(result.errors.title).toContain('Title is required');
			expect(result.errors.type).toContain('Type is required');
			expect(result.errors.context).toContain('Context is required');
			expect(result.errors.decision_outcome).toContain('Decision Outcome is required');
			expect(result.errors.authors).toContain('Authors is required');
			expect(result.errors.requirement_ids).toContain('Requirement Ids is required');
		});

		it('should validate author email format', async () => {
			const result = await validator.validateField('authors', ['invalid-email']);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Author emails must be valid email addresses');
		});

		it('should validate minimum considered options', async () => {
			const result = await validator.validateField('considered_options', ['Only one option']);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain(
				'If options are provided, at least 2 options should be considered'
			);
		});

		it('should accept valid architecture data', async () => {
			const validData = {
				title: 'Architecture Decision: Database Selection',
				type: 'ADR',
				context:
					'We need to select a database technology that supports our scalability requirements and team expertise.',
				decision_outcome:
					'We will use PostgreSQL for its ACID compliance and strong ecosystem support.',
				authors: ['architect@example.com'],
				requirement_ids: ['REQ-0001-TECH-01'],
				decision_drivers: ['Performance requirements', 'Team expertise', 'Cost considerations'],
				considered_options: ['PostgreSQL', 'MongoDB', 'MySQL']
			};

			const result = await validator.validateForm(validData);
			expect(result.isValid).toBe(true);
		});
	});
});

describe('Format Validators', () => {
	describe('email validator', () => {
		it('should validate correct email formats', () => {
			expect(formatValidators.email('user@example.com')).toBe(true);
			expect(formatValidators.email('test.email+tag@domain.co.uk')).toBe(true);
		});

		it('should reject invalid email formats', () => {
			expect(formatValidators.email('invalid-email')).toBe(false);
			expect(formatValidators.email('@domain.com')).toBe(false);
			expect(formatValidators.email('user@')).toBe(false);
		});
	});

	describe('ID format validators', () => {
		it('should validate requirement ID format', () => {
			expect(formatValidators.requirementId('REQ-0001-FUNC-01')).toBe(true);
			expect(formatValidators.requirementId('REQ-1234-TECH-99')).toBe(true);
			expect(formatValidators.requirementId('INVALID-FORMAT')).toBe(false);
		});

		it('should validate task ID format', () => {
			expect(formatValidators.taskId('TASK-0001-00-00')).toBe(true);
			expect(formatValidators.taskId('TASK-1234-99-99')).toBe(true);
			expect(formatValidators.taskId('INVALID-FORMAT')).toBe(false);
		});

		it('should validate architecture ID format', () => {
			expect(formatValidators.architectureId('ADR-0001')).toBe(true);
			expect(formatValidators.architectureId('TDD-0001-Component-01')).toBe(true);
			expect(formatValidators.architectureId('INTG-1234')).toBe(true);
			expect(formatValidators.architectureId('INVALID-FORMAT')).toBe(false);
		});
	});
});

describe('Business Rules', () => {
	describe('status progression validation', () => {
		it('should allow valid status transitions', () => {
			expect(businessRules.validateStatusProgression('Draft', 'Under Review')).toBeNull();
			expect(businessRules.validateStatusProgression('Under Review', 'Approved')).toBeNull();
			expect(businessRules.validateStatusProgression('Approved', 'Architecture')).toBeNull();
		});

		it('should reject invalid status transitions', () => {
			const result = businessRules.validateStatusProgression('Draft', 'Implemented');
			expect(result).toBe('Invalid status transition from Draft to Implemented');
		});

		it('should prevent transitions from deprecated status', () => {
			const result = businessRules.validateStatusProgression('Deprecated', 'Draft');
			expect(result).toBe('Invalid status transition from Deprecated to Draft');
		});
	});

	describe('task creation validation', () => {
		it('should allow task creation for approved requirements', () => {
			expect(businessRules.validateTaskCreationForRequirement('Approved')).toBeNull();
			expect(businessRules.validateTaskCreationForRequirement('Architecture')).toBeNull();
			expect(businessRules.validateTaskCreationForRequirement('Ready')).toBeNull();
			expect(businessRules.validateTaskCreationForRequirement('Implemented')).toBeNull();
			expect(businessRules.validateTaskCreationForRequirement('Validated')).toBeNull();
		});

		it('should prevent task creation for unapproved requirements', () => {
			const result = businessRules.validateTaskCreationForRequirement('Draft');
			expect(result).toBe(
				'Tasks cannot be created for requirements in Draft status. Requirement must be Approved or later.'
			);
		});
	});
});

describe('FormValidator', () => {
	let validator: FormValidator;

	beforeEach(() => {
		const testSchema = {
			name: { required: true, minLength: 2 },
			email: { required: true, email: true },
			age: {
				required: false,
				custom: (value: number) => (value < 18 ? 'Must be 18 or older' : null)
			}
		};
		validator = new FormValidator(testSchema);
	});

	it('should get required fields', () => {
		const required = validator.getRequiredFields();
		expect(required).toEqual(['name', 'email']);
	});

	it('should get all fields', () => {
		const all = validator.getAllFields();
		expect(all).toEqual(['name', 'email', 'age']);
	});

	it('should validate individual fields', async () => {
		const result = await validator.validateField('name', 'a');
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Name must be at least 2 characters');
	});

	it('should validate custom rules', async () => {
		const result = await validator.validateField('age', 16);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Must be 18 or older');
	});
});

describe('DebouncedValidator', () => {
	let validator: FormValidator;
	let debouncedValidator: DebouncedValidator;

	beforeEach(() => {
		const testSchema = {
			name: { required: true, minLength: 2 }
		};
		validator = new FormValidator(testSchema);
		debouncedValidator = new DebouncedValidator(validator, 50); // Shorter delay for tests
	});

	it('should debounce validation calls', async () => {
		let callCount = 0;
		const callback = () => {
			callCount++;
		};

		// Multiple rapid calls
		debouncedValidator.validateFieldDebounced('name', 'a', {}, callback);
		debouncedValidator.validateFieldDebounced('name', 'ab', {}, callback);
		debouncedValidator.validateFieldDebounced('name', 'abc', {}, callback);

		// Should only call once after debounce delay
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(callCount).toBe(1);
	});

	it('should cancel pending validations', async () => {
		let callCount = 0;
		const callback = () => {
			callCount++;
		};

		debouncedValidator.validateFieldDebounced('name', 'test', {}, callback);
		debouncedValidator.cancel();

		// Should not call callback after cancellation
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(callCount).toBe(0);
	});
});
