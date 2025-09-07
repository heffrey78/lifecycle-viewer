// Test Helper Functions and Utilities
// Provides common testing patterns, setup helpers, and debugging utilities

import { vi, expect, type MockInstance } from 'vitest';
import { LifecycleMCPClient } from '../services/mcp-client.js';
import { EnhancedMockWebSocket, NetworkPreset } from './mock-websocket.js';
import { MCPProtocolMock, createMCPMock, MOCK_SCENARIOS } from './mcp-protocol-mocks.js';
import { TestDataGenerator, REQUIREMENT_FIXTURES, TASK_FIXTURES } from './test-fixtures.js';
import type { NetworkConditions } from './network-simulation.js';

// Test timing constants
export const TEST_TIMEOUTS = {
	IMMEDIATE: 0,
	FAST: 10,
	NORMAL: 100,
	SLOW: 500,
	VERY_SLOW: 1000,
	CONNECTION_TIMEOUT: 10000,
	REQUEST_TIMEOUT: 30000
} as const;

export const MOCK_DELAYS = {
	NETWORK: 10,
	DATABASE: 50,
	PROCESSING: 100,
	SLOW_OPERATION: 500
} as const;

// Test state management
export class TestEnvironment {
	private mockWebSocket: EnhancedMockWebSocket | null = null;
	private mcpClient: LifecycleMCPClient | null = null;
	private mcpMock: MCPProtocolMock | null = null;
	private originalWebSocket: typeof globalThis.WebSocket;
	private cleanupCallbacks: Array<() => void> = [];

	constructor() {
		this.originalWebSocket = globalThis.WebSocket;
	}

	// Setup methods
	async setupMCPClient(options: {
		serverUrl?: string;
		networkPreset?: NetworkPreset;
		networkConditions?: Partial<NetworkConditions>;
		autoConnect?: boolean;
		mcpScenario?: keyof typeof MOCK_SCENARIOS;
		enableLogging?: boolean;
	} = {}): Promise<{
		client: LifecycleMCPClient;
		mockWebSocket: EnhancedMockWebSocket;
		mcpMock: MCPProtocolMock;
	}> {
		// Setup MCP protocol mock
		const scenario = options.mcpScenario || 'realistic';
		this.mcpMock = MOCK_SCENARIOS[scenario]();
		
		if (options.enableLogging) {
			this.mcpMock.enableProtocolLogging(true);
		}

		// Setup WebSocket mock
		const webSocketSpy = vi.spyOn(global, 'WebSocket').mockImplementation((url: string | URL) => {
			this.mockWebSocket = new EnhancedMockWebSocket(url, undefined, {
				networkPreset: options.networkPreset || 'typical',
				networkConditions: options.networkConditions,
				autoConnect: options.autoConnect !== false,
				enableLogging: options.enableLogging || false
			});

			// Connect MCP mock to WebSocket mock
			this.setupMCPWebSocketIntegration();

			return this.mockWebSocket as unknown as WebSocket;
		});

		this.cleanupCallbacks.push(() => webSocketSpy.mockRestore());

		// Create MCP client
		this.mcpClient = new LifecycleMCPClient(options.serverUrl || 'ws://localhost:3000/mcp');

		return {
			client: this.mcpClient,
			mockWebSocket: this.mockWebSocket!,
			mcpMock: this.mcpMock
		};
	}

	private setupMCPWebSocketIntegration(): void {
		if (!this.mockWebSocket || !this.mcpMock) return;

		// Intercept outbound messages and generate MCP responses
		const originalSend = this.mockWebSocket.send.bind(this.mockWebSocket);
		this.mockWebSocket.send = (data: string | ArrayBuffer | Blob) => {
			originalSend(data);

			// Process as MCP request
			try {
				const messageData = typeof data === 'string' ? data : data.toString();
				const request = JSON.parse(messageData);
				
				// Generate response based on request
				setTimeout(async () => {
					if (this.mockWebSocket && this.mcpMock) {
						await this.mcpMock.simulateNetworkDelay();
						
						let response;
						if (request.method === 'initialize') {
							response = this.mcpMock.createInitializeResponse(request);
						} else if (request.method === 'tools/call') {
							response = this.mcpMock.createToolCallResponse(request);
						} else {
							// Unknown method
							response = this.mcpMock.createErrorResponse(
								request.id, 
								-32601, 
								`Method '${request.method}' not found`
							);
						}

						this.mockWebSocket.simulateMessage(response);
					}
				}, MOCK_DELAYS.NETWORK);
			} catch (error) {
				// Invalid JSON, ignore
			}
		};
	}

	// Connection helpers
	async establishConnection(timeout: number = TEST_TIMEOUTS.CONNECTION_TIMEOUT): Promise<void> {
		if (!this.mcpClient) {
			throw new Error('MCP client not setup. Call setupMCPClient first.');
		}

		const connectPromise = this.mcpClient.connect();
		
		// Wait for WebSocket to be ready
		await this.waitFor(() => this.mockWebSocket?.readyState === EnhancedMockWebSocket.OPEN, timeout);
		
		await connectPromise;
	}

	async waitForConnection(timeout: number = TEST_TIMEOUTS.CONNECTION_TIMEOUT): Promise<void> {
		await this.waitFor(() => this.mcpClient?.isConnected() === true, timeout);
	}

	// Assertion helpers
	expectConnected(): void {
		expect(this.mcpClient?.isConnected()).toBe(true);
	}

	expectDisconnected(): void {
		expect(this.mcpClient?.isConnected()).toBe(false);
	}

	expectLastMessage(expectedData: unknown, direction: 'inbound' | 'outbound' = 'inbound'): void {
		const lastMessage = this.mockWebSocket?.getLastMessage(direction);
		expect(lastMessage).toBeDefined();
		
		if (typeof expectedData === 'object') {
			const messageData = JSON.parse(lastMessage!.data);
			expect(messageData).toMatchObject(expectedData);
		} else {
			expect(lastMessage!.data).toContain(String(expectedData));
		}
	}

	expectMessageCount(count: number, direction?: 'inbound' | 'outbound'): void {
		const messages = this.mockWebSocket?.getMessageHistory() || [];
		const filteredMessages = direction 
			? messages.filter(m => m.direction === direction)
			: messages;
		expect(filteredMessages).toHaveLength(count);
	}

	// Error simulation
	simulateNetworkError(delay: number = 0): void {
		setTimeout(() => {
			this.mockWebSocket?.simulateError('Network error');
		}, delay);
	}

	simulateConnectionDrop(delay: number = 0): void {
		setTimeout(() => {
			this.mockWebSocket?.simulateUnexpectedClose(1006, 'Connection dropped');
		}, delay);
	}

	simulateServerError(delay: number = 0): void {
		if (this.mcpMock) {
			this.mcpMock.setErrorRate(1); // Ensure next request fails
			this.cleanupCallbacks.push(() => this.mcpMock?.setErrorRate(0));
		}
	}

	// Performance testing
	async measureExecutionTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
		const start = performance.now();
		const result = await operation();
		const duration = performance.now() - start;
		return { result, duration };
	}

	async stressTestConnection(operations: number = 100, concurrency: number = 10): Promise<{
		totalTime: number;
		averageTime: number;
		successCount: number;
		errorCount: number;
	}> {
		if (!this.mcpClient) {
			throw new Error('MCP client not setup');
		}

		const startTime = performance.now();
		const promises: Promise<unknown>[] = [];
		let successCount = 0;
		let errorCount = 0;

		// Create batches of concurrent operations
		for (let i = 0; i < operations; i += concurrency) {
			const batch = Math.min(concurrency, operations - i);
			
			for (let j = 0; j < batch; j++) {
				const promise = this.mcpClient.getRequirements()
					.then(() => { successCount++; })
					.catch(() => { errorCount++; });
				promises.push(promise);
			}

			// Wait for batch to complete before starting next
			await Promise.allSettled(promises.slice(-batch));
		}

		await Promise.allSettled(promises);
		
		const totalTime = performance.now() - startTime;
		return {
			totalTime,
			averageTime: totalTime / operations,
			successCount,
			errorCount
		};
	}

	// Utility methods
	async waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
		const start = Date.now();
		while (!condition()) {
			if (Date.now() - start > timeout) {
				throw new Error(`Timeout waiting for condition after ${timeout}ms`);
			}
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}

	async sleep(ms: number): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, ms));
	}

	// Cleanup
	cleanup(): void {
		// Run all cleanup callbacks
		this.cleanupCallbacks.forEach(callback => {
			try {
				callback();
			} catch (error) {
				console.warn('Cleanup callback failed:', error);
			}
		});
		this.cleanupCallbacks = [];

		// Cleanup WebSocket
		if (this.mockWebSocket) {
			this.mockWebSocket.close();
			this.mockWebSocket = null;
		}

		// Cleanup MCP client
		if (this.mcpClient) {
			this.mcpClient.disconnect();
			this.mcpClient = null;
		}

		// Reset test data generators
		TestDataGenerator.resetCounters();

		// Restore global WebSocket
		globalThis.WebSocket = this.originalWebSocket;
	}
}

// Factory functions for common test scenarios
export const createTestEnvironment = (): TestEnvironment => new TestEnvironment();

export const createConnectedMCPClient = async (options?: Parameters<TestEnvironment['setupMCPClient']>[0]): Promise<{
	testEnv: TestEnvironment;
	client: LifecycleMCPClient;
	mockWebSocket: EnhancedMockWebSocket;
	mcpMock: MCPProtocolMock;
}> => {
	const testEnv = createTestEnvironment();
	const setup = await testEnv.setupMCPClient(options);
	await testEnv.establishConnection();
	
	return {
		testEnv,
		...setup
	};
};

// Vitest test helpers
export const describeWithMCP = (name: string, testSuite: (helpers: {
	setupMCP: (options?: Parameters<TestEnvironment['setupMCPClient']>[0]) => Promise<{
		testEnv: TestEnvironment;
		client: LifecycleMCPClient;
		mockWebSocket: EnhancedMockWebSocket;
		mcpMock: MCPProtocolMock;
	}>;
	createRequirement: () => ReturnType<typeof REQUIREMENT_FIXTURES.draft>;
	createTask: () => ReturnType<typeof TASK_FIXTURES.notStarted>;
}) => void) => {
	describe(name, () => {
		testSuite({
			setupMCP: createConnectedMCPClient,
			createRequirement: REQUIREMENT_FIXTURES.draft,
			createTask: TASK_FIXTURES.notStarted
		});
	});
};

// Performance benchmarking helpers
export const benchmarkOperation = async <T>(
	name: string, 
	operation: () => Promise<T>, 
	iterations: number = 100
): Promise<{
	name: string;
	iterations: number;
	totalTime: number;
	averageTime: number;
	minTime: number;
	maxTime: number;
	result: T;
}> => {
	const times: number[] = [];
	let result: T;

	for (let i = 0; i < iterations; i++) {
		const start = performance.now();
		result = await operation();
		const duration = performance.now() - start;
		times.push(duration);
	}

	return {
		name,
		iterations,
		totalTime: times.reduce((sum, time) => sum + time, 0),
		averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
		minTime: Math.min(...times),
		maxTime: Math.max(...times),
		result: result!
	};
};

// Debug helpers
export const debugTestState = (testEnv: TestEnvironment): void => {
	const mockWebSocket = (testEnv as any).mockWebSocket;
	const mcpClient = (testEnv as any).mcpClient;
	
	console.log('=== TEST STATE DEBUG ===');
	console.log('WebSocket State:', {
		readyState: mockWebSocket?.readyState,
		url: mockWebSocket?.url,
		messageHistory: mockWebSocket?.getMessageHistory().length
	});
	console.log('MCP Client State:', {
		connected: mcpClient?.isConnected(),
	});
	console.log('Recent Messages:', mockWebSocket?.getMessageHistory().slice(-3));
	console.log('========================');
};

// Type-safe mock helpers
export const mockLifecycleMCPClient = (): MockInstance<any[], LifecycleMCPClient> => {
	return vi.fn(() => ({
		connect: vi.fn(),
		disconnect: vi.fn(),
		isConnected: vi.fn(() => true),
		getRequirements: vi.fn(),
		getTaskDetails: vi.fn(),
		createTask: vi.fn(),
		updateTaskStatus: vi.fn()
	})) as any;
};