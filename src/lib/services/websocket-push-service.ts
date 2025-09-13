// WebSocket Push Notification Service
// Replaces polling mechanisms with real-time push notifications

import { mcpClient } from './mcp-client.js';
import { toolRegistry } from './tool-registry.js';
import { mcpToolDiscovery } from './mcp-tool-discovery.js';

export interface PushNotificationEvents {
	serverStatusChanged: { serverId: string; connected: boolean };
	toolsDiscovered: { serverId: string; tools: any[]; timestamp: Date };
	projectDataChanged: { type: 'requirement' | 'task' | 'architecture'; id: string };
	connectionLost: { timestamp: Date; reason: string };
	connectionRestored: { timestamp: Date };
}

export class WebSocketPushService {
	private initialized = false;
	private pushListeners: Map<string, Set<(data: any) => void>> = new Map();
	private lastHeartbeat = Date.now();
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private readonly heartbeatFrequency = 30000; // 30 seconds

	/**
	 * Initialize push notifications by extending the existing MCP client
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Wait for MCP client to be connected
		if (!mcpClient.isConnected()) {
			console.log('WebSocket push service waiting for MCP connection...');
			return;
		}

		this.setupPushNotificationHandlers();
		this.startHeartbeat();
		this.initialized = true;

		console.log('WebSocket push notification service initialized');
	}

	/**
	 * Subscribe to push notifications
	 */
	on<K extends keyof PushNotificationEvents>(
		event: K,
		callback: (data: PushNotificationEvents[K]) => void
	): () => void {
		if (!this.pushListeners.has(event)) {
			this.pushListeners.set(event, new Set());
		}

		const listeners = this.pushListeners.get(event)!;
		listeners.add(callback);

		// Return unsubscribe function
		return () => {
			listeners.delete(callback);
			if (listeners.size === 0) {
				this.pushListeners.delete(event);
			}
		};
	}

	/**
	 * Request server status updates via push instead of polling
	 */
	async requestServerStatusUpdates(): Promise<void> {
		try {
			// Send a notification request to enable server status push notifications
			await this.sendPushNotificationRequest('server_status_updates', { enabled: true });
		} catch (error) {
			console.warn('Could not request server status push notifications:', error);
			// Fallback to existing polling if push notifications fail
		}
	}

	/**
	 * Request tool discovery updates via push instead of polling
	 */
	async requestToolDiscoveryUpdates(): Promise<void> {
		try {
			// Send a notification request to enable tool discovery push notifications
			await this.sendPushNotificationRequest('tool_discovery_updates', { enabled: true });
		} catch (error) {
			console.warn('Could not request tool discovery push notifications:', error);
			// Fallback to existing polling if push notifications fail
		}
	}

	/**
	 * Request real-time project data change notifications
	 */
	async requestProjectDataUpdates(): Promise<void> {
		try {
			// Send a notification request to enable project data change notifications
			await this.sendPushNotificationRequest('project_data_updates', { enabled: true });
		} catch (error) {
			console.warn('Could not request project data push notifications:', error);
		}
	}

	/**
	 * Shutdown the push notification service
	 */
	shutdown(): void {
		if (!this.initialized) return;

		this.stopHeartbeat();
		this.pushListeners.clear();
		this.initialized = false;

		console.log('WebSocket push notification service shutdown');
	}

	// Private methods

	private setupPushNotificationHandlers(): void {
		// Extend the existing MCP client's WebSocket message handler
		// to also handle push notifications (messages without an ID)
		const originalClient = mcpClient as any;
		const originalHandleMessage = originalClient.handleMessage;

		if (originalHandleMessage) {
			originalClient.handleMessage = (message: any) => {
				// If the message has no ID, it's likely a push notification
				if (!message.id && message.method) {
					this.handlePushNotification(message);
					return;
				}

				// Otherwise, handle it normally
				originalHandleMessage.call(originalClient, message);
			};
		}

		// Setup WebSocket connection event handlers
		this.setupConnectionEventHandlers();
	}

	private setupConnectionEventHandlers(): void {
		// Monitor the MCP client connection status
		const originalClient = mcpClient as any;

		// Hook into WebSocket events if available
		if (originalClient.ws) {
			const ws = originalClient.ws;

			ws.addEventListener('close', () => {
				this.emit('connectionLost', {
					timestamp: new Date(),
					reason: 'WebSocket connection closed'
				});
			});

			ws.addEventListener('open', () => {
				this.emit('connectionRestored', { timestamp: new Date() });
			});
		}
	}

	private handlePushNotification(message: any): void {
		console.log('Received push notification:', message.method, message.params);

		switch (message.method) {
			case 'notification/server_status_changed':
				this.handleServerStatusChanged(message.params);
				break;

			case 'notification/tools_discovered':
				this.handleToolsDiscovered(message.params);
				break;

			case 'notification/project_data_changed':
				this.handleProjectDataChanged(message.params);
				break;

			case 'notification/heartbeat':
				this.handleHeartbeat(message.params);
				break;

			default:
				console.log('Unknown push notification type:', message.method);
		}
	}

	private handleServerStatusChanged(params: any): void {
		const { serverId, connected } = params;

		// Update tool registry server status
		const server = toolRegistry.getServer(serverId);
		if (server) {
			server.connected = connected;
			server.lastUpdated = new Date();

			if (connected) {
				toolRegistry.emit('serverConnected', { server });
			} else {
				toolRegistry.emit('serverDisconnected', { serverId });
			}
		}

		this.emit('serverStatusChanged', { serverId, connected });
	}

	private handleToolsDiscovered(params: any): void {
		const { serverId, tools } = params;
		const timestamp = new Date();

		// Update the tool registry with the discovered tools
		if (tools && Array.isArray(tools)) {
			toolRegistry.updateServerTools(serverId, tools);
		}

		this.emit('toolsDiscovered', { serverId, tools, timestamp });
	}

	private handleProjectDataChanged(params: any): void {
		const { type, id } = params;
		this.emit('projectDataChanged', { type, id });
	}

	private handleHeartbeat(params: any): void {
		this.lastHeartbeat = Date.now();
		console.debug('Received heartbeat from server');
	}

	private async sendPushNotificationRequest(type: string, params: any): Promise<void> {
		// Send a notification request to the MCP server
		const originalClient = mcpClient as any;

		if (!originalClient.ws || !originalClient.connected) {
			throw new Error('MCP client not connected');
		}

		const message = {
			jsonrpc: '2.0',
			method: 'notifications/subscribe',
			params: {
				type,
				...params
			}
		};

		originalClient.ws.send(JSON.stringify(message));
	}

	private startHeartbeat(): void {
		this.heartbeatInterval = setInterval(() => {
			const now = Date.now();
			const timeSinceLastHeartbeat = now - this.lastHeartbeat;

			// If we haven't received a heartbeat in 60 seconds, consider connection lost
			if (timeSinceLastHeartbeat > 60000) {
				console.warn('No heartbeat received for 60 seconds, connection may be lost');
				this.emit('connectionLost', {
					timestamp: new Date(),
					reason: 'Heartbeat timeout'
				});
			}
		}, this.heartbeatFrequency);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	private emit<K extends keyof PushNotificationEvents>(
		event: K,
		data: PushNotificationEvents[K]
	): void {
		const listeners = this.pushListeners.get(event);
		if (listeners) {
			listeners.forEach(callback => {
				try {
					callback(data);
				} catch (error) {
					console.error(`Error in push notification listener for ${event}:`, error);
				}
			});
		}
	}

	// Utility methods

	/**
	 * Check if push notifications are available
	 */
	isAvailable(): boolean {
		return this.initialized && mcpClient.isConnected();
	}

	/**
	 * Get time since last heartbeat
	 */
	getTimeSinceLastHeartbeat(): number {
		return Date.now() - this.lastHeartbeat;
	}

	/**
	 * Get push notification statistics
	 */
	getStats(): {
		initialized: boolean;
		timeSinceLastHeartbeat: number;
		activeListeners: number;
		subscribedEvents: string[];
	} {
		return {
			initialized: this.initialized,
			timeSinceLastHeartbeat: this.getTimeSinceLastHeartbeat(),
			activeListeners: Array.from(this.pushListeners.values())
				.reduce((total, listeners) => total + listeners.size, 0),
			subscribedEvents: Array.from(this.pushListeners.keys())
		};
	}
}

// Singleton instance
export const webSocketPushService = new WebSocketPushService();