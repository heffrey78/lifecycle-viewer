import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager, type ConnectionEvent } from './connection-manager.js';

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.CONNECTING;
	url: string;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;

	constructor(url: string) {
		this.url = url;
	}

	send(data: string): void {
		if (this.readyState !== MockWebSocket.OPEN) {
			throw new Error('WebSocket is not open');
		}
	}

	close(): void {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(new CloseEvent('close', { code: 1000 }));
		}
	}

	simulateOpen(): void {
		this.readyState = MockWebSocket.OPEN;
		if (this.onopen) {
			this.onopen(new Event('open'));
		}
	}

	simulateError(): void {
		if (this.onerror) {
			this.onerror(new Event('error'));
		}
	}

	simulateMessage(data: any): void {
		if (this.onmessage) {
			this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
		}
	}

	simulateClose(code = 1000, reason = ''): void {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(new CloseEvent('close', { code, reason }));
		}
	}
}

// Mock global WebSocket
const originalWebSocket = global.WebSocket;
beforeEach(() => {
	global.WebSocket = MockWebSocket as any;
});

afterEach(() => {
	global.WebSocket = originalWebSocket;
	vi.clearAllMocks();
});

describe('ConnectionManager', () => {
	let connectionManager: ConnectionManager;
	let mockOnMessage: vi.Mock;
	let events: ConnectionEvent[] = [];

	beforeEach(() => {
		connectionManager = new ConnectionManager('ws://localhost:3000/test');
		mockOnMessage = vi.fn();
		events = [];

		// Capture all events
		connectionManager.addListener((event) => events.push(event));
	});

	afterEach(() => {
		connectionManager.disconnect();
	});

	describe('Connection Lifecycle', () => {
		it('should create WebSocket with correct URL', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);

			// Simulate successful connection
			const mockWs = (connectionManager as any).ws as MockWebSocket;
			expect(mockWs.url).toBe('ws://localhost:3000/test');

			mockWs.simulateOpen();
			await connectPromise;

			expect(connectionManager.isConnected()).toBe(true);
		});

		it('should handle connection state transitions correctly', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;

			expect(connectionManager.isConnected()).toBe(false);

			mockWs.simulateOpen();
			await connectPromise;

			expect(connectionManager.isConnected()).toBe(true);
			expect(events).toContainEqual({
				type: 'connected',
				message: 'Connected to ws://localhost:3000/test'
			});
		});

		it('should handle disconnection properly', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;

			mockWs.simulateOpen();
			await connectPromise;

			connectionManager.disconnect();

			expect(connectionManager.isConnected()).toBe(false);
		});

		it('should prevent multiple concurrent connections', async () => {
			const connectPromise1 = connectionManager.connect(mockOnMessage);
			const connectPromise2 = connectionManager.connect(mockOnMessage);

			// Both should return the same promise
			expect(connectPromise1).toBe(connectPromise2);

			const mockWs = (connectionManager as any).ws as MockWebSocket;
			mockWs.simulateOpen();
			await connectPromise1;
		});

		it('should reset connection promise after disconnect', async () => {
			const connectPromise1 = connectionManager.connect(mockOnMessage);
			const mockWs1 = (connectionManager as any).ws as MockWebSocket;

			mockWs1.simulateOpen();
			await connectPromise1;

			connectionManager.disconnect();

			// New connection should create new promise
			const connectPromise2 = connectionManager.connect(mockOnMessage);
			expect(connectPromise1).not.toBe(connectPromise2);

			const mockWs2 = (connectionManager as any).ws as MockWebSocket;
			mockWs2.simulateOpen();
			await connectPromise2;
		});
	});

	describe('Message Handling', () => {
		it('should parse and forward valid JSON messages', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;

			mockWs.simulateOpen();
			await connectPromise;

			const testMessage = { id: 1, result: { success: true } };
			mockWs.simulateMessage(testMessage);

			expect(mockOnMessage).toHaveBeenCalledWith(testMessage);
		});

		it('should handle malformed JSON messages gracefully', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;

			mockWs.simulateOpen();
			await connectPromise;

			// Simulate malformed JSON by directly calling onmessage with invalid data
			if (mockWs.onmessage) {
				mockWs.onmessage(new MessageEvent('message', { data: 'invalid json' }));
			}

			// Should emit error event
			expect(events).toContainEqual({
				type: 'error',
				message: 'Invalid message format',
				error: expect.any(SyntaxError)
			});
		});

		it('should send messages when connected', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;
			const sendSpy = vi.spyOn(mockWs, 'send');

			mockWs.simulateOpen();
			await connectPromise;

			const message = { id: 1, method: 'test' };
			connectionManager.send(message);

			expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
		});

		it('should throw error when sending while disconnected', () => {
			const message = { id: 1, method: 'test' };

			expect(() => connectionManager.send(message)).toThrow('Not connected to WebSocket');
		});
	});

	describe('Error Handling', () => {
		it('should classify recoverable errors correctly', () => {
			const isRecoverable = (connectionManager as any).isRecoverableError.bind(connectionManager);

			// JSON-RPC server errors (recoverable)
			expect(isRecoverable({ code: -32603 })).toBe(true); // Internal error
			expect(isRecoverable({ code: -32000 })).toBe(true); // Generic server error
			expect(isRecoverable({ code: -32050 })).toBe(true); // Server error range

			// JSON-RPC client errors (non-recoverable)
			expect(isRecoverable({ code: -32602 })).toBe(false); // Invalid params
			expect(isRecoverable({ code: -32601 })).toBe(false); // Method not found

			// Network errors (recoverable)
			expect(isRecoverable(new Error('websocket connection failed'))).toBe(true);
			expect(isRecoverable(new Error('network timeout'))).toBe(true);

			// Unknown errors (non-recoverable)
			expect(isRecoverable('unknown error')).toBe(false);
			expect(isRecoverable(null)).toBe(false);
		});

		it('should sanitize error messages properly', () => {
			const sanitize = (connectionManager as any).sanitizeErrorMessage.bind(connectionManager);

			// File paths
			expect(sanitize({ message: 'Error in /path/to/file.ts' })).toBe('Error in [file]');

			// Stack traces
			expect(sanitize({ message: 'Error\n    at function (/path/file.js:123:45)' })).toBe('Error');

			// Sensitive keywords
			expect(sanitize({ message: 'Invalid secret123 and token456' })).toBe(
				'Invalid [redacted] and [redacted]'
			);

			// Default message
			expect(sanitize(null)).toBe('Connection error occurred');
		});

		it('should handle connection errors', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;

			mockWs.simulateError();

			await expect(connectPromise).rejects.toThrow(
				'WebSocket connection failed: Unable to connect to MCP server'
			);

			expect(events).toContainEqual({
				type: 'error',
				message: expect.stringContaining('WebSocket connection failed'),
				error: expect.any(Event)
			});
		});

		it('should emit disconnect events with proper codes', async () => {
			const connectPromise = connectionManager.connect(mockOnMessage);
			const mockWs = (connectionManager as any).ws as MockWebSocket;

			mockWs.simulateOpen();
			await connectPromise;

			// Normal close
			mockWs.simulateClose(1000, 'Normal closure');
			expect(events).toContainEqual({
				type: 'disconnected',
				message: 'Disconnected from server'
			});

			// Reset events
			events.length = 0;

			// Abnormal close
			const connectPromise2 = connectionManager.connect(mockOnMessage);
			const mockWs2 = (connectionManager as any).ws as MockWebSocket;
			mockWs2.simulateOpen();
			await connectPromise2;

			mockWs2.simulateClose(1006, 'Connection lost');
			expect(events).toContainEqual({
				type: 'disconnected',
				message: 'WebSocket disconnected: 1006 Connection lost'
			});
		});
	});

	describe('Retry Logic', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should retry connection on recoverable errors', async () => {
			let attemptCount = 0;
			const originalConnect = connectionManager.connect;

			// Mock connect to fail first two times, succeed on third
			connectionManager.connect = vi.fn().mockImplementation((onMessage) => {
				attemptCount++;
				if (attemptCount <= 2) {
					return Promise.reject({ code: -32603 }); // Recoverable error
				}
				return originalConnect.call(connectionManager, onMessage);
			});

			const connectPromise = connectionManager.connectWithRetry(mockOnMessage);

			// Fast-forward through retry delays
			for (let i = 0; i < 3; i++) {
				await vi.runAllTimersAsync();
			}

			// Simulate final successful connection
			const mockWs = (connectionManager as any).ws as MockWebSocket;
			if (mockWs) {
				mockWs.simulateOpen();
			}

			await expect(connectPromise).resolves.toBeUndefined();
			expect(attemptCount).toBe(3);
		});

		it('should calculate exponential backoff delays correctly', () => {
			const calculateDelay = (connectionManager as any).calculateRetryDelay.bind(connectionManager);

			expect(calculateDelay(0)).toBe(100); // 100ms * 2^0
			expect(calculateDelay(1)).toBe(200); // 100ms * 2^1
			expect(calculateDelay(2)).toBe(400); // 100ms * 2^2
			expect(calculateDelay(3)).toBe(800); // 100ms * 2^3
		});

		it('should not retry non-recoverable errors', async () => {
			// Mock connection to throw a non-recoverable error
			vi.spyOn(connectionManager, 'connect').mockRejectedValue({ 
				code: -32602, 
				message: 'Invalid params' 
			});

			const connectPromise = connectionManager.connectWithRetry(mockOnMessage);

			await expect(connectPromise).rejects.toThrow('Connection failed after 1 attempts: Invalid params');

			// Should not have retry events for non-recoverable errors
			const retryEvents = events.filter((e) => e.type === 'retry');
			expect(retryEvents.length).toBe(0);
		});

		it('should emit retry events during retry attempts', async () => {
			let attemptCount = 0;

			// Mock connect to always fail with recoverable error
			connectionManager.connect = vi.fn().mockImplementation(() => {
				attemptCount++;
				return Promise.reject({ code: -32603 });
			});

			const connectPromise = connectionManager.connectWithRetry(mockOnMessage);

			// Let first few retry attempts happen
			await vi.runAllTimersAsync();

			const retryEvents = events.filter((e) => e.type === 'retry');
			expect(retryEvents.length).toBeGreaterThan(0);
			expect(retryEvents[0].message).toMatch(/retrying in \d+ms/);
		});

		it('should fail after maximum retry attempts', async () => {
			connectionManager.connect = vi.fn().mockRejectedValue({ code: -32603 });

			const connectPromise = connectionManager.connectWithRetry(mockOnMessage);

			await vi.runAllTimersAsync();

			await expect(connectPromise).rejects.toThrow(/failed after \d+ attempts/);
			expect(connectionManager.getRetryAttempts()).toBe(3);
		});

		it('should reset retry attempts on successful connection', async () => {
			// Mock the delay method to resolve immediately
			vi.spyOn(connectionManager as any, 'delay').mockResolvedValue(undefined);

			// Mock connect method to fail once, then succeed
			let callCount = 0;
			vi.spyOn(connectionManager, 'connect').mockImplementation(async (onMessage) => {
				callCount++;
				if (callCount === 1) {
					throw { code: -32603, message: 'Internal error' }; // Recoverable error
				}
				// Second call succeeds
				return Promise.resolve();
			});

			// This should retry once and then succeed
			await connectionManager.connectWithRetry(mockOnMessage);

			// Retry attempts should be reset to 0 after successful connection
			expect(connectionManager.getRetryAttempts()).toBe(0);
		});
	});

	describe('Event Listener Management', () => {
		it('should add and remove listeners correctly', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			connectionManager.addListener(listener1);
			connectionManager.addListener(listener2);

			// Trigger event
			(connectionManager as any).emit({ type: 'connected', message: 'test' });

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();

			// Remove one listener
			connectionManager.removeListener(listener1);

			// Trigger another event
			(connectionManager as any).emit({ type: 'disconnected', message: 'test' });

			expect(listener1).toHaveBeenCalledTimes(1); // Still only called once
			expect(listener2).toHaveBeenCalledTimes(2); // Called twice
		});

		it('should handle removing non-existent listener gracefully', () => {
			const listener = vi.fn();

			// Should not throw when removing non-existent listener
			expect(() => connectionManager.removeListener(listener)).not.toThrow();
		});
	});

	describe('Connection Statistics', () => {
		it('should track retry attempts correctly', () => {
			expect(connectionManager.getRetryAttempts()).toBe(0);
			expect(connectionManager.getMaxRetries()).toBe(3);
		});

		it('should update retry attempts during failed connections', async () => {
			connectionManager.connect = vi.fn().mockRejectedValue({ code: -32603 });

			try {
				await connectionManager.connectWithRetry(mockOnMessage);
			} catch {
				// Expected to fail
			}

			expect(connectionManager.getRetryAttempts()).toBeGreaterThan(0);
		});
	});
});
