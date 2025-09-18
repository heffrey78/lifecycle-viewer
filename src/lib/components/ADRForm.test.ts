import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ADRForm from './ADRForm.svelte';
import type { ADRFormData } from '$lib/types/lifecycle';

// Mock dependencies
vi.mock('$lib/services/adr-creation.js', () => ({
	adrCreationService: {
		checkConnection: vi.fn().mockResolvedValue(true),
		getApprovedRequirements: vi.fn().mockResolvedValue({
			success: true,
			data: [
				{
					id: 'REQ-0001-FUNC-01',
					title: 'Test Requirement',
					status: 'Approved',
					type: 'FUNC'
				}
			]
		}),
		createADR: vi.fn().mockResolvedValue({
			success: true,
			data: {
				id: 'ADR-0001',
				title: 'Test ADR',
				type: 'ADR',
				status: 'Draft'
			}
		})
	}
}));

vi.mock('$lib/validation/index.js', () => ({
	validationUtils: {
		createArchitectureValidator: vi.fn().mockResolvedValue({
			validateForm: vi.fn().mockResolvedValue({ isValid: true, errors: {} })
		})
	},
	FormValidator: vi.fn(),
	DebouncedValidator: vi.fn().mockImplementation(() => ({
		validateFieldDebounced: vi.fn(),
		cancel: vi.fn()
	}))
}));

vi.mock('$lib/utils/html-sanitizer.js', () => ({
	stripHtmlForValidation: vi.fn((input) => input)
}));

vi.mock('$lib/theme', () => ({
	currentTheme: {
		subscribe: vi.fn((callback) => {
			callback({
				base: {
					background: '#ffffff',
					foreground: '#000000',
					border: '#e5e7eb',
					muted: '#6b7280'
				}
			});
			return {
				unsubscribe: vi.fn()
			};
		})
	},
	getArchitectureStatusColorClasses: vi.fn(() => 'text-gray-700 bg-gray-100 border-gray-300')
}));

// Mock RichTextEditor component
vi.mock('./RichTextEditor.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { on_mount: [], on_destroy: [] },
		$set: vi.fn(),
		$on: vi.fn()
	}))
}));

describe('ADRForm', () => {
	let mockAdrCreationService: any;

	const defaultFormData: Partial<ADRFormData> = {
		type: 'ADR',
		title: 'Test ADR Title',
		context: 'Test context description',
		decision_outcome: 'Test decision outcome',
		authors: ['test@example.com'],
		decision_drivers: ['Performance requirement'],
		considered_options: ['Option 1', 'Option 2'],
		consequences: {
			good: ['Good consequence'],
			bad: ['Bad consequence'],
			neutral: ['Neutral consequence']
		},
		requirement_ids: ['REQ-0001-FUNC-01']
	};

	beforeEach(async () => {
		// Get the mocked service
		const { adrCreationService } = await import('$lib/services/adr-creation.js');
		mockAdrCreationService = adrCreationService;

		vi.clearAllMocks();

		// Reset mock implementations
		mockAdrCreationService.checkConnection.mockResolvedValue(true);
		mockAdrCreationService.getApprovedRequirements.mockResolvedValue({
			success: true,
			data: [
				{
					id: 'REQ-0001-FUNC-01',
					title: 'Test Requirement',
					status: 'Approved',
					type: 'FUNC'
				}
			]
		});
		mockAdrCreationService.createADR.mockResolvedValue({
			success: true,
			data: {
				id: 'ADR-0001',
				title: 'Test ADR',
				type: 'ADR',
				status: 'Draft'
			}
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Form Rendering', () => {
		it('renders all required form fields', async () => {
			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: false
				}
			});

			// Check for form fields
			expect(screen.getByLabelText(/ADR Type/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
			expect(screen.getByText('Context *')).toBeInTheDocument();
			expect(screen.getByText(/Decision Drivers/i)).toBeInTheDocument();
			expect(screen.getByText(/Considered Options/i)).toBeInTheDocument();
			expect(screen.getByText(/Decision Outcome/i)).toBeInTheDocument();
			expect(screen.getByRole('group', { name: /Consequences/i })).toBeInTheDocument();
			expect(screen.getByText(/Authors/i)).toBeInTheDocument();
			expect(screen.getByText(/Linked Requirements/i)).toBeInTheDocument();
		});

		it('populates form with initial data', async () => {
			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: false
				}
			});

			const titleInput = screen.getByDisplayValue('Test ADR Title');
			expect(titleInput).toBeInTheDocument();

			const authorInput = screen.getByDisplayValue('test@example.com');
			expect(authorInput).toBeInTheDocument();
		});

		it('shows MCP connection status when enabled', async () => {
			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			await waitFor(() => {
				expect(screen.getByText(/Connected to MCP Server/i)).toBeInTheDocument();
			});
		});

		it('does not show MCP connection status when disabled', () => {
			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: false
				}
			});

			expect(screen.queryByText(/Connected to MCP Server/i)).not.toBeInTheDocument();
		});
	});

	describe('Form Interactions', () => {
		it('allows adding and removing decision drivers', async () => {
			render(ADRForm, {
				props: {
					initialData: { ...defaultFormData, decision_drivers: ['Initial driver'] },
					enableMcpIntegration: false
				}
			});

			// Add new driver
			const addButton = screen.getByText('+ Add Decision Driver');
			await fireEvent.click(addButton);

			const driverInputs = screen.getAllByPlaceholderText(/What drove this decision/i);
			expect(driverInputs).toHaveLength(2);

			// Remove driver
			const removeButtons = screen.getAllByText('Remove');
			await fireEvent.click(removeButtons[0]);

			// Should have one less input
			const updatedDriverInputs = screen.getAllByPlaceholderText(/What drove this decision/i);
			expect(updatedDriverInputs).toHaveLength(1);
		});

		it('allows adding and removing considered options', async () => {
			render(ADRForm, {
				props: {
					initialData: { ...defaultFormData, considered_options: ['Option 1', 'Option 2'] },
					enableMcpIntegration: false
				}
			});

			// Add new option
			const addButton = screen.getByText('+ Add Option');
			await fireEvent.click(addButton);

			const optionInputs = screen.getAllByPlaceholderText(/Option \d+: Describe the alternative/i);
			expect(optionInputs).toHaveLength(3);
		});

		it('allows adding and removing consequences', async () => {
			render(ADRForm, {
				props: {
					initialData: {
						...defaultFormData,
						consequences: {
							good: ['Good consequence'],
							bad: ['Bad consequence'],
							neutral: ['Neutral consequence']
						}
					},
					enableMcpIntegration: false
				}
			});

			// Add good consequence
			const addGoodButton = screen.getByText('+ Add Good Consequence');
			await fireEvent.click(addGoodButton);

			const goodInputs = screen.getAllByPlaceholderText(/Positive outcome/i);
			expect(goodInputs).toHaveLength(2);

			// Add bad consequence
			const addBadButton = screen.getByText('+ Add Bad Consequence');
			await fireEvent.click(addBadButton);

			const badInputs = screen.getAllByPlaceholderText(/Negative outcome/i);
			expect(badInputs).toHaveLength(2);
		});

		it('allows adding and removing authors', async () => {
			render(ADRForm, {
				props: {
					initialData: { ...defaultFormData, authors: ['test@example.com'] },
					enableMcpIntegration: false
				}
			});

			// Add new author
			const addButton = screen.getByText('+ Add Author');
			await fireEvent.click(addButton);

			const authorInputs = screen.getAllByPlaceholderText(/Author email address/i);
			expect(authorInputs).toHaveLength(2);
		});
	});

	describe('Form Submission', () => {
		it('dispatches submit event with form data when MCP integration is disabled', async () => {
			const component = render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: false
				}
			});

			const submitHandler = vi.fn();
			component.component.$on('submit', submitHandler);

			const submitButton = screen.getByText('Create ADR');
			await fireEvent.click(submitButton);

			expect(submitHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					detail: expect.objectContaining({
						title: 'Test ADR Title',
						type: 'ADR'
					})
				})
			);
		});

		it('calls ADR creation service when MCP integration is enabled', async () => {

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			const submitButton = screen.getByText('Create ADR');
			await fireEvent.click(submitButton);

			await waitFor(() => {
				expect(mockAdrCreationService.createADR).toHaveBeenCalledWith(
					expect.objectContaining({
						title: 'Test ADR Title',
						type: 'ADR'
					})
				);
			});
		});

		it('dispatches success event when ADR creation succeeds', async () => {
			const component = render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			const successHandler = vi.fn();
			component.component.$on('success', successHandler);

			const submitButton = screen.getByText('Create ADR');
			await fireEvent.click(submitButton);

			await waitFor(() => {
				expect(successHandler).toHaveBeenCalledWith(
					expect.objectContaining({
						detail: expect.objectContaining({
							adr: expect.objectContaining({
								id: 'ADR-0001',
								title: 'Test ADR'
							})
						})
					})
				);
			});
		});

		it('dispatches error event when ADR creation fails', async () => {
			mockAdrCreationService.createADR.mockResolvedValueOnce({
				success: false,
				error: 'Creation failed',
				isRetryable: true
			});

			const component = render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			const errorHandler = vi.fn();
			component.component.$on('error', errorHandler);

			const submitButton = screen.getByText('Create ADR');
			await fireEvent.click(submitButton);

			await waitFor(() => {
				expect(errorHandler).toHaveBeenCalledWith(
					expect.objectContaining({
						detail: expect.objectContaining({
							error: 'Creation failed',
							isRetryable: true
						})
					})
				);
			});
		});

		it('disables form submission when already submitting', async () => {
			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: false,
					isSubmitting: true
				}
			});

			const submitButton = screen.getByText('Creating...');
			expect(submitButton).toBeDisabled();
		});
	});

	describe('Cancel Functionality', () => {
		it('dispatches cancel event when cancel button is clicked', async () => {
			const component = render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: false
				}
			});

			const cancelHandler = vi.fn();
			component.component.$on('cancel', cancelHandler);

			const cancelButton = screen.getByText('Cancel');
			await fireEvent.click(cancelButton);

			expect(cancelHandler).toHaveBeenCalled();
		});
	});

	describe('Requirements Selection', () => {
		it('loads and displays available requirements when MCP is enabled', async () => {
			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Test Requirement')).toBeInTheDocument();
				expect(screen.getByText('REQ-0001-FUNC-01 | FUNC | Approved')).toBeInTheDocument();
			});
		});

		it('shows loading state while fetching requirements', async () => {
			mockAdrCreationService.getApprovedRequirements.mockReturnValueOnce(
				new Promise(resolve => setTimeout(() => resolve({ success: true, data: [] }), 100))
			);

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			expect(screen.getByText('Loading requirements...')).toBeInTheDocument();
		});

		it('shows message when no requirements are available', async () => {
			mockAdrCreationService.getApprovedRequirements.mockResolvedValueOnce({
				success: true,
				data: []
			});

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			await waitFor(() => {
				expect(screen.getByText(/No approved requirements available/i)).toBeInTheDocument();
			});
		});
	});

	describe('Validation', () => {
		it('shows character count for title field', () => {
			render(ADRForm, {
				props: {
					initialData: { ...defaultFormData, title: 'Test' },
					enableMcpIntegration: false
				}
			});

			expect(screen.getByText('4/200 characters')).toBeInTheDocument();
		});

		it('updates character count as user types in title', async () => {
			render(ADRForm, {
				props: {
					initialData: { ...defaultFormData, title: '' },
					enableMcpIntegration: false
				}
			});

			const titleInput = screen.getByLabelText(/Title/i);
			await fireEvent.input(titleInput, { target: { value: 'New title' } });

			expect(screen.getByText('9/200 characters')).toBeInTheDocument();
		});
	});

	describe('Connection Status', () => {
		it('shows retry button when disconnected', async () => {
			mockAdrCreationService.checkConnection.mockResolvedValueOnce(false);

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Retry')).toBeInTheDocument();
			});
		});

		it('retries connection when retry button is clicked', async () => {
			mockAdrCreationService.checkConnection
				.mockResolvedValueOnce(false)
				.mockResolvedValueOnce(true);

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			await waitFor(() => {
				const retryButton = screen.getByText('Retry');
				fireEvent.click(retryButton);
			});

			await waitFor(() => {
				expect(mockAdrCreationService.checkConnection).toHaveBeenCalledTimes(2);
			});
		});
	});

	describe('Error Handling', () => {
		it('shows error message when submission fails', async () => {
			mockAdrCreationService.createADR.mockResolvedValueOnce({
				success: false,
				error: 'Validation failed',
				isRetryable: false
			});

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			const submitButton = screen.getByText('Create ADR');
			await fireEvent.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText('Validation failed')).toBeInTheDocument();
			});
		});

		it('shows retry button for retryable errors', async () => {
			mockAdrCreationService.createADR.mockResolvedValueOnce({
				success: false,
				error: 'Network error',
				isRetryable: true
			});

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			const submitButton = screen.getByText('Create ADR');
			await fireEvent.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText('Try again')).toBeInTheDocument();
			});
		});

		it('shows connection warning when disconnected', async () => {
			mockAdrCreationService.checkConnection.mockResolvedValueOnce(false);

			render(ADRForm, {
				props: {
					initialData: defaultFormData,
					enableMcpIntegration: true
				}
			});

			await waitFor(() => {
				expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
			});
		});
	});
});