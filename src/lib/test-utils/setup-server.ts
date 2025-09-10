import { beforeAll, afterEach, vi } from 'vitest';

// Server-side test setup (Node environment)
beforeAll(() => {
	// Mock global objects that may be referenced in server tests
	global.console = console;

	// Suppress console warnings during tests (optional)
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	// Clear any vi mocks between tests
	vi.clearAllMocks();
});

// Server test utilities
export function createMockEvent(type: string, options: any = {}): Event {
	// For server tests, return a minimal mock event
	return {
		type,
		...options,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn()
	} as any;
}
