// Enhanced WebSocket Mocking Infrastructure
// Provides realistic WebSocket simulation with network conditions and comprehensive event handling

import { NetworkSimulator, NetworkPreset, NetworkConditions } from './network-simulation.js';

// Mock Event classes for Node.js compatibility
export class MockCloseEvent extends Event {
	public code: number;
	public reason: string;
	public wasClean: boolean;
	
	constructor(type: string, options: { code?: number; reason?: string; wasClean?: boolean } = {}) {
		super(type);
		this.code = options.code || 1000;
		this.reason = options.reason || '';
		this.wasClean = options.wasClean || true;
	}
}

export class MockMessageEvent extends Event {
	public data: unknown;
	public origin: string;
	
	constructor(type: string, options: { data?: unknown; origin?: string } = {}) {
		super(type);
		this.data = options.data;
		this.origin = options.origin || 'ws://localhost:3000';
	}
}

export class MockErrorEvent extends Event {
	public error: Error | null;
	public message: string;
	
	constructor(type: string, options: { error?: Error; message?: string } = {}) {
		super(type);
		this.error = options.error || null;
		this.message = options.message || 'WebSocket error';
	}
}

// Connection states
export enum MockWebSocketState {
	CONNECTING = 0,
	OPEN = 1,
	CLOSING = 2,
	CLOSED = 3
}

export interface MockWebSocketConfig {
	networkPreset?: NetworkPreset;
	networkConditions?: Partial<NetworkConditions>;
	autoConnect?: boolean;
	connectionTimeout?: number;
	maxReconnectAttempts?: number;
	enableLogging?: boolean;
}

export interface WebSocketMessage {
	id?: number;
	timestamp: number;
	data: string;
	size: number;
	direction: 'outbound' | 'inbound';
}

export class EnhancedMockWebSocket {
	// WebSocket API compliance
	static readonly CONNECTING = MockWebSocketState.CONNECTING;
	static readonly OPEN = MockWebSocketState.OPEN;
	static readonly CLOSING = MockWebSocketState.CLOSING;
	static readonly CLOSED = MockWebSocketState.CLOSED;

	public readonly url: string;
	public readyState: MockWebSocketState = MockWebSocketState.CONNECTING;
	public binaryType: BinaryType = 'blob';
	public bufferedAmount = 0;
	public extensions = '';
	public protocol = '';

	// Event handlers
	public onopen: ((event: Event) => void) | null = null;
	public onclose: ((event: MockCloseEvent) => void) | null = null;
	public onmessage: ((event: MockMessageEvent) => void) | null = null;
	public onerror: ((event: MockErrorEvent) => void) | null = null;

	// Enhanced mocking features
	private networkSimulator: NetworkSimulator;
	private config: Required<MockWebSocketConfig>;
	private messageHistory: WebSocketMessage[] = [];
	private connectionTimer: NodeJS.Timeout | null = null;
	private shouldConnect: boolean = true;
	private messageIdCounter = 0;

	constructor(url: string | URL, protocols?: string | string[], config: MockWebSocketConfig = {}) {
		this.url = typeof url === 'string' ? url : url.href;
		
		this.config = {
			networkPreset: 'typical',
			autoConnect: true,
			connectionTimeout: 30000,
			maxReconnectAttempts: 3,
			enableLogging: false,
			...config
		};

		this.networkSimulator = new NetworkSimulator(this.config.networkPreset);
		if (this.config.networkConditions) {
			this.networkSimulator.setConditions(this.config.networkConditions);
		}

		// Validate URL
		if (!this.isValidWebSocketUrl(this.url)) {
			this.shouldConnect = false;
		}

		if (this.config.autoConnect) {
			this.startConnection();
		}
	}

	// WebSocket API methods
	send(data: string | ArrayBuffer | Blob): void {
		if (this.readyState !== MockWebSocketState.OPEN) {
			throw new Error(`WebSocket is not open. ReadyState: ${this.readyState}`);
		}

		const messageData = typeof data === 'string' ? data : data.toString();
		const message: WebSocketMessage = {
			id: ++this.messageIdCounter,
			timestamp: Date.now(),
			data: messageData,
			size: new Blob([messageData]).size,
			direction: 'outbound'
		};

		this.messageHistory.push(message);
		this.logMessage('SEND', message);

		// Simulate network conditions
		this.simulateNetworkSend(messageData);
	}

	close(code?: number, reason?: string): void {
		if (this.readyState === MockWebSocketState.CLOSED || this.readyState === MockWebSocketState.CLOSING) {
			return;
		}

		this.readyState = MockWebSocketState.CLOSING;
		this.cleanup();

		// Simulate close event
		setTimeout(() => {
			this.readyState = MockWebSocketState.CLOSED;
			this.fireCloseEvent(code || 1000, reason || 'Normal closure');
		}, 0);
	}

	// Enhanced testing methods
	simulateMessage(data: unknown, options: { delay?: number } = {}): void {
		if (this.readyState !== MockWebSocketState.OPEN) {
			this.logMessage('WARN', `Cannot simulate message, WebSocket not open. State: ${this.readyState}`);
			return;
		}

		const messageData = typeof data === 'string' ? data : JSON.stringify(data);
		const message: WebSocketMessage = {
			timestamp: Date.now(),
			data: messageData,
			size: new Blob([messageData]).size,
			direction: 'inbound'
		};

		this.messageHistory.push(message);
		this.logMessage('RECV', message);

		const delay = options.delay || 0;
		setTimeout(async () => {
			if (this.readyState === MockWebSocketState.OPEN) {
				await this.networkSimulator.simulateLatency();
				
				if (!this.networkSimulator.shouldDropPacket()) {
					this.onmessage?.(new MockMessageEvent('message', { data: messageData }));
				} else {
					this.logMessage('DROP', message);
				}
			}
		}, delay);
	}

	simulateError(error: Error | string = 'WebSocket error'): void {
		const errorObj = typeof error === 'string' ? new Error(error) : error;
		this.logMessage('ERROR', { error: errorObj.message });
		
		this.readyState = MockWebSocketState.CLOSED;
		this.cleanup();
		
		this.onerror?.(new MockErrorEvent('error', { error: errorObj, message: errorObj.message }));
		this.fireCloseEvent(1006, 'Connection failed');
	}

	simulateUnexpectedClose(code: number = 1006, reason: string = 'Connection lost'): void {
		if (this.readyState === MockWebSocketState.OPEN) {
			this.readyState = MockWebSocketState.CLOSED;
			this.cleanup();
			this.fireCloseEvent(code, reason);
		}
	}

	// Network simulation controls
	setNetworkConditions(preset: NetworkPreset): void;
	setNetworkConditions(conditions: Partial<NetworkConditions>): void;
	setNetworkConditions(conditions: NetworkPreset | Partial<NetworkConditions>): void {
		if (typeof conditions === 'string') {
			this.networkSimulator.setPreset(conditions);
		} else {
			this.networkSimulator.setConditions(conditions);
		}
		this.logMessage('NETWORK', this.networkSimulator.getConditionsSummary());
	}

	// Test utilities
	getMessageHistory(): WebSocketMessage[] {
		return [...this.messageHistory];
	}

	getLastMessage(direction?: 'inbound' | 'outbound'): WebSocketMessage | null {
		const messages = direction 
			? this.messageHistory.filter(m => m.direction === direction)
			: this.messageHistory;
		return messages[messages.length - 1] || null;
	}

	clearMessageHistory(): void {
		this.messageHistory = [];
	}

	waitForMessage(timeout: number = 5000): Promise<MockMessageEvent> {
		return new Promise((resolve, reject) => {
			if (this.readyState !== MockWebSocketState.OPEN) {
				reject(new Error('WebSocket is not open'));
				return;
			}

			const originalHandler = this.onmessage;
			const timeoutId = setTimeout(() => {
				this.onmessage = originalHandler;
				reject(new Error('Timeout waiting for message'));
			}, timeout);

			this.onmessage = (event) => {
				clearTimeout(timeoutId);
				this.onmessage = originalHandler;
				resolve(event);
				originalHandler?.(event);
			};
		});
	}

	// Private methods
	private startConnection(): void {
		if (!this.shouldConnect) {
			setTimeout(() => this.simulateError('Invalid WebSocket URL'), 0);
			return;
		}

		this.logMessage('CONNECTING', { url: this.url });

		// Start disconnection simulation if configured
		this.networkSimulator.startDisconnectionSimulation(() => {
			this.simulateUnexpectedClose(1006, 'Network disconnection');
		});

		// Simulate connection process
		this.connectionTimer = setTimeout(async () => {
			try {
				await this.networkSimulator.simulateLatency();
				
				if (this.networkSimulator.shouldDropPacket()) {
					this.simulateError('Connection failed');
					return;
				}

				if (this.readyState === MockWebSocketState.CONNECTING) {
					this.readyState = MockWebSocketState.OPEN;
					this.logMessage('CONNECTED', { readyState: this.readyState });
					this.onopen?.(new Event('open'));
				}
			} catch (error) {
				this.simulateError(error as Error);
			}
		}, 0);
	}

	private async simulateNetworkSend(data: string): Promise<void> {
		await this.networkSimulator.simulateLatency();
		
		if (this.networkSimulator.shouldDropPacket()) {
			this.logMessage('DROP', { data, direction: 'outbound' });
			return;
		}

		// Simulate successful send (no response needed for basic send)
		this.logMessage('SENT', { size: data.length });
	}

	private fireCloseEvent(code: number, reason: string): void {
		const wasClean = code === 1000;
		this.logMessage('CLOSE', { code, reason, wasClean });
		this.onclose?.(new MockCloseEvent('close', { code, reason, wasClean }));
	}

	private isValidWebSocketUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
		} catch {
			return false;
		}
	}

	private logMessage(type: string, data: unknown): void {
		if (this.config.enableLogging) {
			const timestamp = new Date().toISOString();
			console.log(`[MockWebSocket ${timestamp}] ${type}:`, data);
		}
	}

	private cleanup(): void {
		if (this.connectionTimer) {
			clearTimeout(this.connectionTimer);
			this.connectionTimer = null;
		}
		this.networkSimulator.cleanup();
	}

	// Mock specific helper methods
	setShouldConnect(shouldConnect: boolean): void {
		this.shouldConnect = shouldConnect;
	}

	enableLogging(enable: boolean = true): void {
		this.config.enableLogging = enable;
	}
}