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

	// Mock FileReader for file processing tests
	global.FileReader = class MockFileReader {
		readyState: number = 0;
		result: string | ArrayBuffer | null = null;
		error: any = null;
		onload: ((event: any) => void) | null = null;
		onerror: ((event: any) => void) | null = null;
		onabort: ((event: any) => void) | null = null;

		static EMPTY = 0;
		static LOADING = 1;
		static DONE = 2;

		readAsText(file: any, encoding?: string) {
			this.readyState = 1; // LOADING

			// Simulate async file reading
			setTimeout(() => {
				try {
					// For test files, use the file contents directly
					if (file && file.stream) {
						// Handle File objects with stream method
						const reader = file.stream().getReader();
						reader.read().then((result: any) => {
							if (result.value) {
								this.result = new TextDecoder().decode(result.value);
							} else {
								this.result = '';
							}
							this.readyState = 2; // DONE
							if (this.onload) {
								this.onload({ target: this });
							}
						});
					} else if (file && file.constructor && file.constructor.name === 'File') {
						// Handle mock File objects created in tests
						this.result = file.content || file.text || '';
						this.readyState = 2; // DONE
						if (this.onload) {
							this.onload({ target: this });
						}
					} else {
						// Fallback for other file-like objects
						this.result = file?.toString() || '';
						this.readyState = 2; // DONE
						if (this.onload) {
							this.onload({ target: this });
						}
					}
				} catch (error) {
					this.error = error;
					this.readyState = 2; // DONE
					if (this.onerror) {
						this.onerror({ target: this });
					}
				}
			}, 0);
		}

		abort() {
			this.readyState = 2; // DONE
			if (this.onabort) {
				this.onabort({ target: this });
			}
		}
	} as any;

	// Mock File constructor for tests
	global.File = class MockFile {
		name: string;
		size: number;
		type: string;
		lastModified: number;
		content: string;

		constructor(
			parts: (string | Blob | ArrayBuffer | ArrayBufferView)[],
			filename: string,
			options: any = {}
		) {
			this.name = filename;
			this.type = options.type || '';
			this.lastModified = options.lastModified || Date.now();
			this.content = Array.isArray(parts) ? parts.join('') : String(parts);
			this.size = this.content.length;
		}

		text() {
			return Promise.resolve(this.content);
		}

		stream() {
			const encoder = new TextEncoder();
			const data = encoder.encode(this.content);
			return {
				getReader() {
					let sent = false;
					return {
						read() {
							if (sent) {
								return Promise.resolve({ done: true, value: undefined });
							}
							sent = true;
							return Promise.resolve({ done: false, value: data });
						}
					};
				}
			};
		}
	} as any;

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
