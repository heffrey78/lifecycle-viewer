export interface ConnectionEvent {
	type: 'connected' | 'disconnected' | 'error' | 'retry';
	message?: string;
	error?: any;
}

export type ConnectionEventListener = (event: ConnectionEvent) => void;

export class ConnectionManager {
	private ws: WebSocket | null = null;
	private connected = false;
	private connectPromise: Promise<void> | null = null;
	private retryAttempts = 0;
	private readonly maxRetries = 3;
	private readonly baseRetryDelay = 100;
	private listeners: ConnectionEventListener[] = [];

	constructor(private serverUrl: string = 'ws://localhost:3000/mcp') {}

	private emit(event: ConnectionEvent): void {
		this.listeners.forEach((listener) => listener(event));
	}

	addListener(listener: ConnectionEventListener): void {
		this.listeners.push(listener);
	}

	removeListener(listener: ConnectionEventListener): void {
		const index = this.listeners.indexOf(listener);
		if (index > -1) {
			this.listeners.splice(index, 1);
		}
	}

	private isRecoverableError(error: any): boolean {
		if (typeof error === 'object' && error !== null && error.code) {
			if (error.code >= -32099 && error.code <= -32000) return true;
			if (error.code === -32603) return true;
			if (error.code === -32000) return true;
			if (error.code === -32602) return false;
			if (error.code === -32601) return false;
		}

		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes('websocket connection failed')) return true;
			if (message.includes('network')) return true;
			if (message.includes('connection')) return true;
		}

		return false;
	}

	private sanitizeErrorMessage(error: any): string {
		if (typeof error === 'object' && error !== null && error.message) {
			let message = error.message;

			message = message.replace(/\/[^\s]*\.(js|ts|json|py|etc)\b/g, '[file]');
			message = message.replace(/\s+at\s+[^\n]*\([^\n]*\)/g, '');
			message = message.replace(/secret[^\s]*/gi, '[redacted]');
			message = message.replace(/token[^\s]*/gi, '[redacted]');
			message = message.replace(/key[^\s]*/gi, '[redacted]');
			message = message.replace(/password[^\s]*/gi, '[redacted]');

			return message.trim();
		}

		return 'Connection error occurred';
	}

	private async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private calculateRetryDelay(attempt: number): number {
		return this.baseRetryDelay * Math.pow(2, attempt);
	}

	async connect(onMessage: (message: any) => void): Promise<void> {
		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.serverUrl);

				this.ws.onopen = () => {
					this.connected = true;
					this.retryAttempts = 0;
					this.emit({ type: 'connected', message: `Connected to ${this.serverUrl}` });
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data);
						onMessage(message);
					} catch (error) {
						console.error('Failed to parse WebSocket message:', error);
						this.emit({ type: 'error', message: 'Invalid message format', error });
					}
				};

				this.ws.onerror = (error) => {
					const errorMessage = `WebSocket connection failed: Unable to connect to MCP server at ${this.serverUrl}`;
					this.connected = false;
					this.emit({ type: 'error', message: errorMessage, error });
					reject(new Error(errorMessage));
				};

				this.ws.onclose = (event) => {
					this.connected = false;
					this.connectPromise = null;
					if (event.code !== 1000) {
						this.emit({
							type: 'disconnected',
							message: `WebSocket disconnected: ${event.code} ${event.reason}`
						});
					} else {
						this.emit({ type: 'disconnected', message: 'Disconnected from server' });
					}
				};
			} catch (error) {
				reject(error);
			}
		});

		return this.connectPromise;
	}

	async connectWithRetry(onMessage: (message: any) => void): Promise<void> {
		let lastError: any;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				await this.connect(onMessage);
				this.retryAttempts = 0;
				return;
			} catch (error) {
				lastError = error;

				if (attempt < this.maxRetries && this.isRecoverableError(error)) {
					const delayMs = this.calculateRetryDelay(attempt);
					this.emit({
						type: 'retry',
						message: `Connection attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`
					});
					await this.delay(delayMs);
					this.retryAttempts = attempt + 1;
					continue;
				}
				break;
			}
		}

		const attempts = this.isRecoverableError(lastError) ? this.maxRetries + 1 : 1;
		const sanitizedMessage = this.sanitizeErrorMessage(lastError);
		throw new Error(`Connection failed after ${attempts} attempts: ${sanitizedMessage}`);
	}

	send(message: any): void {
		if (!this.connected || !this.ws) {
			throw new Error('Not connected to WebSocket');
		}
		this.ws.send(JSON.stringify(message));
	}

	isConnected(): boolean {
		return this.connected;
	}

	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.connected = false;
		this.connectPromise = null;
		this.retryAttempts = 0;
	}

	getRetryAttempts(): number {
		return this.retryAttempts;
	}

	getMaxRetries(): number {
		return this.maxRetries;
	}
}
