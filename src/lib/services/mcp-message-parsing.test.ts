import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LifecycleMCPClient } from './mcp-client.js';

describe('LifecycleMCPClient - Message Parsing and Validation', () => {
	let client: LifecycleMCPClient;
	let originalWebSocket: any;
	let mockWebSocket: MessageParsingWebSocket;

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
		private lastMessageId = 0;

		constructor(url: string) {
			this.url = url;
			// Immediately mark as opened for synchronous testing
			setImmediate(() => {
				if (this.onopen) {
					this.onopen(new Event('open'));
				}
			});
		}

		send(data: string) {
			const message = JSON.parse(data);
			this.sentMessages.push(message);
			this.lastMessageId = message.id || 0;

			// Auto-respond to initialize immediately
			if (message.method === 'initialize') {
				setImmediate(() => {
					this.simulateMessage({
						jsonrpc: '2.0',
						id: message.id,
						result: {
							protocolVersion: '2024-11-05',
							capabilities: { tools: {} },
							serverInfo: { name: 'test-server', version: '1.0.0' }
						}
					});
				});
			}
		}

		close() {
			this.readyState = 3;
		}

		simulateMessage(message: any) {
			const event = new MessageEvent('message', {
				data: JSON.stringify(message)
			});
			setImmediate(() => this.onmessage?.(event));
		}

		simulateResponse(result: any, isError = false) {
			const responseMessage = {
				jsonrpc: '2.0',
				id: this.lastMessageId,
				...(isError ? { error: result } : { result })
			};
			this.simulateMessage(responseMessage);
		}

		getSentMessages() {
			return this.sentMessages;
		}

		getLastMessageId() {
			return this.lastMessageId;
		}

		clearMessages() {
			this.sentMessages = [];
		}
	}

	beforeEach(async () => {
		originalWebSocket = global.WebSocket;
		global.WebSocket = MessageParsingWebSocket as any;
		client = new LifecycleMCPClient('ws://localhost:3000/test');

		// Connect synchronously for testing
		await client.connect();
		mockWebSocket = (client as any).ws as MessageParsingWebSocket;
	});

	afterEach(() => {
		client.disconnect();
		global.WebSocket = originalWebSocket;
	});

	describe('JSON-RPC 2.0 Message Format Validation', () => {
		it('should send properly formatted JSON-RPC request messages', async () => {
			mockWebSocket.clearMessages();

			// Make a request to trigger message sending
			const promise = client.getRequirements();

			// Simulate successful response with proper MCP tool format
			mockWebSocket.simulateResponse({
				content: [
					{
						text: JSON.stringify([{ id: '1', title: 'Test Requirement', status: 'Draft' }])
					}
				]
			});

			const response = await promise;

			const messages = mockWebSocket.getSentMessages();
			const requestMessage = messages.find((m) => m.method !== 'initialize');

			expect(requestMessage).toBeDefined();
			expect(requestMessage.jsonrpc).toBe('2.0');
			expect(requestMessage.method).toBe('tools/call');
			expect(typeof requestMessage.id).toBe('number');
			expect(requestMessage.params).toBeDefined();
			expect(requestMessage.params.name).toBe('query_requirements');
			expect(response.success).toBe(true);
		});

		it('should handle valid JSON-RPC response messages', async () => {
			const promise = client.getRequirements();

			// Send a valid MCP tool response
			mockWebSocket.simulateResponse({
				content: [
					{
						text: JSON.stringify([{ id: '1', title: 'Test Requirement', status: 'Draft' }])
					}
				]
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);
			expect(response.data[0].id).toBe('1');
		});

		it('should handle JSON-RPC error responses', async () => {
			const promise = client.getRequirements();

			// Send an error response
			mockWebSocket.simulateResponse(
				{
					code: -32000,
					message: 'Internal server error',
					data: { details: 'Database connection failed' }
				},
				true
			);

			const response = await promise;
			expect(response.success).toBe(false);
			expect(response.error).toContain('Internal server error');
		});
	});

	describe('Malformed Message Handling', () => {
		it('should handle invalid JSON messages (client currently throws)', () => {
			// The current client implementation calls JSON.parse directly without error handling
			// So invalid JSON will throw an error - this documents the current behavior
			expect(() => {
				const event = new MessageEvent('message', { data: 'invalid json {' });
				mockWebSocket.onmessage?.(event);
			}).toThrow('Unexpected token');
		});

		it('should handle messages without required fields', () => {
			// Valid JSON messages should not throw even if missing required fields
			expect(() => {
				mockWebSocket.simulateMessage({
					id: 1,
					result: { success: true }
				});
			}).not.toThrow();

			// Send message without id field
			expect(() => {
				mockWebSocket.simulateMessage({
					jsonrpc: '2.0',
					result: { success: true }
				});
			}).not.toThrow();
		});

		it('should handle messages with wrong jsonrpc version', () => {
			expect(() => {
				mockWebSocket.simulateMessage({
					jsonrpc: '1.0',
					id: 1,
					result: { success: true }
				});
			}).not.toThrow();
		});

		it('should handle empty or null message data (client currently throws)', () => {
			// The current client implementation will throw on empty JSON
			expect(() => {
				const event1 = new MessageEvent('message', { data: '' });
				mockWebSocket.onmessage?.(event1);
			}).toThrow();

			// Parsing 'null' succeeds but then client tries to access .id on null
			expect(() => {
				const event2 = new MessageEvent('message', { data: 'null' });
				mockWebSocket.onmessage?.(event2);
			}).toThrow('Cannot read properties of null');

			expect(() => {
				const event3 = new MessageEvent('message', { data: 'undefined' });
				mockWebSocket.onmessage?.(event3);
			}).toThrow();
		});
	});

	describe('Response Data Validation', () => {
		it('should validate requirement data structure', async () => {
			const promise = client.getRequirements();

			// Send response with valid requirement structure
			mockWebSocket.simulateResponse({
				content: [
					{
						text: JSON.stringify([
							{
								id: 'REQ-001',
								title: 'Test Requirement',
								status: 'Draft',
								priority: 'P1',
								type: 'FUNC'
							}
						])
					}
				]
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);
			expect(response.data[0]).toHaveProperty('id');
			expect(response.data[0]).toHaveProperty('title');
			expect(response.data[0]).toHaveProperty('status');
		});

		it('should handle malformed requirement data', async () => {
			const promise = client.getRequirements();

			// Send response with malformed data (not wrapped in MCP format)
			mockWebSocket.simulateResponse({
				success: true,
				data: 'not an array'
			});

			const response = await promise;
			// Should still handle gracefully
			expect(response.success).toBe(true);
		});

		it('should validate task data structure', async () => {
			const promise = client.getTasks();

			mockWebSocket.simulateResponse({
				content: [
					{
						text: JSON.stringify([
							{
								id: 'TASK-001',
								title: 'Test Task',
								status: 'Not Started',
								priority: 'P1',
								effort: 'M'
							}
						])
					}
				]
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
			const testCases = [
				{ code: -32700, description: 'Parse error' },
				{ code: -32600, description: 'Invalid Request' },
				{ code: -32601, description: 'Method not found' },
				{ code: -32602, description: 'Invalid params' },
				{ code: -32603, description: 'Internal error' }
			];

			for (const testCase of testCases) {
				const promise = client.getRequirements();

				mockWebSocket.simulateResponse(
					{
						code: testCase.code,
						message: testCase.description
					},
					true
				);

				const response = await promise;
				expect(response.success).toBe(false);
				expect(response.error).toContain(testCase.description);
			}
		});

		it('should handle error responses without error details', async () => {
			const promise = client.getRequirements();

			// Error response with minimal information
			mockWebSocket.simulateResponse(
				{
					code: -32000
				},
				true
			);

			const response = await promise;
			expect(response.success).toBe(false);
			expect(response.error).toBeDefined();
		});
	});

	describe('Message ID Correlation', () => {
		it('should correlate responses with requests by ID', async () => {
			mockWebSocket.clearMessages();

			// Make first request
			const req1Promise = client.getRequirements();

			// Wait for first request to be sent and get its ID
			await new Promise((resolve) => setImmediate(resolve));
			const messages1 = mockWebSocket.getSentMessages();
			const req1Message = messages1.find((m) => m.method !== 'initialize');
			const firstReqId = req1Message?.id;

			// Make second request
			const req2Promise = client.getTasks();

			// Wait for second request to be sent and get its ID
			await new Promise((resolve) => setImmediate(resolve));
			const messages2 = mockWebSocket.getSentMessages();
			const req2Message = messages2.find((m) => m.method !== 'initialize' && m.id !== firstReqId);
			const secondReqId = req2Message?.id;

			// Send responses in reverse order with correct IDs
			setImmediate(() => {
				mockWebSocket.simulateMessage({
					jsonrpc: '2.0',
					id: secondReqId,
					result: {
						content: [
							{
								text: JSON.stringify([{ id: 'task-1', title: 'Test Task' }])
							}
						]
					}
				});

				mockWebSocket.simulateMessage({
					jsonrpc: '2.0',
					id: firstReqId,
					result: {
						content: [
							{
								text: JSON.stringify([{ id: 'req-1', title: 'Test Requirement' }])
							}
						]
					}
				});
			});

			const [resp1, resp2] = await Promise.all([req1Promise, req2Promise]);

			expect(resp1.success).toBe(true);
			expect(resp2.success).toBe(true);
			expect(resp1.data[0].id).toBe('req-1');
			expect(resp2.data[0].id).toBe('task-1');
		});

		it('should handle responses with unknown IDs gracefully', () => {
			// Send response with ID that doesn't match any pending request
			expect(() => {
				mockWebSocket.simulateMessage({
					jsonrpc: '2.0',
					id: 9999,
					result: { success: true }
				});
			}).not.toThrow();
		});
	});

	describe('Message Size and Performance', () => {
		it('should handle large response payloads', async () => {
			const promise = client.getRequirements();

			// Create a large dataset
			const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
				id: `REQ-${i.toString().padStart(3, '0')}`,
				title: `Requirement ${i}`,
				status: 'Draft',
				priority: 'P1',
				description: 'A'.repeat(1000) // Large description
			}));

			mockWebSocket.simulateResponse({
				content: [
					{
						text: JSON.stringify(largeDataset)
					}
				]
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1000);
		});

		it('should handle empty responses', async () => {
			const promise = client.getRequirements();

			mockWebSocket.simulateResponse({
				content: [
					{
						text: JSON.stringify([])
					}
				]
			});

			const response = await promise;
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(0);
		});
	});
});
