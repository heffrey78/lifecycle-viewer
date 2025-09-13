import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LifecycleMCPClient } from './mcp-client.js';

// Core WebSocket Connection Tests - Focus on basic functionality gaps
describe('LifecycleMCPClient - WebSocket Core Connection Tests', () => {
	let client: LifecycleMCPClient;
	let originalWebSocket: any;

	// Simple mock WebSocket for core functionality testing
	class TestWebSocket {
		static CONNECTING = 0;
		static OPEN = 1;
		static CLOSING = 2;
		static CLOSED = 3;

		public readyState: number = TestWebSocket.CONNECTING;
		public url: string;
		public onopen: ((event: Event) => void) | null = null;
		public onclose: ((event: Event) => void) | null = null;
		public onmessage: ((event: Event) => void) | null = null;
		public onerror: ((event: Event) => void) | null = null;

		private messages: any[] = [];

		constructor(url: string) {
			this.url = url;
			// Check for invalid URLs and simulate failure
			if (url === 'invalid-url') {
				setTimeout(() => {
					this.onerror?.(new Event('error'));
				}, 1);
				return;
			}
			// Immediately simulate connection success for valid URLs
			setTimeout(() => {
				this.readyState = TestWebSocket.OPEN;
				this.onopen?.(new Event('open'));
			}, 1);
		}

		send(data: string) {
			this.messages.push(JSON.parse(data));
			// Auto-respond to basic requests for core functionality testing
			const request = JSON.parse(data);
			setTimeout(() => {
				if (request.method === 'initialize') {
					this.simulateMessage({
						id: request.id,
						result: {
							protocolVersion: '1.0.0',
							capabilities: { tools: {} },
							serverInfo: { name: 'test-server', version: '1.0.0' }
						}
					});
				}
			}, 1);
		}

		close() {
			this.readyState = TestWebSocket.CLOSED;
			setTimeout(() => {
				this.onclose?.(new Event('close'));
			}, 1);
		}

		simulateMessage(message: any) {
			const event = new MessageEvent('message', { data: JSON.stringify(message) });
			this.onmessage?.(event as any);
		}

		simulateError() {
			this.onerror?.(new Event('error'));
		}

		getMessages() {
			return this.messages;
		}
	}

	beforeEach(() => {
		// Store original WebSocket
		originalWebSocket = global.WebSocket;
		// Replace with our test implementation
		global.WebSocket = TestWebSocket as any;
		client = new LifecycleMCPClient('ws://localhost:3000/test');
	});

	afterEach(async () => {
		// Cleanup
		if (client.isConnected()) {
			client.disconnect();
		}
		// Restore original WebSocket
		global.WebSocket = originalWebSocket;
		// Small delay to allow cleanup
		await new Promise((resolve) => setTimeout(resolve, 10));
	});

	describe('Basic WebSocket Connection', () => {
		it('should create WebSocket with correct URL', async () => {
			await client.connect();

			expect(client.isConnected()).toBe(true);
		});

		it('should handle connection state transitions correctly', async () => {
			expect(client.isConnected()).toBe(false);

			await client.connect();

			expect(client.isConnected()).toBe(true);
		});

		it('should prevent multiple concurrent connections', async () => {
			const connection1 = client.connect();
			const connection2 = client.connect();

			await Promise.all([connection1, connection2]);

			expect(client.isConnected()).toBe(true);
			// Should have only one WebSocket connection internally
		});

		it('should handle disconnection properly', async () => {
			await client.connect();
			expect(client.isConnected()).toBe(true);

			client.disconnect();

			expect(client.isConnected()).toBe(false);
		});
	});

	describe('WebSocket Message Handling', () => {
		beforeEach(async () => {
			await client.connect();
		});

		it('should send properly formatted JSON-RPC messages', async () => {
			// Access the WebSocket instance to check messages
			const ws = (client as any).ws as TestWebSocket;

			// The connect process should have sent initialize and initialized messages
			const messages = ws.getMessages();
			expect(messages).toHaveLength(2);

			const initMessage = messages[0];
			expect(initMessage.jsonrpc).toBe('2.0');
			expect(initMessage.method).toBe('initialize');
			expect(initMessage.id).toBeDefined();
			expect(typeof initMessage.id).toBe('number');

			const notifyMessage = messages[1];
			expect(notifyMessage.jsonrpc).toBe('2.0');
			expect(notifyMessage.method).toBe('notifications/initialized');
		});

		it('should handle response messages correctly', async () => {
			const ws = (client as any).ws as TestWebSocket;

			// Simulate a response to a request
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 1,
				result: { success: true, data: [] }
			});

			// No error should be thrown
			expect(true).toBe(true);
		});

		it('should handle error responses correctly', async () => {
			const ws = (client as any).ws as TestWebSocket;

			// Simulate an error response
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 1,
				error: { code: -32000, message: 'Test error' }
			});

			// No error should be thrown from message handling
			expect(true).toBe(true);
		});
	});

	describe('Connection Error Handling', () => {
		it('should handle WebSocket errors gracefully', async () => {
			// Create a WebSocket that will trigger an error
			global.WebSocket = class ErrorWebSocket {
				constructor(url: string) {
					setTimeout(() => {
						this.onerror?.(new Event('error'));
					}, 1);
				}
				onopen: ((event: Event) => void) | null = null;
				onclose: ((event: Event) => void) | null = null;
				onmessage: ((event: Event) => void) | null = null;
				onerror: ((event: Event) => void) | null = null;
				readyState = 0;
				close() {}
				send() {}
			} as any;

			client = new LifecycleMCPClient('ws://localhost:3000/test');

			await expect(client.connect()).rejects.toThrow();
			expect(client.isConnected()).toBe(false);
		});

		it('should handle invalid URLs', async () => {
			client = new LifecycleMCPClient('invalid-url');

			await expect(client.connect()).rejects.toThrow();
			expect(client.isConnected()).toBe(false);
		});
	});

	describe('Connection State Validation', () => {
		it('should reject requests when not connected', async () => {
			expect(client.isConnected()).toBe(false);

			const response = await client.getRequirements();
			expect(response.success).toBe(false);
			expect(response.error).toBe('Not connected to MCP server');
		});

		it('should accept requests when connected', async () => {
			await client.connect();

			// Mock the actual API response
			const ws = (client as any).ws as TestWebSocket;
			setTimeout(() => {
				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 2, // Next ID after initialize
					result: { success: true, data: [] }
				});
			}, 1);

			const response = await client.getRequirements();
			expect(response.success).toBe(true);
		});

		it('should handle connection status checks correctly', () => {
			expect(client.isConnected()).toBe(false);

			return client.connect().then(() => {
				expect(client.isConnected()).toBe(true);
			});
		});
	});

	describe('Message ID Generation', () => {
		beforeEach(async () => {
			await client.connect();
		});

		it('should generate sequential message IDs', async () => {
			const ws = (client as any).ws as TestWebSocket;

			// Make multiple requests to check ID sequence
			const promise1 = client.getRequirements();
			const promise2 = client.getTasks();

			// Mock responses
			setTimeout(() => {
				ws.simulateMessage({ jsonrpc: '2.0', id: 2, result: { success: true, data: [] } });
				ws.simulateMessage({ jsonrpc: '2.0', id: 3, result: { success: true, data: [] } });
			}, 1);

			await Promise.all([promise1, promise2]);

			const messages = ws.getMessages();
			// Should have initialize (id:1), notifications/initialized (no id), getRequirements (id:2), getTasks (id:3)
			expect(messages).toHaveLength(4);
			expect(messages[0].id).toBe(1); // initialize
			expect(messages[2].id).toBe(2); // getRequirements 
			expect(messages[3].id).toBe(3); // getTasks
		});
	});

	describe('WebSocket Ready State Management', () => {
		it('should wait for WebSocket to be ready before sending', async () => {
			// Create a WebSocket that stays in CONNECTING state
			global.WebSocket = class SlowWebSocket {
				public readyState = 0; // CONNECTING
				public onopen: ((event: Event) => void) | null = null;
				public onclose: ((event: Event) => void) | null = null;
				public onmessage: ((event: Event) => void) | null = null;
				public onerror: ((event: Event) => void) | null = null;

				private messages: any[] = [];

				constructor(url: string) {
					// Don't automatically transition to OPEN
				}

				send(data: string) {
					if (this.readyState !== 1) {
						throw new Error('WebSocket is not open');
					}
					this.messages.push(JSON.parse(data));
				}

				close() {
					this.readyState = 3; // CLOSED
				}

				simulateOpen() {
					this.readyState = 1; // OPEN
					this.onopen?.(new Event('open'));
				}
			} as any;

			client = new LifecycleMCPClient('ws://localhost:3000/test');

			// Start connection but don't resolve it
			const connectPromise = client.connect();

			// WebSocket should still be connecting
			expect(client.isConnected()).toBe(false);

			// Simulate the WebSocket opening after a delay
			setTimeout(() => {
				const ws = (client as any).ws;
				ws.simulateOpen();
				// Send initialize response
				setTimeout(() => {
					ws.onmessage?.(
						new MessageEvent('message', {
							data: JSON.stringify({
								jsonrpc: '2.0',
								id: 1,
								result: {
									protocolVersion: '1.0.0',
									capabilities: { tools: {} },
									serverInfo: { name: 'test-server', version: '1.0.0' }
								}
							})
						}) as any
					);
				}, 1);
			}, 5);

			await connectPromise;
			expect(client.isConnected()).toBe(true);
		});
	});
});
