import type { ConnectionManager } from './connection-manager.js';

export interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
	timeout?: NodeJS.Timeout;
}

export class ProtocolHandler {
	private messageId = 0;
	private initialized = false;
	private pendingRequests = new Map<number, PendingRequest>();
	private readonly requestTimeout = 30000;

	constructor(private connectionManager: ConnectionManager) {
		this.connectionManager.addListener((event) => {
			if (event.type === 'disconnected') {
				this.cleanup();
			}
		});
	}

	private cleanup(): void {
		this.initialized = false;
		this.pendingRequests.forEach(({ reject, timeout }) => {
			if (timeout) clearTimeout(timeout);
			reject(new Error('Connection lost'));
		});
		this.pendingRequests.clear();
	}

	private handleMessage(message: { id?: number; result?: unknown; error?: unknown }): void {
		if (message.id && this.pendingRequests.has(message.id)) {
			const request = this.pendingRequests.get(message.id)!;
			this.pendingRequests.delete(message.id);

			if (request.timeout) {
				clearTimeout(request.timeout);
			}

			if (message.error) {
				request.reject(message.error);
			} else {
				request.resolve(message.result);
			}
		}
	}

	private extractErrorMessage(error: any): string {
		if (typeof error === 'string') {
			return error;
		}
		if (error && typeof error === 'object') {
			if (error.message) {
				return error.message;
			}
			if (error.code && typeof error.code === 'number') {
				return `Error ${error.code}: ${error.message || 'Unknown error'}`;
			}
		}
		return String(error);
	}

	private extractMCPToolData(result: any): any {
		if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
			const content = result.content[0];
			if (content.text) {
				try {
					return JSON.parse(content.text);
				} catch {
					return content.text;
				}
			}
			return content;
		}
		return result;
	}

	async initialize(): Promise<void> {
		if (!this.connectionManager.isConnected()) {
			await this.connectionManager.connectWithRetry((message) => this.handleMessage(message));
		}

		if (this.initialized) {
			return;
		}

		return this.performInitialization();
	}

	private async performInitialization(): Promise<void> {
		const initRequest = {
			jsonrpc: '2.0',
			id: ++this.messageId,
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {}
				},
				clientInfo: {
					name: 'lifecycle-viewer',
					version: '1.0.0'
				}
			}
		};

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.pendingRequests.has(initRequest.id)) {
					this.pendingRequests.delete(initRequest.id);
					reject(new Error('MCP initialization timeout'));
				}
			}, 10000);

			this.pendingRequests.set(initRequest.id, {
				resolve: (result: any) => {
					const notifyRequest = {
						jsonrpc: '2.0',
						method: 'notifications/initialized'
					};
					this.connectionManager.send(notifyRequest);
					this.initialized = true;
					clearTimeout(timeout);
					resolve(result);
				},
				reject: (error: any) => {
					clearTimeout(timeout);
					reject(error);
				},
				timeout
			});

			this.connectionManager.send(initRequest);
		});
	}

	async sendRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
		if (!this.connectionManager.isConnected()) {
			throw new Error('Not connected to MCP server');
		}

		if (!this.initialized) {
			throw new Error('MCP server not initialized');
		}

		const id = ++this.messageId;
		const message = {
			jsonrpc: '2.0',
			id,
			method: 'tools/call',
			params: {
				name: method,
				arguments: params
			}
		};

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error('Request timeout'));
				}
			}, this.requestTimeout);

			this.pendingRequests.set(id, { 
				resolve, 
				reject,
				timeout 
			});

			this.connectionManager.send(message);
		});
	}

	async sendRequestWithResponse<T>(
		method: string, 
		params: Record<string, unknown> = {}
	): Promise<{ success: true; data: T } | { success: false; error: string }> {
		try {
			const result = await this.sendRequest(method, params);
			const data = this.extractMCPToolData(result);
			return { success: true, data: data as T };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	isInitialized(): boolean {
		return this.initialized && this.connectionManager.isConnected();
	}

	reset(): void {
		this.cleanup();
		this.messageId = 0;
	}

	getPendingRequestCount(): number {
		return this.pendingRequests.size;
	}
}