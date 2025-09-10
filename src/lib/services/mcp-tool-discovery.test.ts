// MCP Tool Discovery Service Tests
// Tests for automatic tool discovery and server integration

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPToolDiscoveryService } from './mcp-tool-discovery.js';
import type { MCPToolDiscovery } from './mcp-tool-discovery.js';
import type { MCPTool } from '$lib/types/mcp-tools.js';
import { ToolCategory } from '$lib/types/mcp-tools.js';

// Mock tool registry to avoid side effects
vi.mock('./tool-registry.js', () => ({
	toolRegistry: {
		registerServer: vi.fn(),
		unregisterServer: vi.fn(),
		updateServerTools: vi.fn(),
		getServer: vi.fn(),
		emit: vi.fn()
	}
}));

describe('MCPToolDiscoveryService', () => {
	let discoveryService: MCPToolDiscoveryService;
	let mockDiscoverer: MCPToolDiscovery;

	const mockTools: MCPTool[] = [
		{
			name: 'test_tool_1',
			description: 'First test tool',
			inputSchema: {
				type: 'object',
				properties: { param1: { type: 'string' } },
				required: ['param1']
			},
			serverId: 'test-server',
			serverName: 'Test Server',
			category: ToolCategory.UTILITY,
			tags: ['test']
		},
		{
			name: 'test_tool_2',
			description: 'Second test tool',
			inputSchema: {
				type: 'object',
				properties: { param2: { type: 'number' } }
			},
			serverId: 'test-server',
			serverName: 'Test Server',
			category: ToolCategory.API,
			tags: ['test', 'api']
		}
	];

	beforeEach(() => {
		discoveryService = new MCPToolDiscoveryService();

		// Clear the default lifecycle discoverer for clean testing
		discoveryService['discoverers'].clear();

		// Create mock discoverer
		mockDiscoverer = {
			serverId: 'test-server',
			serverName: 'Test Server',
			transport: 'websocket',
			discoverTools: vi.fn().mockResolvedValue(mockTools),
			isConnected: vi.fn().mockReturnValue(true),
			getCapabilities: vi.fn().mockResolvedValue({
				tools: mockTools.map((t) => t.name),
				resources: false,
				prompts: false
			})
		};
	});

	afterEach(() => {
		discoveryService.destroy();
	});

	describe('Discoverer Registration', () => {
		it('should register a new discoverer', () => {
			discoveryService.registerDiscoverer(mockDiscoverer);

			const discoverers = discoveryService.getDiscoverers();
			expect(discoverers.has('test-server')).toBe(true);
			expect(discoverers.get('test-server')).toBe(mockDiscoverer);
		});

		it('should unregister a discoverer', () => {
			discoveryService.registerDiscoverer(mockDiscoverer);
			discoveryService.unregisterDiscoverer('test-server');

			const discoverers = discoveryService.getDiscoverers();
			expect(discoverers.has('test-server')).toBe(false);
		});

		it('should discover tools when registering connected discoverer', async () => {
			const discoverSpy = vi.spyOn(mockDiscoverer, 'discoverTools');

			discoveryService.registerDiscoverer(mockDiscoverer);

			// Give time for async discovery
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(discoverSpy).toHaveBeenCalled();
		});

		it('should not discover tools when registering disconnected discoverer', () => {
			const discoverSpy = vi.spyOn(mockDiscoverer, 'discoverTools');
			mockDiscoverer.isConnected = vi.fn().mockReturnValue(false);

			discoveryService.registerDiscoverer(mockDiscoverer);

			expect(discoverSpy).not.toHaveBeenCalled();
		});
	});

	describe('Tool Discovery', () => {
		beforeEach(() => {
			discoveryService.registerDiscoverer(mockDiscoverer);
		});

		it('should discover tools for a specific server', async () => {
			const tools = await discoveryService.discoverToolsForServer('test-server');

			expect(tools).toEqual(mockTools);
			expect(mockDiscoverer.discoverTools).toHaveBeenCalled();
		});

		it('should throw error for unknown server', async () => {
			await expect(discoveryService.discoverToolsForServer('unknown-server')).rejects.toThrow(
				'No discoverer registered for server unknown-server'
			);
		});

		it('should handle discovery errors gracefully', async () => {
			mockDiscoverer.discoverTools = vi.fn().mockRejectedValue(new Error('Discovery failed'));
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const tools = await discoveryService.discoverToolsForServer('test-server');

			expect(tools).toEqual([]);
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to discover tools for server test-server:',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		it('should discover tools for all connected servers', async () => {
			const mockDiscoverer2: MCPToolDiscovery = {
				serverId: 'test-server-2',
				serverName: 'Test Server 2',
				transport: 'stdio',
				discoverTools: vi.fn().mockResolvedValue([mockTools[0]]),
				isConnected: vi.fn().mockReturnValue(true),
				getCapabilities: vi.fn().mockResolvedValue({ tools: ['test_tool_1'] })
			};

			discoveryService.registerDiscoverer(mockDiscoverer2);

			const results = await discoveryService.discoverAllTools();

			expect(results.size).toBe(2);
			expect(results.get('test-server')).toEqual(mockTools);
			expect(results.get('test-server-2')).toEqual([mockTools[0]]);
		});

		it('should skip disconnected servers in bulk discovery', async () => {
			// Mock as disconnected and clear previous calls
			mockDiscoverer.isConnected = vi.fn().mockReturnValue(false);
			vi.clearAllMocks();

			const results = await discoveryService.discoverAllTools();

			expect(results.size).toBe(0);
			expect(mockDiscoverer.discoverTools).not.toHaveBeenCalled();
		});
	});

	describe('Auto-Discovery', () => {
		beforeEach(() => {
			discoveryService.registerDiscoverer(mockDiscoverer);
		});

		it('should start auto-discovery with interval', async () => {
			const discoverSpy = vi.spyOn(discoveryService, 'discoverAllTools');

			discoveryService.startAutoDiscovery(100); // 100ms interval for testing

			// Wait for initial discovery + one interval
			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(discoverSpy).toHaveBeenCalledTimes(2); // Initial + one interval
			expect(discoveryService['isAutoDiscovering']).toBe(true);

			discoveryService.stopAutoDiscovery();
		});

		it('should stop auto-discovery', () => {
			discoveryService.startAutoDiscovery(1000);
			expect(discoveryService['isAutoDiscovering']).toBe(true);

			discoveryService.stopAutoDiscovery();
			expect(discoveryService['isAutoDiscovering']).toBe(false);
			expect(discoveryService['discoveryInterval']).toBeNull();
		});

		it('should restart auto-discovery when already running', () => {
			const stopSpy = vi.spyOn(discoveryService, 'stopAutoDiscovery');

			discoveryService.startAutoDiscovery(1000);
			discoveryService.startAutoDiscovery(500); // Different interval

			expect(stopSpy).toHaveBeenCalled();
			expect(discoveryService['isAutoDiscovering']).toBe(true);

			discoveryService.stopAutoDiscovery();
		});

		it('should handle errors during auto-discovery', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockDiscoverer.discoverTools = vi.fn().mockRejectedValue(new Error('Auto-discovery error'));

			discoveryService.startAutoDiscovery(50); // Fast interval for testing

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to discover tools for server test-server:',
				expect.any(Error)
			);

			discoveryService.stopAutoDiscovery();
			consoleSpy.mockRestore();
		});
	});

	describe('Server Status Updates', () => {
		it('should detect server connection changes', async () => {
			const { toolRegistry } = await import('./tool-registry.js');
			const mockServer = {
				id: 'test-server',
				connected: false,
				lastUpdated: new Date()
			};
			vi.mocked(toolRegistry.getServer).mockReturnValue(mockServer);
			vi.mocked(toolRegistry.emit).mockImplementation(() => {});

			// Register server as disconnected initially
			mockDiscoverer.isConnected = vi.fn().mockReturnValue(false);
			discoveryService.registerDiscoverer(mockDiscoverer);

			// Simulate server connecting
			mockDiscoverer.isConnected = vi.fn().mockReturnValue(true);
			const discoverSpy = vi.spyOn(discoveryService, 'discoverToolsForServer');

			await discoveryService.updateServerStatuses();

			expect(discoverSpy).toHaveBeenCalledWith('test-server');
		});

		it('should handle server disconnection', async () => {
			const { toolRegistry } = await import('./tool-registry.js');
			const mockServer = {
				id: 'test-server',
				connected: true,
				lastUpdated: new Date()
			};
			vi.mocked(toolRegistry.getServer).mockReturnValue(mockServer);
			vi.mocked(toolRegistry.emit).mockImplementation(() => {});

			// Register server as connected initially
			discoveryService.registerDiscoverer(mockDiscoverer);

			// Simulate server disconnecting
			mockDiscoverer.isConnected = vi.fn().mockReturnValue(false);

			await discoveryService.updateServerStatuses();

			// Should emit disconnection event
			expect(toolRegistry.emit).toHaveBeenCalledWith('serverDisconnected', {
				serverId: 'test-server'
			});
		});
	});

	describe('Lifecycle Management', () => {
		it('should clean up resources on destroy', () => {
			discoveryService.startAutoDiscovery(1000);
			discoveryService.registerDiscoverer(mockDiscoverer);

			discoveryService.destroy();

			expect(discoveryService['isAutoDiscovering']).toBe(false);
			expect(discoveryService['discoveryInterval']).toBeNull();
			expect(discoveryService['discoverers'].size).toBe(0);
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			discoveryService.registerDiscoverer(mockDiscoverer);
		});

		it('should handle network timeouts gracefully', async () => {
			const timeoutError = new Error('Network timeout');
			mockDiscoverer.discoverTools = vi.fn().mockRejectedValue(timeoutError);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const results = await discoveryService.discoverAllTools();

			expect(results.get('test-server')).toEqual([]);
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to discover tools for server test-server:',
				timeoutError
			);

			consoleSpy.mockRestore();
		});

		it('should handle malformed tool responses', async () => {
			const malformedTools = [
				{ name: 'incomplete_tool' }, // Missing required fields
				null,
				undefined,
				{ name: 'valid_tool', inputSchema: { type: 'object', properties: {} }, serverId: 'test' }
			];

			mockDiscoverer.discoverTools = vi.fn().mockResolvedValue(malformedTools as any);

			// Should not throw, but might log warnings
			const tools = await discoveryService.discoverToolsForServer('test-server');
			expect(Array.isArray(tools)).toBe(true);
		});
	});
});
