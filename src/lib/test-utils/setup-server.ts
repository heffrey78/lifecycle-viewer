import { beforeAll, afterEach, vi } from 'vitest';

// Type definitions for browser APIs in Node environment
interface CloseEventInit extends EventInit {
	code?: number;
	reason?: string;
	wasClean?: boolean;
}

interface MessageEventInit extends EventInit {
	data?: any;
	origin?: string;
	lastEventId?: string;
	source?: any;
}

// Extend global namespace for Node environment
declare global {
	var CloseEvent: typeof CloseEvent;
	var MessageEvent: typeof MessageEvent;
	var Event: typeof Event;
}

// Server-side test setup (Node environment)
beforeAll(() => {
	// Mock global objects that may be referenced in server tests
	global.console = console;

	// Mock browser APIs for WebSocket tests
	global.CloseEvent = class CloseEvent extends Event {
		code: number;
		reason: string;
		wasClean: boolean;
		
		constructor(type: string, eventInitDict?: CloseEventInit) {
			super(type, eventInitDict);
			this.code = eventInitDict?.code ?? 1000;
			this.reason = eventInitDict?.reason ?? '';
			this.wasClean = eventInitDict?.wasClean ?? true;
		}
	};

	global.MessageEvent = class MessageEvent extends Event {
		data: any;
		origin: string;
		lastEventId: string;
		source: any;
		
		constructor(type: string, eventInitDict?: MessageEventInit) {
			super(type, eventInitDict);
			this.data = eventInitDict?.data;
			this.origin = eventInitDict?.origin ?? '';
			this.lastEventId = eventInitDict?.lastEventId ?? '';
			this.source = eventInitDict?.source ?? null;
		}
	};

	global.Event = class Event {
		type: string;
		bubbles: boolean;
		cancelable: boolean;
		defaultPrevented: boolean = false;
		
		constructor(type: string, eventInitDict?: EventInit) {
			this.type = type;
			this.bubbles = eventInitDict?.bubbles ?? false;
			this.cancelable = eventInitDict?.cancelable ?? false;
		}
		
		preventDefault() {
			this.defaultPrevented = true;
		}
		
		stopPropagation() {}
		stopImmediatePropagation() {}
	};

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
