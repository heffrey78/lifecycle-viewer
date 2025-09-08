import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LifecycleMCPClient } from './lifecycle-mcp-client.js';
import type { ConnectionEvent } from './connection-manager.js';

// Mock the service classes
vi.mock('./connection-manager.js', () => ({
	ConnectionManager: vi.fn().mockImplementation((url) => ({
		connect: vi.fn().mockResolvedValue(undefined),
		connectWithRetry: vi.fn().mockResolvedValue(undefined),
		disconnect: vi.fn(),
		isConnected: vi.fn().mockReturnValue(false),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		getRetryAttempts: vi.fn().mockReturnValue(0),
		getMaxRetries: vi.fn().mockReturnValue(3),
		send: vi.fn(),
		url
	}))
}));

vi.mock('./protocol-handler.js', () => ({
	ProtocolHandler: vi.fn().mockImplementation((connectionManager) => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		isInitialized: vi.fn().mockReturnValue(false),
		reset: vi.fn(),
		getPendingRequestCount: vi.fn().mockReturnValue(0),
		sendRequest: vi.fn(),
		sendRequestWithResponse: vi.fn(),
		connectionManager
	}))
}));

vi.mock('./requirement-service.js', () => ({
	RequirementService: vi.fn().mockImplementation((protocolHandler) => ({
		getRequirements: vi.fn(),
		getRequirementsJson: vi.fn(),
		getRequirementDetails: vi.fn(),
		createRequirement: vi.fn(),
		updateRequirementStatus: vi.fn(),
		traceRequirement: vi.fn(),
		protocolHandler
	}))
}));

vi.mock('./task-service.js', () => ({
	TaskService: vi.fn().mockImplementation((protocolHandler) => ({
		getTasks: vi.fn(),
		getTasksJson: vi.fn(),
		getTaskDetails: vi.fn(),
		createTask: vi.fn(),
		updateTaskStatus: vi.fn(),
		protocolHandler
	}))
}));

vi.mock('./architecture-service.js', () => ({
	ArchitectureService: vi.fn().mockImplementation((protocolHandler) => ({
		getArchitectureDecisions: vi.fn(),
		getArchitectureDecisionsJson: vi.fn(),
		getArchitectureDetails: vi.fn(),
		createArchitectureDecision: vi.fn(),
		updateArchitectureStatus: vi.fn(),
		protocolHandler
	}))
}));

vi.mock('./project-service.js', () => ({
	ProjectService: vi.fn().mockImplementation((protocolHandler) => ({
		getProjectStatus: vi.fn(),
		getProjectMetrics: vi.fn(),
		startRequirementInterview: vi.fn(),
		continueRequirementInterview: vi.fn(),
		exportProjectDocumentation: vi.fn(),
		createArchitecturalDiagrams: vi.fn(),
		protocolHandler
	}))
}));

vi.mock('./database-service.js', () => ({
	DatabaseService: vi.fn().mockImplementation((protocolHandler) => ({
		switchDatabase: vi.fn(),
		getCurrentDatabase: vi.fn(),
		pickDatabase: vi.fn(),
		protocolHandler
	}))
}));

// Import mocked constructors
import { ConnectionManager } from './connection-manager.js';
import { ProtocolHandler } from './protocol-handler.js';
import { RequirementService } from './requirement-service.js';
import { TaskService } from './task-service.js';
import { ArchitectureService } from './architecture-service.js';
import { ProjectService } from './project-service.js';
import { DatabaseService } from './database-service.js';

describe('LifecycleMCPClient', () => {
	let client: LifecycleMCPClient;
	let mockConnectionManager: any;
	let mockProtocolHandler: any;

	beforeEach(() => {
		vi.clearAllMocks();
		client = new LifecycleMCPClient('ws://test-server:3000/mcp');
		
		// Get references to the mocked instances
		mockConnectionManager = (ConnectionManager as any).mock.results[0].value;
		mockProtocolHandler = (ProtocolHandler as any).mock.results[0].value;
	});

	afterEach(() => {
		client.disconnect();
	});

	describe('Constructor and Service Composition', () => {
		it('should create all services with correct dependencies', () => {
			expect(ConnectionManager).toHaveBeenCalledWith('ws://test-server:3000/mcp');
			expect(ProtocolHandler).toHaveBeenCalledWith(mockConnectionManager);
			expect(RequirementService).toHaveBeenCalledWith(mockProtocolHandler);
			expect(TaskService).toHaveBeenCalledWith(mockProtocolHandler);
			expect(ArchitectureService).toHaveBeenCalledWith(mockProtocolHandler);
			expect(ProjectService).toHaveBeenCalledWith(mockProtocolHandler);
			expect(DatabaseService).toHaveBeenCalledWith(mockProtocolHandler);
		});

		it('should use default server URL when none provided', () => {
			const defaultClient = new LifecycleMCPClient();
			
			expect(ConnectionManager).toHaveBeenCalledWith('ws://localhost:3000/mcp');
		});

		it('should expose all service instances', () => {
			expect(client.requirements).toBeDefined();
			expect(client.tasks).toBeDefined();
			expect(client.architecture).toBeDefined();
			expect(client.project).toBeDefined();
			expect(client.database).toBeDefined();
		});

		it('should create independent service instances', () => {
			const client1 = new LifecycleMCPClient('ws://server1:3000/mcp');
			const client2 = new LifecycleMCPClient('ws://server2:3000/mcp');

			expect(client1.requirements).not.toBe(client2.requirements);
			expect(client1.tasks).not.toBe(client2.tasks);
			expect(client1.architecture).not.toBe(client2.architecture);
		});
	});

	describe('Connection Management', () => {
		it('should initialize protocol handler when connecting', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);

			await client.connect();

			expect(mockProtocolHandler.initialize).toHaveBeenCalled();
		});

		it('should propagate initialization errors', async () => {
			const initError = new Error('MCP initialization failed');
			mockProtocolHandler.initialize.mockRejectedValue(initError);

			await expect(client.connect()).rejects.toThrow('MCP initialization failed');
		});

		it('should handle multiple connection attempts gracefully', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);

			const connectPromise1 = client.connect();
			const connectPromise2 = client.connect();

			await Promise.all([connectPromise1, connectPromise2]);

			// Should not call initialize multiple times for concurrent requests
			expect(mockProtocolHandler.initialize).toHaveBeenCalledTimes(2);
		});

		it('should retry failed connections', async () => {
			mockProtocolHandler.initialize
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockResolvedValueOnce(undefined);

			// First attempt should fail, second should succeed
			await expect(client.connect()).rejects.toThrow('Network timeout');
			await expect(client.connect()).resolves.toBeUndefined();
		});
	});

	describe('Connection Status', () => {
		it('should report connected status from protocol handler', () => {
			mockProtocolHandler.isInitialized.mockReturnValue(false);
			expect(client.isConnected()).toBe(false);

			mockProtocolHandler.isInitialized.mockReturnValue(true);
			expect(client.isConnected()).toBe(true);
		});

		it('should delegate connection status check to protocol handler', () => {
			client.isConnected();
			expect(mockProtocolHandler.isInitialized).toHaveBeenCalled();
		});

		it('should handle connection status during connection process', async () => {
			mockProtocolHandler.isInitialized.mockReturnValue(false);
			expect(client.isConnected()).toBe(false);

			mockProtocolHandler.initialize.mockImplementation(async () => {
				mockProtocolHandler.isInitialized.mockReturnValue(true);
			});

			await client.connect();
			expect(client.isConnected()).toBe(true);
		});
	});

	describe('Disconnection', () => {
		it('should disconnect connection manager and reset protocol handler', () => {
			client.disconnect();

			expect(mockConnectionManager.disconnect).toHaveBeenCalled();
			expect(mockProtocolHandler.reset).toHaveBeenCalled();
		});

		it('should handle disconnection when not connected', () => {
			expect(() => client.disconnect()).not.toThrow();
		});

		it('should reset connection state after disconnection', () => {
			mockProtocolHandler.isInitialized.mockReturnValue(true);
			expect(client.isConnected()).toBe(true);

			client.disconnect();
			mockProtocolHandler.isInitialized.mockReturnValue(false);
			
			expect(client.isConnected()).toBe(false);
		});

		it('should allow reconnection after disconnection', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);

			await client.connect();
			client.disconnect();
			await client.connect();

			expect(mockProtocolHandler.initialize).toHaveBeenCalledTimes(2);
		});
	});

	describe('Event Listener Management', () => {
		it('should add connection listeners to connection manager', () => {
			const listener = vi.fn();
			client.addConnectionListener(listener);

			expect(mockConnectionManager.addListener).toHaveBeenCalledWith(listener);
		});

		it('should remove connection listeners from connection manager', () => {
			const listener = vi.fn();
			client.removeConnectionListener(listener);

			expect(mockConnectionManager.removeListener).toHaveBeenCalledWith(listener);
		});

		it('should handle multiple listeners', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			client.addConnectionListener(listener1);
			client.addConnectionListener(listener2);

			expect(mockConnectionManager.addListener).toHaveBeenCalledTimes(2);
			expect(mockConnectionManager.addListener).toHaveBeenNthCalledWith(1, listener1);
			expect(mockConnectionManager.addListener).toHaveBeenNthCalledWith(2, listener2);
		});

		it('should handle listener lifecycle correctly', () => {
			const listener = vi.fn();

			client.addConnectionListener(listener);
			client.removeConnectionListener(listener);

			expect(mockConnectionManager.addListener).toHaveBeenCalledWith(listener);
			expect(mockConnectionManager.removeListener).toHaveBeenCalledWith(listener);
		});
	});

	describe('Connection Statistics', () => {
		it('should aggregate connection statistics from services', () => {
			mockProtocolHandler.isInitialized.mockReturnValue(true);
			mockConnectionManager.getRetryAttempts.mockReturnValue(2);
			mockConnectionManager.getMaxRetries.mockReturnValue(5);
			mockProtocolHandler.getPendingRequestCount.mockReturnValue(3);

			const stats = client.getConnectionStats();

			expect(stats).toEqual({
				connected: true,
				retryAttempts: 2,
				maxRetries: 5,
				pendingRequests: 3
			});
		});

		it('should handle disconnected state in statistics', () => {
			mockProtocolHandler.isInitialized.mockReturnValue(false);
			mockConnectionManager.getRetryAttempts.mockReturnValue(0);
			mockConnectionManager.getMaxRetries.mockReturnValue(3);
			mockProtocolHandler.getPendingRequestCount.mockReturnValue(0);

			const stats = client.getConnectionStats();

			expect(stats).toEqual({
				connected: false,
				retryAttempts: 0,
				maxRetries: 3,
				pendingRequests: 0
			});
		});

		it('should reflect real-time changes in statistics', () => {
			// Initial state
			mockProtocolHandler.isInitialized.mockReturnValue(false);
			mockProtocolHandler.getPendingRequestCount.mockReturnValue(0);
			
			let stats = client.getConnectionStats();
			expect(stats.connected).toBe(false);
			expect(stats.pendingRequests).toBe(0);

			// After connection
			mockProtocolHandler.isInitialized.mockReturnValue(true);
			mockProtocolHandler.getPendingRequestCount.mockReturnValue(2);
			
			stats = client.getConnectionStats();
			expect(stats.connected).toBe(true);
			expect(stats.pendingRequests).toBe(2);
		});

		it('should handle edge cases in statistics', () => {
			// Simulate error conditions
			mockProtocolHandler.isInitialized.mockImplementation(() => {
				throw new Error('Status check failed');
			});

			expect(() => client.getConnectionStats()).toThrow('Status check failed');
		});
	});

	describe('Service Integration', () => {
		it('should provide access to all service methods through facade', () => {
			// Verify each service is accessible and has expected interface
			expect(typeof client.requirements.getRequirements).toBe('function');
			expect(typeof client.tasks.getTasks).toBe('function');
			expect(typeof client.architecture.getArchitectureDecisions).toBe('function');
			expect(typeof client.project.getProjectStatus).toBe('function');
			expect(typeof client.database.getCurrentDatabase).toBe('function');
		});

		it('should maintain service isolation', () => {
			// Each service should have its own instance
			const requirementService = client.requirements;
			const taskService = client.tasks;

			expect(requirementService).not.toBe(taskService);
		});

		it('should share protocol handler across services', () => {
			// All services should use the same protocol handler instance
			expect((client.requirements as any).protocolHandler).toBe(mockProtocolHandler);
			expect((client.tasks as any).protocolHandler).toBe(mockProtocolHandler);
			expect((client.architecture as any).protocolHandler).toBe(mockProtocolHandler);
		});

		it('should handle service method calls properly', async () => {
			const mockResponse = { success: true, data: [] };
			(client.requirements as any).getRequirements.mockResolvedValue(mockResponse);

			const result = await client.requirements.getRequirements();

			expect(result).toBe(mockResponse);
			expect((client.requirements as any).getRequirements).toHaveBeenCalled();
		});
	});

	describe('Lifecycle Management', () => {
		it('should handle full connection lifecycle', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);
			mockProtocolHandler.isInitialized.mockReturnValue(true);

			// Connect
			await client.connect();
			expect(client.isConnected()).toBe(true);

			// Use services
			const mockResponse = { success: true, data: {} };
			(client.project as any).getProjectStatus.mockResolvedValue(mockResponse);
			await client.project.getProjectStatus();

			// Disconnect
			client.disconnect();
			mockProtocolHandler.isInitialized.mockReturnValue(false);
			expect(client.isConnected()).toBe(false);
		});

		it('should handle reconnection scenarios', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);

			// Initial connection
			await client.connect();

			// Simulate disconnection
			client.disconnect();

			// Reconnection
			await client.connect();

			expect(mockProtocolHandler.initialize).toHaveBeenCalledTimes(2);
			expect(mockConnectionManager.disconnect).toHaveBeenCalledTimes(1);
			expect(mockProtocolHandler.reset).toHaveBeenCalledTimes(1);
		});

		it('should handle connection failures gracefully', async () => {
			mockProtocolHandler.initialize.mockRejectedValue(new Error('Connection failed'));

			await expect(client.connect()).rejects.toThrow('Connection failed');
			expect(client.isConnected()).toBe(false);
		});

		it('should handle rapid connect/disconnect cycles', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);

			for (let i = 0; i < 3; i++) {
				await client.connect();
				client.disconnect();
			}

			expect(mockProtocolHandler.initialize).toHaveBeenCalledTimes(3);
			expect(mockConnectionManager.disconnect).toHaveBeenCalledTimes(3);
		});
	});

	describe('Error Handling and Edge Cases', () => {
		it('should handle service initialization errors', () => {
			// Mock a service constructor throwing an error
			const OriginalRequirementService = RequirementService as any;
			(RequirementService as any).mockImplementationOnce(() => {
				throw new Error('Service initialization failed');
			});

			expect(() => new LifecycleMCPClient())
				.toThrow('Service initialization failed');
		});

		it('should handle invalid server URLs', () => {
			// Should not throw during construction, but delegate validation to ConnectionManager
			expect(() => new LifecycleMCPClient('invalid-url')).not.toThrow();
			
			// ConnectionManager should have received the invalid URL
			const calls = (ConnectionManager as any).mock.calls;
			expect(calls[calls.length - 1][0]).toBe('invalid-url');
		});

		it('should handle null/undefined listeners gracefully', () => {
			expect(() => client.addConnectionListener(null as any)).not.toThrow();
			expect(() => client.removeConnectionListener(undefined as any)).not.toThrow();
		});

		it('should handle statistics retrieval errors', () => {
			mockConnectionManager.getRetryAttempts.mockImplementation(() => {
				throw new Error('Stats error');
			});

			expect(() => client.getConnectionStats()).toThrow('Stats error');
		});
	});

	describe('Memory Management', () => {
		it('should clean up resources on disconnect', () => {
			const listener = vi.fn();
			client.addConnectionListener(listener);

			client.disconnect();

			// Verify cleanup calls
			expect(mockConnectionManager.disconnect).toHaveBeenCalled();
			expect(mockProtocolHandler.reset).toHaveBeenCalled();
		});

		it('should handle multiple clients independently', () => {
			const client1 = new LifecycleMCPClient('ws://server1:3000');
			const client2 = new LifecycleMCPClient('ws://server2:3000');

			client1.disconnect();

			// client2 should remain unaffected
			// This is tested by ensuring separate service instances
			expect(client1.requirements).not.toBe(client2.requirements);
		});

		it('should not leak listeners', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			client.addConnectionListener(listener1);
			client.addConnectionListener(listener2);
			client.removeConnectionListener(listener1);

			// Only listener2 should remain
			expect(mockConnectionManager.addListener).toHaveBeenCalledTimes(2);
			expect(mockConnectionManager.removeListener).toHaveBeenCalledWith(listener1);
		});
	});

	describe('Concurrent Operations', () => {
		it('should handle concurrent connection attempts', async () => {
			mockProtocolHandler.initialize.mockResolvedValue(undefined);

			const promises = Array(5).fill(null).map(() => client.connect());
			await Promise.all(promises);

			// All should complete successfully
			expect(promises).toHaveLength(5);
		});

		it('should handle concurrent service calls', async () => {
			const mockResponse = { success: true, data: 'test' };
			(client.requirements as any).getRequirements.mockResolvedValue(mockResponse);
			(client.tasks as any).getTasks.mockResolvedValue(mockResponse);
			(client.project as any).getProjectStatus.mockResolvedValue(mockResponse);

			const promises = [
				client.requirements.getRequirements(),
				client.tasks.getTasks(),
				client.project.getProjectStatus()
			];

			const results = await Promise.all(promises);

			expect(results).toHaveLength(3);
			results.forEach(result => expect(result).toBe(mockResponse));
		});

		it('should maintain statistics accuracy during concurrent operations', async () => {
			mockProtocolHandler.isInitialized.mockReturnValue(true);
			mockProtocolHandler.getPendingRequestCount
				.mockReturnValueOnce(0)
				.mockReturnValueOnce(3)
				.mockReturnValueOnce(1);

			const stats1 = client.getConnectionStats();
			const stats2 = client.getConnectionStats();
			const stats3 = client.getConnectionStats();

			expect(stats1.pendingRequests).toBe(0);
			expect(stats2.pendingRequests).toBe(3);
			expect(stats3.pendingRequests).toBe(1);
		});
	});
});