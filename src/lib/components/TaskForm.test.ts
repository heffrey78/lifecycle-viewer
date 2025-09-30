// Comprehensive test suite for TaskForm component
// Tests core functionality, validation, accessibility, and performance

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TaskForm from './TaskForm.svelte';

// Mock validation system
vi.mock('$lib/validation/index.js', () => ({
	validationUtils: {
		createTaskValidator: vi.fn(() =>
			Promise.resolve({
				validateField: vi.fn(() => Promise.resolve({ isValid: true, errors: [], warnings: [] })),
				validateForm: vi.fn(() => Promise.resolve({ isValid: true, errors: {}, warnings: {} }))
			})
		)
	},
	FormValidator: vi.fn(),
	DebouncedValidator: vi.fn(() => ({
		validateFieldDebounced: vi.fn(),
		cancel: vi.fn()
	}))
}));

// Mock services
vi.mock('$lib/services/task-creation.js', () => ({
	taskCreationService: {
		checkConnection: vi.fn(() => Promise.resolve(true)),
		createTask: vi.fn(() =>
			Promise.resolve({
				success: true,
				data: {
					id: 'TASK-001-00-00',
					title: 'Test Task',
					status: 'Not Started',
					priority: 'P1'
				}
			})
		),
		getApprovedRequirements: vi.fn(() =>
			Promise.resolve({
				success: true,
				data: [
					{
						id: 'REQ-001-FUNC-00',
						title: 'Test Requirement',
						status: 'Approved',
						priority: 'P1',
						type: 'FUNC'
					}
				]
			})
		),
		getAllTasks: vi.fn(() =>
			Promise.resolve({
				success: true,
				data: [
					{
						id: 'TASK-001-00-00',
						title: 'Parent Task',
						status: 'In Progress',
						priority: 'P1'
					}
				]
			})
		),
		validateFormData: vi.fn(() => Promise.resolve({ isValid: true, errors: [] }))
	}
}));

// Mock RichTextEditor
vi.mock('./RichTextEditor.svelte', () => ({
	default: vi.fn(() => ({
		$$: { on_mount: [], on_destroy: [] },
		$set: vi.fn()
	}))
}));

// Mock theme
vi.mock('$lib/theme', () => ({
	currentTheme: { subscribe: vi.fn() }
}));

// Mock HTML sanitizer
vi.mock('$lib/utils/html-sanitizer.js', () => ({
	stripHtmlForValidation: vi.fn((str) => str)
}));

describe('TaskForm Component', () => {
	let component: any;
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		user = userEvent.setup();
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (component) {
			component.$destroy();
		}
	});

	describe('Basic Rendering', () => {
		it('should render task form with all required fields', () => {
			component = render(TaskForm);

			expect(screen.getByTestId('task-form')).toBeInTheDocument();
			expect(screen.getByTestId('task-title')).toBeInTheDocument();
			expect(screen.getByTestId('task-priority')).toBeInTheDocument();
			expect(screen.getByTestId('task-effort')).toBeInTheDocument();
			expect(screen.getByTestId('task-assignee')).toBeInTheDocument();
			expect(screen.getByTestId('requirements-selection')).toBeInTheDocument();
			expect(screen.getByTestId('parent-task')).toBeInTheDocument();
			expect(screen.getByTestId('acceptance-criteria')).toBeInTheDocument();
			expect(screen.getByTestId('submit-button')).toBeInTheDocument();
			expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
		});

		it('should display priority options correctly', () => {
			component = render(TaskForm);

			const prioritySelect = screen.getByTestId('task-priority');
			expect(prioritySelect).toBeInTheDocument();

			// Check that all priority options are available
			const options = prioritySelect.querySelectorAll('option');
			expect(options).toHaveLength(4); // P0, P1, P2, P3
			expect(options[0].textContent).toContain('P0 - Critical');
			expect(options[1].textContent).toContain('P1 - High');
			expect(options[2].textContent).toContain('P2 - Medium');
			expect(options[3].textContent).toContain('P3 - Low');
		});

		it('should display effort size options correctly', () => {
			component = render(TaskForm);

			const effortSelect = screen.getByTestId('task-effort');
			expect(effortSelect).toBeInTheDocument();

			// Check that all effort options are available
			const options = effortSelect.querySelectorAll('option');
			expect(options).toHaveLength(5); // XS, S, M, L, XL
			expect(options[0].textContent).toContain('XS - Extra Small');
			expect(options[1].textContent).toContain('S - Small');
			expect(options[2].textContent).toContain('M - Medium');
			expect(options[3].textContent).toContain('L - Large');
			expect(options[4].textContent).toContain('XL - Extra Large');
		});

		it('should render with initial data when provided', () => {
			const initialData = {
				title: 'Initial Task Title',
				priority: 'P2' as const,
				effort: 'L' as const,
				assignee: 'test@example.com',
				user_story: 'As a user...',
				requirement_ids: ['REQ-001-FUNC-00'],
				acceptance_criteria: ['Criterion 1', 'Criterion 2']
			};

			component = render(TaskForm, { props: { initialData } });

			expect(screen.getByDisplayValue('Initial Task Title')).toBeInTheDocument();
			expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();

			const prioritySelect = screen.getByTestId('task-priority') as HTMLSelectElement;
			expect(prioritySelect.value).toBe('P2');

			const effortSelect = screen.getByTestId('task-effort') as HTMLSelectElement;
			expect(effortSelect.value).toBe('L');
		});
	});

	describe('Form Validation', () => {
		it('should show validation error for empty title', async () => {
			const mockValidator = {
				validateField: vi.fn(() =>
					Promise.resolve({
						isValid: false,
						errors: ['Title is required'],
						warnings: []
					})
				),
				validateForm: vi.fn(() => Promise.resolve({ isValid: false, errors: {}, warnings: {} }))
			};

			const { validationUtils } = await import('$lib/validation/index.js');
			vi.mocked(validationUtils.createTaskValidator).mockResolvedValue(mockValidator);

			component = render(TaskForm);

			const titleInput = screen.getByTestId('task-title');
			await user.type(titleInput, 'A');
			await user.clear(titleInput);

			await waitFor(() => {
				expect(screen.getByTestId('title-error')).toBeInTheDocument();
				expect(screen.getByText('Title is required')).toBeInTheDocument();
			});
		});

		it('should validate email format for assignee', async () => {
			const mockValidator = {
				validateField: vi.fn(() =>
					Promise.resolve({
						isValid: false,
						errors: ['Invalid email format'],
						warnings: []
					})
				),
				validateForm: vi.fn(() => Promise.resolve({ isValid: false, errors: {}, warnings: {} }))
			};

			const { validationUtils } = await import('$lib/validation/index.js');
			vi.mocked(validationUtils.createTaskValidator).mockResolvedValue(mockValidator);

			component = render(TaskForm);

			const assigneeInput = screen.getByTestId('task-assignee');
			await user.type(assigneeInput, 'invalid-email');

			await waitFor(() => {
				expect(screen.getByTestId('assignee-error')).toBeInTheDocument();
				expect(screen.getByText('Invalid email format')).toBeInTheDocument();
			});
		});

		it('should require at least one requirement to be selected', async () => {
			component = render(TaskForm);

			await waitFor(() => {
				expect(screen.getByTestId('requirements-error')).toBeInTheDocument();
				expect(screen.getByText('At least one requirement must be selected')).toBeInTheDocument();
			});
		});

		it('should disable submit button when form is invalid', async () => {
			component = render(TaskForm);

			const submitButton = screen.getByTestId('submit-button');
			expect(submitButton).toBeDisabled();
		});
	});

	describe('Requirements Selection', () => {
		it('should load and display available requirements', async () => {
			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			await waitFor(() => {
				expect(screen.getByText('Test Requirement')).toBeInTheDocument();
				expect(screen.getByText('REQ-001-FUNC-00 • Approved • P1')).toBeInTheDocument();
			});
		});

		it('should allow selecting and deselecting requirements', async () => {
			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			await waitFor(() => {
				const checkbox = screen.getByTestId('requirement-REQ-001-FUNC-00');
				expect(checkbox).toBeInTheDocument();
			});

			const checkbox = screen.getByTestId('requirement-REQ-001-FUNC-00') as HTMLInputElement;

			// Select requirement
			await user.click(checkbox);
			expect(checkbox.checked).toBe(true);

			// Deselect requirement
			await user.click(checkbox);
			expect(checkbox.checked).toBe(false);
		});

		it('should show message when no approved requirements available', async () => {
			const { taskCreationService } = await import('$lib/services/task-creation.js');
			vi.mocked(taskCreationService.getApprovedRequirements).mockResolvedValue({
				success: true,
				data: []
			});

			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			await waitFor(() => {
				expect(screen.getByText(/No approved requirements available/)).toBeInTheDocument();
			});
		});
	});

	describe('Parent Task Selection', () => {
		it('should load and display available tasks for parent selection', async () => {
			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			await waitFor(() => {
				const parentSelect = screen.getByTestId('parent-task');
				const options = parentSelect.querySelectorAll('option');
				expect(options).toHaveLength(2); // "No parent task" + 1 task
				expect(options[1].textContent).toContain('TASK-001-00-00 - Parent Task');
			});
		});

		it('should allow selecting no parent task', async () => {
			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			const parentSelect = screen.getByTestId('parent-task') as HTMLSelectElement;
			await user.selectOptions(parentSelect, '');

			expect(parentSelect.value).toBe('');
		});
	});

	describe('Acceptance Criteria Management', () => {
		it('should start with one empty acceptance criterion', () => {
			component = render(TaskForm);

			const criteria = screen.getAllByTestId(/^criterion-/);
			expect(criteria).toHaveLength(1);
			expect(criteria[0]).toHaveValue('');
		});

		it('should add new acceptance criterion when button clicked', async () => {
			component = render(TaskForm);

			const addButton = screen.getByTestId('add-criterion');
			await user.click(addButton);

			const criteria = screen.getAllByTestId(/^criterion-/);
			expect(criteria).toHaveLength(2);
		});

		it('should remove acceptance criterion when remove button clicked', async () => {
			component = render(TaskForm);

			// Add a second criterion first
			const addButton = screen.getByTestId('add-criterion');
			await user.click(addButton);

			// Now remove it
			const removeButton = screen.getByTestId('remove-criterion-1');
			await user.click(removeButton);

			const criteria = screen.getAllByTestId(/^criterion-/);
			expect(criteria).toHaveLength(1);
		});

		it('should not show remove button when only one criterion exists', () => {
			component = render(TaskForm);

			expect(screen.queryByTestId('remove-criterion-0')).not.toBeInTheDocument();
		});

		it('should update criterion text when typing', async () => {
			component = render(TaskForm);

			const criterion = screen.getByTestId('criterion-0');
			await user.type(criterion, 'New acceptance criterion');

			expect(criterion).toHaveValue('New acceptance criterion');
		});
	});

	describe('Form Submission', () => {
		it('should call taskCreationService.createTask when form is submitted', async () => {
			const { taskCreationService } = await import('$lib/services/task-creation.js');

			component = render(TaskForm, {
				props: {
					enableMcpIntegration: true,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			expect(taskCreationService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Test Task',
					requirement_ids: ['REQ-001-FUNC-00']
				})
			);
		});

		it('should dispatch submit event when MCP integration is disabled', async () => {
			const mockDispatch = vi.fn();

			component = render(TaskForm, {
				props: {
					enableMcpIntegration: false,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			// Mock the dispatch method
			component.$on('submit', mockDispatch);

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockDispatch).toHaveBeenCalled();
			});
		});

		it('should show success message after successful submission', async () => {
			component = render(TaskForm, {
				props: {
					enableMcpIntegration: true,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByTestId('success-message')).toBeInTheDocument();
				expect(screen.getByText('Task created successfully!')).toBeInTheDocument();
			});
		});

		it('should show error message when submission fails', async () => {
			const { taskCreationService } = await import('$lib/services/task-creation.js');
			vi.mocked(taskCreationService.createTask).mockResolvedValue({
				success: false,
				error: 'Failed to create task'
			});

			component = render(TaskForm, {
				props: {
					enableMcpIntegration: true,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toBeInTheDocument();
				expect(screen.getByText('Failed to create task')).toBeInTheDocument();
			});
		});

		it('should show loading state during submission', async () => {
			const { taskCreationService } = await import('$lib/services/task-creation.js');

			// Create a promise that we can control
			let resolveCreate: (value: any) => void;
			const createPromise = new Promise((resolve) => {
				resolveCreate = resolve;
			});

			vi.mocked(taskCreationService.createTask).mockReturnValue(createPromise);

			component = render(TaskForm, {
				props: {
					enableMcpIntegration: true,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			// Should show loading state
			expect(screen.getByText('Creating Task...')).toBeInTheDocument();
			expect(submitButton).toBeDisabled();

			// Resolve the promise
			resolveCreate({ success: true, data: { id: 'TASK-001' } });

			await waitFor(() => {
				expect(screen.queryByText('Creating Task...')).not.toBeInTheDocument();
			});
		});
	});

	describe('MCP Connection Status', () => {
		it('should show connection status when MCP integration is enabled', async () => {
			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			await waitFor(() => {
				expect(screen.getByText('Connected to Lifecycle MCP')).toBeInTheDocument();
			});
		});

		it('should not show connection status when MCP integration is disabled', () => {
			component = render(TaskForm, { props: { enableMcpIntegration: false } });

			expect(screen.queryByText(/Connected to Lifecycle MCP/)).not.toBeInTheDocument();
		});

		it('should show disconnected status when connection fails', async () => {
			const { taskCreationService } = await import('$lib/services/task-creation.js');
			vi.mocked(taskCreationService.checkConnection).mockResolvedValue(false);

			component = render(TaskForm, { props: { enableMcpIntegration: true } });

			await waitFor(() => {
				expect(screen.getByText('Disconnected from MCP server')).toBeInTheDocument();
			});
		});
	});

	describe('Event Handling', () => {
		it('should dispatch cancel event when cancel button clicked', async () => {
			const mockDispatch = vi.fn();

			component = render(TaskForm);
			component.$on('cancel', mockDispatch);

			const cancelButton = screen.getByTestId('cancel-button');
			await user.click(cancelButton);

			expect(mockDispatch).toHaveBeenCalled();
		});

		it('should dispatch success event after successful creation', async () => {
			const mockDispatch = vi.fn();

			component = render(TaskForm, {
				props: {
					enableMcpIntegration: true,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			component.$on('success', mockDispatch);

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockDispatch).toHaveBeenCalledWith(
					expect.objectContaining({
						detail: expect.objectContaining({
							task: expect.any(Object),
							message: 'Task created successfully!'
						})
					})
				);
			});
		});

		it('should dispatch error event when creation fails', async () => {
			const { taskCreationService } = await import('$lib/services/task-creation.js');
			vi.mocked(taskCreationService.createTask).mockResolvedValue({
				success: false,
				error: 'Creation failed',
				isRetryable: true
			});

			const mockDispatch = vi.fn();

			component = render(TaskForm, {
				props: {
					enableMcpIntegration: true,
					initialData: {
						title: 'Test Task',
						requirement_ids: ['REQ-001-FUNC-00']
					}
				}
			});

			component.$on('error', mockDispatch);

			await waitFor(() => {
				const submitButton = screen.getByTestId('submit-button');
				expect(submitButton).not.toBeDisabled();
			});

			const submitButton = screen.getByTestId('submit-button');
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockDispatch).toHaveBeenCalledWith(
					expect.objectContaining({
						detail: expect.objectContaining({
							error: 'Creation failed',
							isRetryable: true
						})
					})
				);
			});
		});
	});

	describe('Accessibility', () => {
		it('should have proper labels for all form fields', () => {
			component = render(TaskForm);

			expect(screen.getByLabelText('Task Title *')).toBeInTheDocument();
			expect(screen.getByLabelText('Priority *')).toBeInTheDocument();
			expect(screen.getByLabelText('Effort Estimate')).toBeInTheDocument();
			expect(screen.getByLabelText('Assignee')).toBeInTheDocument();
			expect(screen.getByLabelText('Linked Requirements *')).toBeInTheDocument();
			expect(screen.getByLabelText('Parent Task (Optional)')).toBeInTheDocument();
		});

		it('should support keyboard navigation', async () => {
			component = render(TaskForm);

			const titleInput = screen.getByTestId('task-title');
			titleInput.focus();
			expect(document.activeElement).toBe(titleInput);

			// Tab to next field
			await user.tab();
			const prioritySelect = screen.getByTestId('task-priority');
			expect(document.activeElement).toBe(prioritySelect);
		});

		it('should have proper ARIA attributes', () => {
			component = render(TaskForm);

			const form = screen.getByTestId('task-form');
			expect(form).toHaveAttribute('novalidate');

			const submitButton = screen.getByTestId('submit-button');
			expect(submitButton).toHaveAttribute('type', 'submit');
		});
	});
});

describe('TaskForm Performance', () => {
	it('should not re-render unnecessarily', async () => {
		const renderSpy = vi.fn();

		const component = render(TaskForm, {
			props: { initialData: { title: 'Test' } }
		});

		// Simulate multiple rapid changes
		const titleInput = screen.getByTestId('task-title');
		const user = userEvent.setup();

		await user.type(titleInput, 'New title');

		// Should not cause excessive re-renders
		expect(component).toBeDefined();
	});

	it('should handle large numbers of requirements efficiently', async () => {
		const manyRequirements = Array.from({ length: 100 }, (_, i) => ({
			id: `REQ-${i.toString().padStart(3, '0')}-FUNC-00`,
			title: `Requirement ${i}`,
			status: 'Approved' as const,
			priority: 'P1' as const,
			type: 'FUNC' as const
		}));

		const { taskCreationService } = await import('$lib/services/task-creation.js');
		vi.mocked(taskCreationService.getApprovedRequirements).mockResolvedValue({
			success: true,
			data: manyRequirements
		});

		const startTime = performance.now();
		const component = render(TaskForm, { props: { enableMcpIntegration: true } });

		await waitFor(() => {
			expect(screen.getByText('Requirement 0')).toBeInTheDocument();
		});

		const endTime = performance.now();
		const renderTime = endTime - startTime;

		// Should render within reasonable time (adjust threshold as needed)
		expect(renderTime).toBeLessThan(1000); // 1 second

		component.$destroy();
	});
});
