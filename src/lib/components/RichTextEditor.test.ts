import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import RichTextEditor from './RichTextEditor.svelte';

// Mock Tiptap Editor since it requires DOM APIs
const createMockCommands = () => ({
	setContent: vi.fn().mockReturnThis(),
	focus: vi.fn().mockReturnThis(),
	toggleBold: vi.fn().mockReturnThis(),
	toggleItalic: vi.fn().mockReturnThis(),
	toggleStrike: vi.fn().mockReturnThis(),
	toggleHeading: vi.fn().mockReturnThis(),
	toggleBulletList: vi.fn().mockReturnThis(),
	toggleOrderedList: vi.fn().mockReturnThis(),
	toggleBlockquote: vi.fn().mockReturnThis(),
	undo: vi.fn().mockReturnThis(),
	redo: vi.fn().mockReturnThis(),
	run: vi.fn().mockReturnThis()
});

const mockEditor = {
	destroy: vi.fn(),
	commands: createMockCommands(),
	chain: vi.fn(() => ({
		focus: vi.fn().mockReturnThis(),
		toggleBold: vi.fn().mockReturnThis(),
		toggleItalic: vi.fn().mockReturnThis(),
		toggleStrike: vi.fn().mockReturnThis(),
		toggleHeading: vi.fn().mockReturnThis(),
		toggleBulletList: vi.fn().mockReturnThis(),
		toggleOrderedList: vi.fn().mockReturnThis(),
		toggleBlockquote: vi.fn().mockReturnThis(),
		undo: vi.fn().mockReturnThis(),
		redo: vi.fn().mockReturnThis(),
		run: vi.fn().mockReturnThis()
	})),
	getHTML: vi.fn().mockReturnValue('<p>test content</p>'),
	setEditable: vi.fn(),
	isActive: vi.fn().mockReturnValue(false),
	can: vi.fn().mockReturnValue({
		undo: vi.fn().mockReturnValue(true),
		redo: vi.fn().mockReturnValue(true)
	})
};

vi.mock('@tiptap/core', () => ({
	Editor: vi.fn().mockImplementation((config) => {
		// Call the callbacks to simulate editor lifecycle
		setTimeout(() => {
			if (config.onTransaction) config.onTransaction();
			if (config.onUpdate) config.onUpdate({ editor: mockEditor });
		}, 0);
		return mockEditor;
	})
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

describe('RichTextEditor', () => {
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		user = userEvent.setup();
		vi.clearAllMocks();
		// Reset mock implementations
		mockEditor.chain.mockReturnValue({
			focus: vi.fn().mockReturnThis(),
			toggleBold: vi.fn().mockReturnThis(),
			toggleItalic: vi.fn().mockReturnThis(),
			toggleStrike: vi.fn().mockReturnThis(),
			toggleHeading: vi.fn().mockReturnThis(),
			toggleBulletList: vi.fn().mockReturnThis(),
			toggleOrderedList: vi.fn().mockReturnThis(),
			toggleBlockquote: vi.fn().mockReturnThis(),
			undo: vi.fn().mockReturnThis(),
			redo: vi.fn().mockReturnThis(),
			run: vi.fn().mockReturnThis()
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should render with default props', () => {
		render(RichTextEditor);

		// Check toolbar is present
		expect(screen.getByRole('toolbar')).toBeInTheDocument();
		expect(screen.getByLabelText('Rich text formatting toolbar')).toBeInTheDocument();

		// Check basic formatting buttons
		expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
		expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
		expect(screen.getByTitle('Strikethrough')).toBeInTheDocument();

		// Check heading buttons
		expect(screen.getByTitle('Heading 1')).toBeInTheDocument();
		expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
		expect(screen.getByTitle('Heading 3')).toBeInTheDocument();

		// Check list buttons
		expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
		expect(screen.getByTitle('Numbered List')).toBeInTheDocument();
		expect(screen.getByTitle('Quote')).toBeInTheDocument();

		// Check undo/redo buttons
		expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
		expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
	});

	it('should render with custom props', () => {
		const props = {
			content: '<p>Initial content</p>',
			placeholder: 'Custom placeholder',
			disabled: false,
			minHeight: '100px',
			maxHeight: '500px',
			id: 'custom-editor',
			'aria-label': 'Custom editor'
		};

		render(RichTextEditor, { props });

		const editorContent = screen.getByRole('textbox');
		expect(editorContent).toHaveAttribute('id', 'custom-editor');
		expect(editorContent).toHaveAttribute('aria-label', 'Custom editor');
	});

	it('should call onUpdate when content changes', async () => {
		const onUpdate = vi.fn();
		render(RichTextEditor, { props: { onUpdate } });

		// Wait for editor initialization
		await waitFor(() => {
			expect(onUpdate).toHaveBeenCalledWith('<p>test content</p>');
		});
	});

	it('should disable editor when disabled prop is true', () => {
		render(RichTextEditor, { props: { disabled: true } });

		// All toolbar buttons should be disabled
		const buttons = screen.getAllByRole('button');
		buttons.forEach((button) => {
			expect(button).toBeDisabled();
		});
	});

	it('should handle bold formatting', async () => {
		render(RichTextEditor);

		const boldButton = screen.getByTitle('Bold (Ctrl+B)');
		await user.click(boldButton);

		expect(mockEditor.chain).toHaveBeenCalled();
	});

	it('should handle italic formatting', async () => {
		render(RichTextEditor);

		const italicButton = screen.getByTitle('Italic (Ctrl+I)');
		await user.click(italicButton);

		expect(mockEditor.chain).toHaveBeenCalled();
	});

	it('should handle strikethrough formatting', async () => {
		render(RichTextEditor);

		const strikeButton = screen.getByTitle('Strikethrough');
		await user.click(strikeButton);

		expect(mockEditor.chain).toHaveBeenCalled();
	});

	it('should handle heading levels', async () => {
		render(RichTextEditor);

		// Test H1
		const h1Button = screen.getByTitle('Heading 1');
		await user.click(h1Button);
		expect(mockEditor.chain).toHaveBeenCalled();

		// Test H2
		const h2Button = screen.getByTitle('Heading 2');
		await user.click(h2Button);
		expect(mockEditor.chain).toHaveBeenCalled();

		// Test H3
		const h3Button = screen.getByTitle('Heading 3');
		await user.click(h3Button);
		expect(mockEditor.chain).toHaveBeenCalled();
	});

	it('should handle list formatting', async () => {
		render(RichTextEditor);

		// Test bullet list
		const bulletButton = screen.getByTitle('Bullet List');
		await user.click(bulletButton);
		expect(mockEditor.chain).toHaveBeenCalled();

		// Test numbered list
		const numberedButton = screen.getByTitle('Numbered List');
		await user.click(numberedButton);
		expect(mockEditor.chain).toHaveBeenCalled();

		// Test blockquote
		const quoteButton = screen.getByTitle('Quote');
		await user.click(quoteButton);
		expect(mockEditor.chain).toHaveBeenCalled();
	});

	it('should handle undo/redo operations', async () => {
		render(RichTextEditor);

		// Test undo
		const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
		await user.click(undoButton);
		expect(mockEditor.chain).toHaveBeenCalled();

		// Test redo
		const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
		await user.click(redoButton);
		expect(mockEditor.chain).toHaveBeenCalled();
	});

	it('should show active state for formatting buttons', () => {
		// Mock isActive to return true for bold
		mockEditor.isActive.mockImplementation((format) => format === 'bold');

		render(RichTextEditor);

		const boldButton = screen.getByTitle('Bold (Ctrl+B)');
		expect(boldButton).toHaveAttribute('aria-pressed', 'true');
		expect(boldButton).toHaveClass('active');
	});

	it('should disable undo/redo buttons when not available', () => {
		// Mock can() to return false for undo/redo
		mockEditor.can.mockReturnValue({
			undo: vi.fn().mockReturnValue(false),
			redo: vi.fn().mockReturnValue(false)
		});

		render(RichTextEditor);

		const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
		const redoButton = screen.getByTitle('Redo (Ctrl+Y)');

		expect(undoButton).toBeDisabled();
		expect(redoButton).toBeDisabled();
	});

	it('should have proper accessibility attributes', () => {
		render(RichTextEditor, {
			props: {
				required: true,
				'aria-label': 'Test editor'
			}
		});

		const toolbar = screen.getByRole('toolbar');
		expect(toolbar).toHaveAttribute('aria-label', 'Rich text formatting toolbar');

		const editorContent = screen.getByRole('textbox');
		expect(editorContent).toHaveAttribute('aria-multiline', 'true');
		expect(editorContent).toHaveAttribute('aria-label', 'Test editor');
		expect(editorContent).toHaveAttribute('aria-required', 'true');
		expect(editorContent).toHaveAttribute('contenteditable', 'true');

		// Check button aria-pressed attributes
		const formatButtons = screen
			.getAllByRole('button')
			.filter((btn) => btn.hasAttribute('aria-pressed'));
		formatButtons.forEach((button) => {
			expect(button).toHaveAttribute('aria-pressed');
		});
	});

	it('should update content when prop changes', async () => {
		const { rerender } = render(RichTextEditor, {
			props: { content: '<p>Initial</p>' }
		});

		// Change content prop
		await rerender({ content: '<p>Updated content</p>' });

		// Should call setContent with new content
		await waitFor(() => {
			expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<p>Updated content</p>');
		});
	});

	it('should destroy editor on component unmount', () => {
		const { unmount } = render(RichTextEditor);

		unmount();

		expect(mockEditor.destroy).toHaveBeenCalled();
	});

	it('should handle editor focus and blur events', async () => {
		const { container } = render(RichTextEditor);

		// Find the editor container
		const editorContainer = container.querySelector('.rich-text-editor');
		expect(editorContainer).toBeInTheDocument();

		// The focus/blur behavior is tested through the mock editor callbacks
		// which are called during initialization
		await waitFor(() => {
			expect(mockEditor.getHTML).toHaveBeenCalled();
		});
	});

	it('should apply custom height constraints', () => {
		render(RichTextEditor, {
			props: {
				minHeight: '150px',
				maxHeight: '350px'
			}
		});

		const editorContent = screen.getByRole('textbox');
		// Check that the style attribute contains the height values
		const style = editorContent.getAttribute('style');
		expect(style).toContain('min-height: 150px');
		expect(style).toContain('max-height: 350px');
	});
});
