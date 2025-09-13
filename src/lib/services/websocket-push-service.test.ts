import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketPushService } from './websocket-push-service.js';

// Mock the MCP client
vi.mock('./mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn(() => true),
		handleMessage: vi.fn()
	}
}));

// Mock the tool registry
vi.mock('./tool-registry.js', () => ({
	toolRegistry: {
		getServer: vi.fn(),
		updateServerTools: vi.fn(),
		emit: vi.fn()
	}
}));

// Mock the tool discovery service
vi.mock('./mcp-tool-discovery.js', () => ({
	mcpToolDiscovery: {}
}));

// Create a testable version of the WebSocketPushService
class TestableWebSocketPushService extends WebSocketPushService {
	// Expose private methods for testing
	public handlePushNotification(message: any): void {
		return super['handlePushNotification'](message);
	}

	public emit(event: string, data: any): void {
		return super['emit'](event, data);
	}
}

describe('WebSocketPushService', () => {
	let pushService: TestableWebSocketPushService;
	let mockEventHandler: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		pushService = new TestableWebSocketPushService();
		mockEventHandler = vi.fn();
	});

	afterEach(() => {
		pushService.shutdown();
		vi.clearAllMocks();
	});

	describe('Event Subscription', () => {
		it('should allow subscribing to events', () => {
			const unsubscribe = pushService.on('serverStatusChanged', mockEventHandler);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should call event handlers when events are emitted', () => {
			pushService.on('serverStatusChanged', mockEventHandler);

			const testData = { serverId: 'test-server', connected: true };
			pushService.emit('serverStatusChanged', testData);

			expect(mockEventHandler).toHaveBeenCalledWith(testData);
		});

		it('should allow unsubscribing from events', () => {
			const unsubscribe = pushService.on('serverStatusChanged', mockEventHandler);

			unsubscribe();

			const testData = { serverId: 'test-server', connected: true };
			pushService.emit('serverStatusChanged', testData);

			expect(mockEventHandler).not.toHaveBeenCalled();
		});

		it('should handle multiple event listeners', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			pushService.on('serverStatusChanged', handler1);
			pushService.on('serverStatusChanged', handler2);

			const testData = { serverId: 'test-server', connected: true };
			pushService.emit('serverStatusChanged', testData);

			expect(handler1).toHaveBeenCalledWith(testData);
			expect(handler2).toHaveBeenCalledWith(testData);
		});
	});

	describe('Push Notification Handling', () => {
		it('should handle server status change notifications', () => {
			const handler = vi.fn();
			pushService.on('serverStatusChanged', handler);

			const message = {
				method: 'notification/server_status_changed',
				params: { serverId: 'test-server', connected: false }
			};

			pushService.handlePushNotification(message);

			expect(handler).toHaveBeenCalledWith({
				serverId: 'test-server',
				connected: false
			});
		});

		it('should handle tools discovered notifications', () => {
			const handler = vi.fn();
			pushService.on('toolsDiscovered', handler);

			const tools = [{ name: 'test-tool', description: 'Test tool' }];
			const message = {
				method: 'notification/tools_discovered',
				params: { serverId: 'test-server', tools }
			};

			pushService.handlePushNotification(message);

			expect(handler).toHaveBeenCalledWith({
				serverId: 'test-server',
				tools,
				timestamp: expect.any(Date)
			});
		});

		it('should handle project data change notifications', () => {
			const handler = vi.fn();
			pushService.on('projectDataChanged', handler);

			const message = {
				method: 'notification/project_data_changed',
				params: { type: 'requirement', id: 'REQ-001' }
			};

			pushService.handlePushNotification(message);

			expect(handler).toHaveBeenCalledWith({
				type: 'requirement',
				id: 'REQ-001'
			});
		});

		it('should handle heartbeat notifications', () => {
			const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			const message = {
				method: 'notification/heartbeat',
				params: {}
			};

			pushService.handlePushNotification(message);

			expect(consoleSpy).toHaveBeenCalledWith('Received heartbeat from server');

			consoleSpy.mockRestore();
		});

		it('should log unknown notification types', () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			const message = {
				method: 'notification/unknown_type',
				params: {}
			};

			pushService.handlePushNotification(message);

			expect(consoleSpy).toHaveBeenCalledWith('Unknown push notification type:', 'notification/unknown_type');

			consoleSpy.mockRestore();
		});
	});

	describe('Service State', () => {
		it('should start as not available', () => {
			expect(pushService.isAvailable()).toBe(false);
		});

		it('should provide statistics', () => {
			const stats = pushService.getStats();

			expect(stats).toEqual({
				initialized: false,
				timeSinceLastHeartbeat: expect.any(Number),
				activeListeners: 0,
				subscribedEvents: []
			});
		});

		it('should track active listeners in stats', () => {
			pushService.on('serverStatusChanged', vi.fn());
			pushService.on('toolsDiscovered', vi.fn());

			const stats = pushService.getStats();

			expect(stats.activeListeners).toBe(2);
			expect(stats.subscribedEvents).toEqual(['serverStatusChanged', 'toolsDiscovered']);
		});
	});

	describe('Error Handling', () => {
		it('should handle errors in event handlers gracefully', () => {
			const errorHandler = vi.fn(() => {
				throw new Error('Handler error');
			});
			const goodHandler = vi.fn();
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			pushService.on('serverStatusChanged', errorHandler);
			pushService.on('serverStatusChanged', goodHandler);

			const testData = { serverId: 'test-server', connected: true };
			pushService.emit('serverStatusChanged', testData);

			expect(errorHandler).toHaveBeenCalledWith(testData);
			expect(goodHandler).toHaveBeenCalledWith(testData);
			expect(consoleSpy).toHaveBeenCalledWith(
				'Error in push notification listener for serverStatusChanged:',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});
	});

	describe('Heartbeat Tracking', () => {
		it('should track time since last heartbeat', () => {
			const initialTime = pushService.getTimeSinceLastHeartbeat();

			// Should be a reasonable time (less than a few seconds)
			expect(initialTime).toBeLessThan(5000);

			// Simulate heartbeat
			const message = {
				method: 'notification/heartbeat',
				params: {}
			};

			pushService.handlePushNotification(message);

			// Time since heartbeat should be very small after handling heartbeat
			const afterHeartbeat = pushService.getTimeSinceLastHeartbeat();
			expect(afterHeartbeat).toBeLessThan(100);
		});
	});
});