// Tool Registry Integration Service
// Provides real-time updates and integration with the existing MCP client system

import { mcpClient } from './mcp-client.js';
import { toolRegistry } from './tool-registry.js';
import { mcpToolDiscovery } from './mcp-tool-discovery.js';

class ToolRegistryIntegrationService {
	private initialized = false;
	private connectionCheckInterval: NodeJS.Timeout | null = null;

	/**
	 * Initialize the tool registry integration
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Set up event listeners for MCP client connection changes
		this.setupConnectionListeners();

		// Start auto-discovery of tools
		mcpToolDiscovery.startAutoDiscovery(30000); // Check every 30 seconds

		// Start periodic connection status checks
		this.startConnectionChecks();

		// Initial tool discovery if already connected
		if (mcpClient.isConnected()) {
			await mcpToolDiscovery.discoverAllTools();
		}

		this.initialized = true;
	}

	/**
	 * Shutdown the integration service
	 */
	shutdown(): void {
		if (!this.initialized) return;

		mcpToolDiscovery.stopAutoDiscovery();
		this.stopConnectionChecks();
		this.initialized = false;
	}

	/**
	 * Manually trigger tool discovery for all servers
	 */
	async refreshTools(): Promise<void> {
		await mcpToolDiscovery.discoverAllTools();
	}

	/**
	 * Get real-time tool registry statistics
	 */
	getRegistryStats() {
		return {
			...toolRegistry.getStats(),
			autoDiscoveryEnabled: mcpToolDiscovery['isAutoDiscovering'],
			lastUpdateTime: new Date().toISOString()
		};
	}

	private setupConnectionListeners(): void {
		// Listen for tool registry events and log them
		toolRegistry.on('serverConnected', (data) => {
			console.log(`MCP server connected: ${data.server.name} (${data.server.id})`);
		});

		toolRegistry.on('serverDisconnected', (data) => {
			console.log(`MCP server disconnected: ${data.serverId}`);
		});

		toolRegistry.on('toolsChanged', (data) => {
			console.log(`Tools updated for server ${data.serverId}:`, data.tools.length, 'tools');
		});

		toolRegistry.on('toolExecuted', (data) => {
			console.log(
				`Tool executed: ${data.tool.name} from ${data.tool.serverName} (${data.duration}ms)`
			);
		});
	}

	private startConnectionChecks(): void {
		this.connectionCheckInterval = setInterval(async () => {
			try {
				await mcpToolDiscovery.updateServerStatuses();
			} catch (error) {
				console.error('Connection status check failed:', error);
			}
		}, 10000); // Check every 10 seconds
	}

	private stopConnectionChecks(): void {
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval);
			this.connectionCheckInterval = null;
		}
	}
}

// Singleton instance
export const toolRegistryIntegration = new ToolRegistryIntegrationService();

// Auto-initialize on module load in browser environments
if (typeof window !== 'undefined') {
	toolRegistryIntegration.initialize().catch((error) => {
		console.error('Failed to initialize tool registry integration:', error);
	});
}
