// Tool Registry Integration Service
// Provides real-time updates and integration with the existing MCP client system

import { mcpClient } from './mcp-client.js';
import { toolRegistry } from './tool-registry.js';
import { mcpToolDiscovery } from './mcp-tool-discovery.js';
import { webSocketPushService } from './websocket-push-service.js';

class ToolRegistryIntegrationService {
	private initialized = false;
	private connectionCheckInterval: NodeJS.Timeout | null = null;
	private pushNotificationUnsubscribers: Array<() => void> = [];

	/**
	 * Initialize the tool registry integration
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Set up event listeners for MCP client connection changes
		this.setupConnectionListeners();

		// Initialize WebSocket push notifications if available
		if (mcpClient.isConnected()) {
			await this.initializePushNotifications();
		}

		// Fallback to polling if push notifications are not available
		if (!webSocketPushService.isAvailable()) {
			console.log('Push notifications not available, falling back to polling');
			// Start auto-discovery of tools with longer polling interval to reduce load
			mcpToolDiscovery.startAutoDiscovery(120000); // Check every 2 minutes instead of 30 seconds
			// Start periodic connection status checks with longer interval
			this.startConnectionChecks();
		}

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

		// Unsubscribe from push notifications
		this.pushNotificationUnsubscribers.forEach((unsubscribe) => unsubscribe());
		this.pushNotificationUnsubscribers = [];

		// Shutdown push notification service
		webSocketPushService.shutdown();

		// Stop polling fallbacks
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
			pushNotificationsEnabled: webSocketPushService.isAvailable(),
			pushNotificationStats: webSocketPushService.getStats(),
			lastUpdateTime: new Date().toISOString()
		};
	}

	/**
	 * Initialize WebSocket push notifications
	 */
	private async initializePushNotifications(): Promise<void> {
		try {
			await webSocketPushService.initialize();

			// Subscribe to server status changes
			const unsubscribeServerStatus = webSocketPushService.on('serverStatusChanged', (data) => {
				console.log(`Server status changed via push notification:`, data);
			});
			this.pushNotificationUnsubscribers.push(unsubscribeServerStatus);

			// Subscribe to tool discovery updates
			const unsubscribeToolDiscovery = webSocketPushService.on('toolsDiscovered', (data) => {
				console.log(`Tools discovered via push notification:`, data);
			});
			this.pushNotificationUnsubscribers.push(unsubscribeToolDiscovery);

			// Subscribe to project data changes
			const unsubscribeProjectData = webSocketPushService.on('projectDataChanged', (data) => {
				console.log(`Project data changed via push notification:`, data);
			});
			this.pushNotificationUnsubscribers.push(unsubscribeProjectData);

			// Subscribe to connection events
			const unsubscribeConnectionLost = webSocketPushService.on('connectionLost', (data) => {
				console.warn(`Connection lost:`, data);
			});
			this.pushNotificationUnsubscribers.push(unsubscribeConnectionLost);

			const unsubscribeConnectionRestored = webSocketPushService.on(
				'connectionRestored',
				(data) => {
					console.log(`Connection restored:`, data);
				}
			);
			this.pushNotificationUnsubscribers.push(unsubscribeConnectionRestored);

			// Request push notifications from the server
			await webSocketPushService.requestServerStatusUpdates();
			await webSocketPushService.requestToolDiscoveryUpdates();
			await webSocketPushService.requestProjectDataUpdates();

			console.log('Push notifications initialized successfully');
		} catch (error) {
			console.warn('Failed to initialize push notifications:', error);
		}
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
		}, 60000); // Check every 60 seconds instead of 10 seconds
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
