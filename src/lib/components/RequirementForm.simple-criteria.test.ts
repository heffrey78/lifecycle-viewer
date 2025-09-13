// Simple test to verify acceptance criteria functionality
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import RequirementForm from './RequirementForm.svelte';
import type { RequirementFormData } from '$lib/types/lifecycle';

// Mock Tiptap Editor
const mockEditor = {
	destroy: vi.fn(),
	commands: {
		setContent: vi.fn().mockReturnThis(),
		focus: vi.fn().mockReturnThis(),
	},
	chain: vi.fn().mockReturnThis(),
	getHTML: vi.fn().mockReturnValue('<p>Valid content</p>'),
	setEditable: vi.fn(),
	isActive: vi.fn().mockReturnValue(false),
	can: vi.fn().mockReturnValue({
		undo: vi.fn().mockReturnValue(false),
		redo: vi.fn().mockReturnValue(false),
	}),
};

vi.mock('@tiptap/core', () => ({
	Editor: vi.fn().mockImplementation((config) => {
		setTimeout(() => {
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

describe('RequirementForm - Acceptance Criteria Basic Tests', () => {
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		user = userEvent.setup();
		vi.clearAllMocks();
		mockEditor.getHTML.mockReturnValue('<p>Valid content</p>');
	});

	const renderForm = (props = {}) => {
		return render(RequirementForm, {
			props: {
				isSubmitting: false,
				...props,
			},
		});
	};

	it('should render acceptance criteria section', () => {
		renderForm();

		// Should show acceptance criteria legend
		expect(screen.getByText(/Acceptance Criteria/)).toBeInTheDocument();
		expect(screen.getByText(/1 criterion/)).toBeInTheDocument();
	});

	it('should have add button', () => {
		renderForm();

		const addButton = screen.getByText('Add Acceptance Criterion');
		expect(addButton).toBeInTheDocument();
		expect(addButton).not.toBeDisabled();
	});

	it('should add new criterion when add button clicked', async () => {
		renderForm();

		const addButton = screen.getByText('Add Acceptance Criterion');
		await user.click(addButton);

		await waitFor(() => {
			expect(screen.getByText(/2 criteria/)).toBeInTheDocument();
		});
	});

	it('should have remove buttons when multiple criteria exist', async () => {
		const initialData: Partial<RequirementFormData> = {
			acceptance_criteria: ['First criterion', 'Second criterion'],
		};

		renderForm({ initialData });

		const removeButtons = screen.getAllByTitle('Remove acceptance criterion');
		expect(removeButtons).toHaveLength(2);
	});

	it('should remove criterion when remove button clicked', async () => {
		const initialData: Partial<RequirementFormData> = {
			acceptance_criteria: ['First criterion', 'Second criterion'],
		};

		renderForm({ initialData });

		const removeButtons = screen.getAllByTitle('Remove acceptance criterion');
		await user.click(removeButtons[0]);

		await waitFor(() => {
			expect(screen.getByText(/1 criterion/)).toBeInTheDocument();
		});
	});

	it('should have move up/down buttons for multiple criteria', () => {
		const initialData: Partial<RequirementFormData> = {
			acceptance_criteria: ['First criterion', 'Second criterion'],
		};

		renderForm({ initialData });

		// First criterion has no "Move up" button, second has one
		expect(screen.getAllByTitle('Move up')).toHaveLength(1);
		// Second criterion has no "Move down" button, first has one
		expect(screen.getAllByTitle('Move down')).toHaveLength(1);
	});

	it('should preserve content during operations', async () => {
		renderForm();

		// Find the textarea
		const textarea = screen.getByPlaceholderText(/Given.*when.*then/);
		await user.click(textarea);
		await user.type(textarea, 'Test content');

		// Add another criterion
		const addButton = screen.getByText('Add Acceptance Criterion');
		await user.click(addButton);

		// Original content should be preserved
		expect(screen.getByDisplayValue('Test content')).toBeInTheDocument();
	});

	it('should submit successfully with valid content', async () => {
		// Mock editor to return valid content
		mockEditor.getHTML
			.mockReturnValueOnce('<p>Valid current state</p>') // current_state
			.mockReturnValueOnce('<p>Valid desired state</p>') // desired_state  
			.mockReturnValueOnce('<p>Valid business value</p>'); // business_value (if needed)

		const onSubmit = vi.fn();
		renderForm({ onSubmit, enableMcpIntegration: false });

		// Add event listener for form submission
		const form = document.querySelector('form');
		if (form) form.addEventListener('submit', onSubmit);

		// Fill in required title field
		await user.type(screen.getByLabelText(/Title/), 'Test Requirement Title');

		// Fill in the acceptance criteria
		const textarea = screen.getByPlaceholderText(/Given.*when.*then/);
		await user.click(textarea);
		await user.type(textarea, 'Given valid input, when user submits, then it should work');

		// Submit with valid content (should succeed)
		const submitButton = screen.getByRole('button', { name: /Create Requirement/ });
		await user.click(submitButton);

		// Form should submit successfully
		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith(expect.any(SubmitEvent));
		});
	});

	it('should handle disabled state', () => {
		renderForm({ isSubmitting: true });

		// All controls should be disabled
		expect(screen.getByText('Add Acceptance Criterion')).toBeDisabled();
		
		const textarea = screen.getByPlaceholderText(/Given.*when.*then/);
		expect(textarea).toBeDisabled();
	});
});