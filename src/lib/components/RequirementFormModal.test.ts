// Integration test for RequirementFormModal
// Tests that RequirementForm works correctly within Modal component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RequirementFormModal from './RequirementFormModal.svelte';

// Mock Tiptap Editor for rich text editor integration
const mockEditor = {
	destroy: vi.fn(),
	commands: {
		setContent: vi.fn().mockReturnThis(),
		focus: vi.fn().mockReturnThis(),
		run: vi.fn()
	},
	chain: vi.fn().mockReturnThis(),
	getHTML: vi.fn().mockReturnValue('<p></p>'),
	setEditable: vi.fn(),
	isActive: vi.fn().mockReturnValue(false),
	can: vi.fn().mockReturnValue({
		undo: vi.fn().mockReturnValue(false),
		redo: vi.fn().mockReturnValue(false)
	})
};

vi.mock('@tiptap/core', () => ({
	Editor: vi.fn().mockImplementation(() => mockEditor)
}));

vi.mock('@tiptap/starter-kit', () => ({
	default: {
		configure: vi.fn().mockReturnValue('StarterKit')
	}
}));

vi.mock('@tiptap/extension-placeholder', () => ({
	default: {
		configure: vi.fn().mockReturnValue('Placeholder')
	}
}));

describe('RequirementFormModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render modal with requirement form when open', () => {
		render(RequirementFormModal, {
			props: {
				isOpen: true,
				isSubmitting: false
			}
		});

		// Check that modal is visible with correct title
		expect(screen.getByText('Create New Requirement')).toBeInTheDocument();

		// Check that requirement form fields are present
		expect(screen.getByLabelText('Requirement Type')).toBeInTheDocument();
		expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
		expect(screen.getByLabelText('Priority')).toBeInTheDocument();

		// Check rich text editor fields by their labels and associated editors
		expect(screen.getByText('Current State *')).toBeInTheDocument();
		expect(screen.getByText('Desired State *')).toBeInTheDocument();

		// Check that rich text editor toolbars are present
		const toolbars = screen.getAllByRole('toolbar');
		expect(toolbars.length).toBeGreaterThan(0);

		// Check that rich text editor content areas are present
		const textboxes = screen.getAllByRole('textbox');
		expect(textboxes.length).toBeGreaterThan(0);

		// Check form buttons
		expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Create Requirement/ })).toBeInTheDocument();
	});

	it('should not render modal content when closed', () => {
		render(RequirementFormModal, {
			props: {
				isOpen: false,
				isSubmitting: false
			}
		});

		// Modal content should not be visible
		expect(screen.queryByText('Create New Requirement')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Requirement Type')).not.toBeInTheDocument();
	});

	it('should disable modal interactions when submitting', () => {
		render(RequirementFormModal, {
			props: {
				isOpen: true,
				isSubmitting: true
			}
		});

		// Form should be in submitting state
		expect(screen.getByRole('button', { name: /Creating.../ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Creating.../ })).toBeDisabled();

		// Form fields should be disabled
		expect(screen.getByLabelText('Requirement Type')).toBeDisabled();
		expect(screen.getByLabelText(/Title/)).toBeDisabled();

		// Rich text editor toolbar buttons should be disabled when form is submitting
		const toolbarButtons = screen
			.getAllByRole('button')
			.filter((btn) => btn.title && (btn.title.includes('Bold') || btn.title.includes('Italic')));
		toolbarButtons.forEach((button) => {
			expect(button).toBeDisabled();
		});
	});
});
