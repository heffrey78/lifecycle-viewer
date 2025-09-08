import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LifecycleMCPClient } from './mcp-client.js';

describe('LifecycleMCPClient - Message Parsing and Validation', () => {
	let client: LifecycleMCPClient;
	let originalWebSocket: any;

	// Mock WebSocket for message parsing tests
	class MessageParsingWebSocket {
		static OPEN = 1;

		public readyState = MessageParsingWebSocket.OPEN;
		public url: string;
		public onopen: ((event: Event) => void) | null = null;
		public onclose: ((event: Event) => void) | null = null;
		public onmessage: ((event: MessageEvent) => void) | null = null;
		public onerror: ((event: Event) => void) | null = null;

		private sentMessages: any[] = [];

		constructor(url: string) {
			this.url = url;
		}

		send(data: string) {
			const message = JSON.parse(data);
			this.sentMessages.push(message);

			// Auto-respond to initialize
			if (message.method === 'initialize') {
				setTimeout(() => {
					this.simulateMessage({
						jsonrpc: '2.0',
						id: message.id,
						result: {
							protocolVersion: '1.0.0',
							capabilities: { tools: {} },
							serverInfo: { name: 'test-server', version: '1.0.0' }
						}
					});
				}, 1);
			}
		}

		close() {
			this.readyState = 3;
		}

		simulateMessage(message: any) {
			const event = new MessageEvent('message', {
				data: JSON.stringify(message)
			});
			this.onmessage?.(event);
		}

		getSentMessages() {
			return this.sentMessages;
		}
	}

	beforeEach(async () => {
		originalWebSocket = global.WebSocket;
		global.WebSocket = MessageParsingWebSocket as any;
		client = new LifecycleMCPClient('ws://localhost:3000/test');
		await client.connect();
	});

	afterEach(() => {
		client.disconnect();
		global.WebSocket = originalWebSocket;
	});

	describe('JSON-RPC 2.0 Message Format Validation', () => {
		it('should send properly formatted JSON-RPC request messages', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			// Make a request to trigger message sending
			const promise = client.getRequirements();

			// Mock response
			setTimeout(() => {
				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					result: { success: true, data: [] }
				});
			}, 1);

			await promise;

			const messages = ws.getSentMessages();
			const requestMessage = messages.find((m) => m.method !== 'initialize');

			expect(requestMessage).toBeDefined();
			expect(requestMessage.jsonrpc).toBe('2.0');
			expect(requestMessage.method).toBeDefined();
			expect(typeof requestMessage.id).toBe('number');
			expect(requestMessage.params).toBeDefined();
		});

		it('should handle valid JSON-RPC response messages', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			// Send a valid response
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					success: true,
					data: [{ id: '1', title: 'Test Requirement', status: 'Draft' }]
				}
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);
		});

		it('should handle JSON-RPC error responses', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			// Send an error response
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				error: {
					code: -32000,
					message: 'Internal server error',
					data: { details: 'Database connection failed' }
				}
			});

			const response = await promise;
			expect(response.success).toBe(false);
			expect(response.error).toContain('Internal server error');
		});
	});

	describe('Malformed Message Handling', () => {
		it('should handle invalid JSON messages gracefully', () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			// Send invalid JSON
			expect(() => {
				const event = new MessageEvent('message', { data: 'invalid json {' });
				ws.onmessage?.(event);
			}).not.toThrow();
		});

		it('should handle messages without required fields', () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			// Send message without jsonrpc field
			expect(() => {
				ws.simulateMessage({
					id: 1,
					result: { success: true }
				});
			}).not.toThrow();

			// Send message without id field
			expect(() => {
				ws.simulateMessage({
					jsonrpc: '2.0',
					result: { success: true }
				});
			}).not.toThrow();
		});

		it('should handle messages with wrong jsonrpc version', () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			expect(() => {
				ws.simulateMessage({
					jsonrpc: '1.0',
					id: 1,
					result: { success: true }
				});
			}).not.toThrow();
		});

		it('should handle empty or null message data', () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			expect(() => {
				const event1 = new MessageEvent('message', { data: '' });
				ws.onmessage?.(event1);

				const event2 = new MessageEvent('message', { data: null as any });
				ws.onmessage?.(event2);

				const event3 = new MessageEvent('message', { data: undefined as any });
				ws.onmessage?.(event3);
			}).not.toThrow();
		});
	});

	describe('Response Data Validation', () => {
		it('should validate requirement data structure', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			// Send response with valid requirement structure
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					success: true,
					data: [
						{
							id: 'REQ-001',
							title: 'Test Requirement',
							status: 'Draft',
							priority: 'P1',
							type: 'FUNC'
						}
					]
				}
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);
			expect(response.data[0]).toHaveProperty('id');
			expect(response.data[0]).toHaveProperty('title');
			expect(response.data[0]).toHaveProperty('status');
		});

		it('should handle malformed requirement data', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			// Send response with malformed data
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					success: true,
					data: 'not an array'
				}
			});

			const response = await promise;
			// Should still handle gracefully
			expect(response.success).toBe(true);
		});

		it('should validate task data structure', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getTasks();

			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					success: true,
					data: [
						{
							id: 'TASK-001',
							title: 'Test Task',
							status: 'Not Started',
							priority: 'P1',
							effort: 'M'
						}
					]
				}
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);
			expect(response.data[0]).toHaveProperty('id');
			expect(response.data[0]).toHaveProperty('status');
		});
	});

	describe('Error Message Parsing', () => {
		it('should parse standard JSON-RPC error codes correctly', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const testCases = [
				{ code: -32700, description: 'Parse error' },
				{ code: -32600, description: 'Invalid Request' },
				{ code: -32601, description: 'Method not found' },
				{ code: -32602, description: 'Invalid params' },
				{ code: -32603, description: 'Internal error' }
			];

			for (const testCase of testCases) {
				const promise = client.getRequirements();

				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					error: {
						code: testCase.code,
						message: testCase.description
					}
				});

				const response = await promise;
				expect(response.success).toBe(false);
				expect(response.error).toContain(testCase.description);
			}
		});

		it('should handle error responses without error details', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			// Error response with minimal information
			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				error: {
					code: -32000
				}
			});

			const response = await promise;
			expect(response.success).toBe(false);
			expect(response.error).toBeDefined();
		});
	});

	describe('Message ID Correlation', () => {
		it('should correlate responses with requests by ID', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			// Make multiple concurrent requests
			const req1Promise = client.getRequirements();
			const req2Promise = client.getTasks();

			// Send responses in reverse order
			setTimeout(() => {
				// Respond to second request first
				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 3, // Second request ID
					result: { success: true, data: 'tasks' }
				});

				// Then respond to first request
				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 2, // First request ID
					result: { success: true, data: 'requirements' }
				});
			}, 1);

			const [resp1, resp2] = await Promise.all([req1Promise, req2Promise]);

			expect(resp1.data).toBe('requirements');
			expect(resp2.data).toBe('tasks');
		});

		it('should handle responses with unknown IDs gracefully', () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			// Send response with ID that doesn't match any pending request
			expect(() => {
				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 9999,
					result: { success: true }
				});
			}).not.toThrow();
		});
	});

	describe('Message Size and Performance', () => {
		it('should handle large response payloads', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			// Create a large dataset
			const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
				id: `REQ-${i.toString().padStart(3, '0')}`,
				title: `Requirement ${i}`,
				status: 'Draft',
				priority: 'P1',
				description: 'A'.repeat(1000) // Large description
			}));

			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					success: true,
					data: largeDataset
				}
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1000);
		});

		it('should handle empty responses', async () => {
			const ws = (client as any).ws as MessageParsingWebSocket;

			const promise = client.getRequirements();

			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					success: true,
					data: []
				}
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(0);
		});
	});
});
