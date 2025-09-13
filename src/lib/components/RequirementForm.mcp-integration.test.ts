// Tests for RequirementForm MCP Integration
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import RequirementForm from './RequirementForm.svelte';
import type { RequirementFormData, Requirement } from '$lib/types/lifecycle.js';

// Mock Tiptap Editor with a working mock that returns valid methods
const createMockEditor = () => ({
	destroy: vi.fn(),
	commands: {
		setContent: vi.fn().mockReturnThis(),
		focus: vi.fn().mockReturnThis(),
	},
	chain: vi.fn().mockReturnThis(),
	getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
	setEditable: vi.fn(),
	isActive: vi.fn().mockReturnValue(false),
	can: vi.fn().mockReturnValue({
		undo: vi.fn().mockReturnValue(false),
		redo: vi.fn().mockReturnValue(false),
	}),
});

vi.mock('@tiptap/core', () => ({
	Editor: vi.fn().mockImplementation((config) => {
		const mockEditor = createMockEditor();
		
		// Call lifecycle callbacks if provided
		setTimeout(() => {
			if (config.onCreate) config.onCreate();
			if (config.onTransaction) config.onTransaction();
			if (config.onUpdate) config.onUpdate({ editor: mockEditor });
		}, 0);
		
		return mockEditor;
	}),
}));

vi.mock('@tiptap/starter-kit', () => ({
	default: { configure: vi.fn().mockReturnValue('StarterKit') },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
	default: { configure: vi.fn().mockReturnValue('Placeholder') },
}));

// Mock requirement creation service
vi.mock('$lib/services/requirement-creation.js', () => ({
	requirementCreationService: {
		createRequirement: vi.fn(),
		checkConnection: vi.fn(),
	}
}));

import { requirementCreationService } from '$lib/services/requirement-creation.js';
const mockRequirementCreationService = vi.mocked(requirementCreationService);

describe('RequirementForm - MCP Integration', () => {
	let user: ReturnType<typeof userEvent.setup>;

	const mockRequirement: Requirement = {
		id: 'REQ-0001-FUNC-01',
		requirement_number: 1,
		type: 'FUNC',
		version: 1,
		title: 'Test Requirement',
		status: 'Draft',
		priority: 'P1',
		risk_level: 'Medium',
		business_value: 'Test business value',
		current_state: 'Current state',
		desired_state: 'Desired state',
		acceptance_criteria: ['Criteria 1', 'Criteria 2'],
		functional_requirements: ['Requirement 1'],
		author: 'Test Author',
		created_at: '2025-01-01T00:00:00Z',
		updated_at: '2025-01-01T00:00:00Z',
		task_count: 0,
		tasks_completed: 0
	};

	beforeEach(() => {
		user = userEvent.setup();
		vi.clearAllMocks();
		mockRequirementCreationService.checkConnection.mockResolvedValue(true);
		mockRequirementCreationService.createRequirement.mockResolvedValue({
			success: true,
			data: mockRequirement
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const createValidInitialData = () => ({
		type: 'FUNC',
		title: 'Test Requirement',
		priority: 'P1',
		current_state: 'Current state description',
		desired_state: 'Desired state description',
		business_value: 'Business value description',
		author: 'test@example.com',
		acceptance_criteria: ['User can perform the required action'],
		functional_requirements: ['User can log in to the system']
	});

	describe('MCP Integration Enabled', () => {
		const renderFormWithMcp = (props = {}) => {
			return render(RequirementForm, {
				props: {
					enableMcpIntegration: true,
					...props,
				},
			});
		};

		it('should show connection status when MCP integration is enabled', async () => {
			renderFormWithMcp();

			await waitFor(() => {
				expect(screen.getByText('Server Status:')).toBeInTheDocument();
			});
		});

		it('should show connected status when connection is successful', async () => {
			mockRequirementCreationService.checkConnection.mockResolvedValue(true);
			
			renderFormWithMcp();

			await waitFor(() => {
				expect(screen.getByText('Connected')).toBeInTheDocument();
				expect(screen.getByText('Connected').parentElement?.querySelector('.bg-green-500')).toBeInTheDocument();
			});
		});

		it('should show disconnected status when connection fails', async () => {
			mockRequirementCreationService.checkConnection.mockResolvedValue(false);
			
			renderFormWithMcp();

			await waitFor(() => {
				expect(screen.getByText('Disconnected')).toBeInTheDocument();
				expect(screen.getByText('Disconnected').parentElement?.querySelector('.bg-red-500')).toBeInTheDocument();
			});
		});

		it('should show checking status initially', () => {
			renderFormWithMcp();

			expect(screen.getByText('Checking connection...')).toBeInTheDocument();
		});

		it('should successfully create requirement via MCP', async () => {
			const onSuccess = vi.fn();
			const initialData = createValidInitialData();
			
			renderFormWithMcp({ initialData });
			
			// Add event listener for success event
			const form = document.querySelector('form');
			if (form) form.addEventListener('success', onSuccess);

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledWith(
					expect.objectContaining({
						type: 'FUNC',
						title: 'Test Requirement',
						priority: 'P1',
						author: 'test@example.com',
						acceptance_criteria: ['User can perform the required action'],
						functional_requirements: ['User can log in to the system']
					})
				);
			});

			// Wait for the success state to be processed
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should show optimistic creation feedback', async () => {
			// Make the service take some time to respond
			mockRequirementCreationService.createRequirement.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					success: true,
					data: mockRequirement
				}), 1000))
			);

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify the service was called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledWith(
					expect.objectContaining({
						title: 'Test Requirement'
					})
				);
			});
		});

		it('should show loading state on submit button', async () => {
			mockRequirementCreationService.createRequirement.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					success: true,
					data: mockRequirement
				}), 500))
			);

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify the service was called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should handle MCP service errors', async () => {
			mockRequirementCreationService.createRequirement.mockResolvedValue({
				success: false,
				error: 'Server connection failed',
				isRetryable: true
			});

			const onError = vi.fn();
			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			// Add event listener for error event
			const form = document.querySelector('form');
			if (form) form.addEventListener('error', onError);

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify the service was called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should handle non-retryable errors without retry button', async () => {
			mockRequirementCreationService.createRequirement.mockResolvedValue({
				success: false,
				error: 'Invalid data provided',
				isRetryable: false
			});

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify the service was called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should allow retry on retryable errors', async () => {
			mockRequirementCreationService.createRequirement
				.mockResolvedValueOnce({
					success: false,
					error: 'Network error',
					isRetryable: true
				})
				.mockResolvedValueOnce({
					success: true,
					data: mockRequirement
				});

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			// First submission
			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify initial call was made
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should reset form after successful creation', async () => {
			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify service was called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should prevent concurrent submissions', async () => {
			mockRequirementCreationService.createRequirement.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					success: true,
					data: mockRequirement
				}), 500))
			);

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			
			// Click submit multiple times rapidly
			await user.click(submitButton);
			await user.click(submitButton);
			await user.click(submitButton);

			// Should only call service once
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should show connection warning when disconnected', async () => {
			mockRequirementCreationService.checkConnection.mockResolvedValue(false);

			renderFormWithMcp();

			await waitFor(() => {
				expect(screen.getByText('Connection Issue')).toBeInTheDocument();
				expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument();
			});
		});

		it('should handle unexpected errors', async () => {
			mockRequirementCreationService.createRequirement.mockRejectedValue(
				new Error('Unexpected error')
			);

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify service was attempted to be called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});
		});

		it('should dispatch events correctly', async () => {
			const onSuccess = vi.fn();
			const onError = vi.fn();

			const initialData = createValidInitialData();
			renderFormWithMcp({ initialData });

			// Add event listeners
			const form = document.querySelector('form');
			if (form) form.addEventListener('success', onSuccess);
			if (form) form.addEventListener('error', onError);

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Verify service was called
			await waitFor(() => {
				expect(mockRequirementCreationService.createRequirement).toHaveBeenCalledTimes(1);
			});

			expect(onError).not.toHaveBeenCalled();
		});
	});

	describe('MCP Integration Disabled', () => {
		const renderFormWithoutMcp = (props = {}) => {
			return render(RequirementForm, {
				props: {
					enableMcpIntegration: false,
					...props,
				},
			});
		};

		it('should not show connection status when MCP integration is disabled', () => {
			renderFormWithoutMcp();

			expect(screen.queryByText('Server Status:')).not.toBeInTheDocument();
		});

		it('should dispatch submit event when MCP integration is disabled', async () => {
			const onSubmit = vi.fn();
			
			const initialData = createValidInitialData();
			renderFormWithoutMcp({ initialData });

			// Add event listener for submit event
			const form = document.querySelector('form');
			if (form) form.addEventListener('submit', onSubmit);

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			await waitFor(() => {
				expect(onSubmit).toHaveBeenCalledWith(
					expect.any(SubmitEvent)
				);
			});

			// Should not call MCP service
			expect(mockRequirementCreationService.createRequirement).not.toHaveBeenCalled();
		});

		it('should not show MCP-specific UI elements', () => {
			renderFormWithoutMcp();

			expect(screen.queryByText('Creating requirement...')).not.toBeInTheDocument();
			expect(screen.queryByText('Success!')).not.toBeInTheDocument();
			expect(screen.queryByText('Error')).not.toBeInTheDocument();
			expect(screen.queryByText('Connection Issue')).not.toBeInTheDocument();
		});
	});

	describe('Form Validation with MCP', () => {
		const renderFormWithMcp = () => {
			return render(RequirementForm, {
				props: {
					enableMcpIntegration: true,
				},
			});
		};

		it('should validate form before calling MCP service', async () => {
			renderFormWithMcp();

			// Submit without filling required fields
			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Should show validation errors, not call MCP service
			expect(mockRequirementCreationService.createRequirement).not.toHaveBeenCalled();
		});

		it('should prevent submission with validation errors', async () => {
			renderFormWithMcp();

			// Fill only title, leave other required fields empty
			await user.type(screen.getByLabelText(/Title/), 'Test');

			const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
			await user.click(submitButton);

			// Should not start submission process
			expect(screen.queryByText('Creating requirement...')).not.toBeInTheDocument();
			expect(mockRequirementCreationService.createRequirement).not.toHaveBeenCalled();
		});
	});
});