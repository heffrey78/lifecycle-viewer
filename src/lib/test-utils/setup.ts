import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Setup DOM environment for testing
beforeAll(() => {
	// Mock ResizeObserver (used by some components)
	global.ResizeObserver = vi.fn().mockImplementation(() => ({
		observe: vi.fn(),
		unobserve: vi.fn(),
		disconnect: vi.fn()
	}));

	// Mock IntersectionObserver
	global.IntersectionObserver = vi.fn().mockImplementation(() => ({
		observe: vi.fn(),
		unobserve: vi.fn(),
		disconnect: vi.fn(),
		root: null,
		rootMargin: '',
		thresholds: []
	}));

	// Mock scrollIntoView
	Element.prototype.scrollIntoView = vi.fn();

	// Mock getBoundingClientRect
	Element.prototype.getBoundingClientRect = vi.fn(() => ({
		bottom: 0,
		height: 0,
		left: 0,
		right: 0,
		top: 0,
		width: 0,
		x: 0,
		y: 0,
		toJSON: vi.fn()
	}));

	// Mock matchMedia
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // deprecated
			removeListener: vi.fn(), // deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		}))
	});

	// Mock getComputedStyle
	Object.defineProperty(window, 'getComputedStyle', {
		writable: true,
		value: vi.fn(() => ({
			getPropertyValue: vi.fn(() => ''),
			setProperty: vi.fn()
		}))
	});

	// Suppress console warnings during tests (optional)
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// Mock TipTap Editor globally for all tests
const createMockEditor = () => ({
	destroy: vi.fn(),
	commands: {
		setContent: vi.fn().mockReturnThis(),
		focus: vi.fn().mockReturnThis()
	},
	chain: vi.fn().mockReturnThis(),
	getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
	setEditable: vi.fn(),
	isActive: vi.fn().mockReturnValue(false),
	can: vi.fn().mockReturnValue({
		undo: vi.fn().mockReturnValue(false),
		redo: vi.fn().mockReturnValue(false)
	})
});

vi.mock('@tiptap/core', () => ({
	Editor: vi.fn().mockImplementation((config) => {
		const mockEditor = createMockEditor();

		// Call lifecycle callbacks if provided
		setTimeout(() => {
			if (config?.onCreate) config.onCreate();
			if (config?.onTransaction) config.onTransaction();
			if (config?.onUpdate) config.onUpdate({ editor: mockEditor });
		}, 0);

		return mockEditor;
	})
}));

vi.mock('@tiptap/starter-kit', () => ({
	default: { configure: vi.fn().mockReturnValue('StarterKit') }
}));

vi.mock('@tiptap/extension-placeholder', () => ({
	default: { configure: vi.fn().mockReturnValue('Placeholder') }
}));

// Global test utilities
export function createMockEvent(type: string, options: any = {}): Event {
	return new Event(type, { bubbles: true, cancelable: true, ...options });
}

export function createMockKeyboardEvent(
	type: string,
	key: string,
	options: any = {}
): KeyboardEvent {
	return new KeyboardEvent(type, {
		bubbles: true,
		cancelable: true,
		key,
		code: key,
		...options
	});
}

export function createMockMouseEvent(type: string, options: any = {}): MouseEvent {
	return new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: 0,
		clientY: 0,
		...options
	});
}
