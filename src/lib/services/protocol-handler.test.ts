import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProtocolHandler } from './protocol-handler.js';
import type { ConnectionManager } from './connection-manager.js';

// Mock ConnectionManager
class MockConnectionManager {
	private connected = false;
	private listeners: Array<(event: any) => void> = [];
	private messageHandler: ((message: any) => void) | null = null;

	connectWithRetry = vi.fn().mockImplementation(async (onMessage: (message: any) => void) => {
		this.messageHandler = onMessage;
		this.connected = true;
		return Promise.resolve();
	});

	isConnected = vi.fn().mockImplementation(() => this.connected);

	send = vi.fn();

	addListener = vi.fn().mockImplementation((listener: (event: any) => void) => {
		this.listeners.push(listener);
	});

	removeListener = vi.fn().mockImplementation((listener: (event: any) => void) => {
		const index = this.listeners.indexOf(listener);
		if (index > -1) {
			this.listeners.splice(index, 1);
		}
	});

	// Test helpers
	simulateMessage(message: any): void {
		if (this.messageHandler) {
			this.messageHandler(message);
		}
	}

	simulateDisconnect(): void {
		this.connected = false;
		this.listeners.forEach((listener) =>
			listener({ type: 'disconnected', message: 'Connection lost' })
		);
	}

	setConnected(connected: boolean): void {
		this.connected = connected;
	}
}

describe('ProtocolHandler', () => {
	let protocolHandler: ProtocolHandler;
	let mockConnectionManager: MockConnectionManager;

	beforeEach(() => {
		// Note: Using real timers for now to avoid async timing issues
		// vi.useFakeTimers();
		mockConnectionManager = new MockConnectionManager();
		protocolHandler = new ProtocolHandler(mockConnectionManager as any as ConnectionManager);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	describe('Initialization', () => {
		it('should connect to server if not already connected', async () => {
			mockConnectionManager.setConnected(false);

			const initPromise = protocolHandler.initialize();

			// Give the initialization request time to be sent
			await new Promise(resolve => setImmediate(resolve));

			// Simulate successful initialization response
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: {
						protocolVersion: '2024-11-05',
						capabilities: { tools: {} }
					}
				});
			}, 0);

			await initPromise;

			expect(mockConnectionManager.connectWithRetry).toHaveBeenCalled();
		});

		it('should not reconnect if already connected', async () => {
			mockConnectionManager.setConnected(true);

			const initPromise1 = protocolHandler.initialize();
			
			// Simulate initialization response for first call
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: {
						protocolVersion: '2024-11-05',
						capabilities: { tools: {} }
					}
				});
			}, 0);
			
			await initPromise1;
			
			// Second call should not require another response since already initialized
			await protocolHandler.initialize(); 

			expect(mockConnectionManager.connectWithRetry).toHaveBeenCalledTimes(1);
		});

		it('should send proper MCP initialization request', async () => {
			mockConnectionManager.setConnected(false);

			const initPromise = protocolHandler.initialize();

			// Check that initialization request was sent
			expect(mockConnectionManager.send).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2024-11-05',
					capabilities: { tools: {} },
					clientInfo: {
						name: 'lifecycle-viewer',
						version: '1.0.0'
					}
				}
			});

			// Simulate successful initialization response
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: {
						protocolVersion: '2024-11-05',
						capabilities: { tools: {} }
					}
				});
			}, 0);

			await initPromise;

			// Should send initialized notification
			expect(mockConnectionManager.send).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				method: 'notifications/initialized'
			});
		});

		it('should handle initialization timeout', async () => {
			vi.useFakeTimers();
			try {
				mockConnectionManager.setConnected(false);

				const initPromise = protocolHandler.initialize();

				// Fast-forward past initialization timeout (10 seconds)
				vi.advanceTimersByTime(11000);

				await expect(initPromise).rejects.toThrow('MCP initialization timeout');
			} finally {
				vi.useRealTimers();
			}
		});

		it('should handle initialization errors', async () => {
			mockConnectionManager.setConnected(false);

			const initPromise = protocolHandler.initialize();

			// Simulate error response
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					error: { code: -32603, message: 'Internal error' }
				});
			}, 0);

			await expect(initPromise).rejects.toEqual({
				code: -32603,
				message: 'Internal error'
			});
		});

		it('should return early if already initialized', async () => {
			mockConnectionManager.setConnected(true);

			// First initialization
			const initPromise1 = protocolHandler.initialize();
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);
			await initPromise1;

			// Second initialization should return immediately
			const initPromise2 = protocolHandler.initialize();
			await expect(initPromise2).resolves.toBeUndefined();

			// Should not send another initialization request
			expect(mockConnectionManager.send).toHaveBeenCalledTimes(2); // init + notify
		});
	});

	describe('Request Handling', () => {
		beforeEach(async () => {
			// Initialize protocol handler
			const initPromise = protocolHandler.initialize();
			// Use setTimeout to simulate async message in next tick
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);
			await initPromise;
			vi.clearAllMocks();
		});

		it('should send properly formatted tool requests', async () => {
			const requestPromise = protocolHandler.sendRequest('test_method', { param1: 'value1' });

			expect(mockConnectionManager.send).toHaveBeenCalledWith({
				jsonrpc: '2.0',
				id: 2,
				method: 'tools/call',
				params: {
					name: 'test_method',
					arguments: { param1: 'value1' }
				}
			});

			// Simulate response
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					result: { success: true }
				});
			}, 0);

			const result = await requestPromise;
			expect(result).toEqual({ success: true });
		});

		it('should handle request timeout', async () => {
			vi.useFakeTimers();
			try {
				const requestPromise = protocolHandler.sendRequest('test_method');

				// Fast-forward past request timeout (30 seconds)
				vi.advanceTimersByTime(31000);

				await expect(requestPromise).rejects.toThrow('Request timeout');
			} finally {
				vi.useRealTimers();
			}
		});

		it('should handle request errors', async () => {
			const requestPromise = protocolHandler.sendRequest('test_method');

			// Simulate error response
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					error: { code: -32601, message: 'Method not found' }
				});
			}, 0);

			await expect(requestPromise).rejects.toEqual({
				code: -32601,
				message: 'Method not found'
			});
		});

		it('should handle concurrent requests with different IDs', async () => {
			const request1Promise = protocolHandler.sendRequest('method1');
			const request2Promise = protocolHandler.sendRequest('method2');

			// Check that different IDs were generated
			expect(mockConnectionManager.send).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({ id: 2, params: { name: 'method1' } })
			);
			expect(mockConnectionManager.send).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ id: 3, params: { name: 'method2' } })
			);

			// Respond to requests out of order
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 3,
					result: { data: 'response2' }
				});

				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					result: { data: 'response1' }
				});
			}, 0);

			const [result1, result2] = await Promise.all([request1Promise, request2Promise]);
			expect(result1).toEqual({ data: 'response1' });
			expect(result2).toEqual({ data: 'response2' });
		});

		it('should reject disconnected requests', async () => {
			mockConnectionManager.setConnected(false);

			await expect(protocolHandler.sendRequest('test_method')).rejects.toThrow(
				'Not connected to MCP server'
			);
		});

		it('should reject requests when not initialized', async () => {
			// Create fresh handler without initialization
			const freshHandler = new ProtocolHandler(mockConnectionManager as any as ConnectionManager);
			mockConnectionManager.setConnected(true);

			await expect(freshHandler.sendRequest('test_method')).rejects.toThrow(
				'MCP server not initialized'
			);
		});
	});

	describe('Message Correlation', () => {
		beforeEach(async () => {
			// Initialize protocol handler
			const initPromise = protocolHandler.initialize();
			// Use setTimeout to simulate async message in next tick
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);
			await initPromise;
		});

		it('should ignore messages without matching request ID', async () => {
			const requestPromise = protocolHandler.sendRequest('test_method');

			// Simulate response with wrong ID
			mockConnectionManager.simulateMessage({
				jsonrpc: '2.0',
				id: 999,
				result: { data: 'wrong response' }
			});

			// Simulate correct response
			mockConnectionManager.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: { data: 'correct response' }
			});

			const result = await requestPromise;
			expect(result).toEqual({ data: 'correct response' });
		});

		it('should handle messages without ID gracefully', async () => {
			// Should not throw when receiving message without ID
			expect(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					method: 'notification'
				});
			}).not.toThrow();
		});

		it('should track pending request count', () => {
			expect(protocolHandler.getPendingRequestCount()).toBe(0);

			protocolHandler.sendRequest('method1');
			protocolHandler.sendRequest('method2');

			expect(protocolHandler.getPendingRequestCount()).toBe(2);

			// Respond to one request
			mockConnectionManager.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: { success: true }
			});

			expect(protocolHandler.getPendingRequestCount()).toBe(1);
		});
	});

	describe('Cleanup and Reset', () => {
		beforeEach(async () => {
			// Initialize and create pending requests
			const initPromise = protocolHandler.initialize();
			// Use setTimeout to simulate async message in next tick
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);
			await initPromise;

			protocolHandler.sendRequest('test1');
			protocolHandler.sendRequest('test2');
		});

		it('should cleanup pending requests on disconnect', async () => {
			expect(protocolHandler.getPendingRequestCount()).toBe(2);

			mockConnectionManager.simulateDisconnect();

			expect(protocolHandler.getPendingRequestCount()).toBe(0);
			expect(protocolHandler.isInitialized()).toBe(false);
		});

		it('should reject pending requests on disconnect', async () => {
			const request1Promise = protocolHandler.sendRequest('test1');
			const request2Promise = protocolHandler.sendRequest('test2');

			mockConnectionManager.simulateDisconnect();

			await expect(request1Promise).rejects.toThrow('Connection lost');
			await expect(request2Promise).rejects.toThrow('Connection lost');
		});

		it('should reset state properly', () => {
			expect(protocolHandler.isInitialized()).toBe(true);
			expect(protocolHandler.getPendingRequestCount()).toBe(2);

			protocolHandler.reset();

			expect(protocolHandler.isInitialized()).toBe(false);
			expect(protocolHandler.getPendingRequestCount()).toBe(0);
		});

		it('should clear timeouts on reset', async () => {
			const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

			// Create request with timeout
			protocolHandler.sendRequest('test_method');

			protocolHandler.reset();

			expect(clearTimeoutSpy).toHaveBeenCalled();
		});
	});

	describe('Response Processing', () => {
		beforeEach(async () => {
			const initPromise = protocolHandler.initialize();
			// Use setTimeout to simulate async message in next tick
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);
			await initPromise;
		});

		it('should extract MCP tool data from content array', async () => {
			const responsePromise = protocolHandler.sendRequestWithResponse('test_method');

			// Simulate MCP tool response format
			mockConnectionManager.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				result: {
					content: [
						{
							text: JSON.stringify({ data: 'extracted' })
						}
					]
				}
			});

			const response = await responsePromise;
			expect(response).toEqual({
				success: true,
				data: { data: 'extracted' }
			});
		});

		it('should handle non-JSON text content', async () => {
			const responsePromise = protocolHandler.sendRequestWithResponse('test_method');

			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					result: {
						content: [
							{
								text: 'plain text response'
							}
						]
					}
				});
			}, 0);

			const response = await responsePromise;
			expect(response).toEqual({
				success: true,
				data: 'plain text response'
			});
		});

		it('should handle content without text property', async () => {
			const responsePromise = protocolHandler.sendRequestWithResponse('test_method');

			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					result: {
						content: [{ data: 'direct data' }]
					}
				});
			}, 0);

			const response = await responsePromise;
			expect(response).toEqual({
				success: true,
				data: { data: 'direct data' }
			});
		});

		it('should handle direct result without content wrapper', async () => {
			const responsePromise = protocolHandler.sendRequestWithResponse('test_method');

			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					result: { data: 'direct result' }
				});
			}, 0);

			const response = await responsePromise;
			expect(response).toEqual({
				success: true,
				data: { data: 'direct result' }
			});
		});

		it('should format errors in sendRequestWithResponse', async () => {
			const responsePromise = protocolHandler.sendRequestWithResponse('test_method');

			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 2,
					error: { code: -32601, message: 'Method not found' }
				});
			}, 0);

			const response = await responsePromise;
			expect(response).toEqual({
				success: false,
				error: 'Error -32601: Method not found'
			});
		});
	});

	describe('Error Message Extraction', () => {
		const extractErrorMessage = (error: any) => {
			// Access private method for testing
			return (protocolHandler as any).extractErrorMessage(error);
		};

		it('should extract string errors', () => {
			expect(extractErrorMessage('Simple error')).toBe('Simple error');
		});

		it('should extract message property from objects', () => {
			expect(extractErrorMessage({ message: 'Object error' })).toBe('Object error');
		});

		it('should format errors with codes', () => {
			expect(extractErrorMessage({ code: -32601, message: 'Not found' })).toBe(
				'Error -32601: Not found'
			);

			expect(extractErrorMessage({ code: -32602 })).toBe('Error -32602: Unknown error');
		});

		it('should handle non-object errors', () => {
			expect(extractErrorMessage(123)).toBe('123');
			expect(extractErrorMessage(null)).toBe('null');
			expect(extractErrorMessage(undefined)).toBe('undefined');
		});
	});

	describe('State Management', () => {
		it('should report correct initialization state', () => {
			expect(protocolHandler.isInitialized()).toBe(false);
		});

		it('should report initialized state after successful init', async () => {
			const initPromise = protocolHandler.initialize();

			expect(protocolHandler.isInitialized()).toBe(false);

			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);

			await initPromise;

			expect(protocolHandler.isInitialized()).toBe(true);
		});

		it('should require both connection and initialization', async () => {
			// Initialize first
			const initPromise = protocolHandler.initialize();
			setTimeout(() => {
				mockConnectionManager.simulateMessage({
					jsonrpc: '2.0',
					id: 1,
					result: { protocolVersion: '2024-11-05' }
				});
			}, 0);
			await initPromise;

			expect(protocolHandler.isInitialized()).toBe(true);

			// Simulate connection loss
			mockConnectionManager.setConnected(false);

			expect(protocolHandler.isInitialized()).toBe(false);
		});
	});
});
