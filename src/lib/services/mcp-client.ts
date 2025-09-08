// MCP Client for communicating with the Lifecycle MCP server
// This is a simplified WebSocket-based client for demo purposes
// In a real implementation, this would use the official MCP protocol

import type {
	Requirement,
	Task,
	ArchitectureDecision,
	ProjectMetrics,
	MCPResponse,
	RequirementFilters,
	TaskFilters,
	ArchitectureFilters
} from '$lib/types/lifecycle.js';

export class LifecycleMCPClient {
	private ws: WebSocket | null = null;
	private connected = false;
	private initialized = false;
	private messageId = 0;
	private connectPromise: Promise<void> | null = null;
	private retryAttempts = 0;
	private readonly maxRetries = 3;
	private readonly baseRetryDelay = 100; // ms
	private pendingRequests = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }
	>();

	constructor(private serverUrl: string = 'ws://localhost:3000/mcp') {
		// Constructor only sets up the URL, connection happens explicitly
	}

	private isRecoverableError(error: any): boolean {
		// Classify errors as recoverable or non-recoverable
		if (typeof error === 'object' && error.code) {
			// JSON-RPC error codes
			if (error.code >= -32099 && error.code <= -32000) return true; // Server errors (5xx equivalent)
			if (error.code === -32603) return true; // Internal error
			if (error.code === -32000) return true; // Generic server error
			if (error.code === -32602) return false; // Invalid params (4xx equivalent)
			if (error.code === -32601) return false; // Method not found (4xx equivalent)
		}

		// WebSocket/Network errors are typically recoverable
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes('websocket connection failed')) return true;
			if (message.includes('network')) return true;
			if (message.includes('mcp initialization timeout')) return true;
			if (message.includes('connection')) return true;
		}

		// Default to non-recoverable for unknown errors
		return false;
	}

	private sanitizeErrorMessage(error: any): string {
		// Sanitize error messages to prevent information leakage
		if (typeof error === 'object' && error.message) {
			let message = error.message;

			// Remove file paths (keep the text around them)
			message = message.replace(/\/[^\s]*\.(js|ts|json|py|etc)\b/g, '[file]');

			// Remove internal stack traces (more specific pattern to avoid removing line references)
			message = message.replace(/\s+at\s+[^\n]*\([^\n]*\)/g, '');

			// Remove sensitive data patterns (keep surrounding text)
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
		// Exponential backoff: 100ms, 200ms, 400ms, 800ms
		return this.baseRetryDelay * Math.pow(2, attempt);
	}

	async connect(): Promise<void> {
		// Return existing connection promise if already connecting/connected
		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.serverUrl);

				this.ws.onopen = () => {
					this.connected = true;
					console.log(`Connected to Lifecycle MCP server at ${this.serverUrl}`);

					// Initialize MCP connection
					this.initializeMCP()
						.then(() => {
							this.initialized = true;
							console.log('MCP initialization complete');
							resolve();
						})
						.catch((error) => {
							console.error('MCP initialization failed:', error);
							reject(error);
						});
				};

				this.ws.onmessage = (event) => {
					this.handleMessage(JSON.parse(event.data));
				};

				this.ws.onerror = (error) => {
					const errorMessage = `WebSocket connection failed: Unable to connect to MCP server at ${this.serverUrl}`;
					console.error(errorMessage, error);
					this.connected = false;
					reject(new Error(errorMessage));
				};

				this.ws.onclose = (event) => {
					this.connected = false;
					if (event.code !== 1000) {
						// Not a normal closure
						console.warn(`WebSocket disconnected unexpectedly: ${event.code} ${event.reason}`);
					} else {
						console.log('Disconnected from Lifecycle MCP server');
					}
				};
			} catch (error) {
				reject(error);
			}
		});

		return this.connectPromise;
	}

	private handleMessage(message: { id?: number; result?: unknown; error?: unknown }) {
		if (message.id && this.pendingRequests.has(message.id)) {
			const request = this.pendingRequests.get(message.id)!;
			this.pendingRequests.delete(message.id);

			if (message.error) {
				request.reject(message.error);
			} else {
				request.resolve(message.result);
			}
		}
	}

	private async initializeMCP(): Promise<void> {
		return this.initializeMCPWithRetry();
	}

	private async initializeMCPWithRetry(): Promise<void> {
		let lastError: any;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				await this.performInitialization();
				// Success - reset retry attempts for next connection
				this.retryAttempts = 0;
				return;
			} catch (error) {
				lastError = error;

				// Check if this is a recoverable error and if we have retries left
				if (attempt < this.maxRetries && this.isRecoverableError(error)) {
					// Wait before retrying with exponential backoff
					const delayMs = this.calculateRetryDelay(attempt);
					console.log(
						`MCP initialization attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`
					);
					await this.delay(delayMs);

					// Increment retry counter
					this.retryAttempts = attempt + 1;
					continue;
				}

				// Non-recoverable error or max retries reached - break and throw error
				break;
			}
		}

		// Failed - throw sanitized error
		const attempts = this.isRecoverableError(lastError) ? this.maxRetries + 1 : 1;
		const sanitizedMessage = this.sanitizeErrorMessage(lastError);
		throw new Error(`MCP initialization failed after ${attempts} attempts: ${sanitizedMessage}`);
	}

	private async performInitialization(): Promise<void> {
		// Send initialize request
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
			this.pendingRequests.set(initRequest.id, {
				resolve: (result: any) => {
					// Send initialized notification
					const notifyRequest = {
						jsonrpc: '2.0',
						method: 'notifications/initialized'
					};
					this.ws!.send(JSON.stringify(notifyRequest));
					resolve(result);
				},
				reject: (error: any) => {
					// Don't sanitize here - let the retry logic handle it
					reject(error);
				}
			});
			this.ws!.send(JSON.stringify(initRequest));

			// Set timeout for initialization
			setTimeout(() => {
				if (this.pendingRequests.has(initRequest.id)) {
					this.pendingRequests.delete(initRequest.id);
					reject(new Error('MCP initialization timeout'));
				}
			}, 10000);
		});
	}

	private async sendRequest(
		method: string,
		params: Record<string, unknown> = {}
	): Promise<unknown> {
		if (!this.connected || !this.ws) {
			throw new Error('Not connected to MCP server');
		}

		if (!this.initialized) {
			throw new Error('MCP server not initialized');
		}

		const id = ++this.messageId;
		const message = {
			jsonrpc: '2.0',
			id,
			method: `tools/call`,
			params: {
				name: method,
				arguments: params
			}
		};

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });
			this.ws!.send(JSON.stringify(message));

			// Set timeout for requests
			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error('Request timeout'));
				}
			}, 30000);
		});
	}

	// Helper to extract error message from various error types
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

	// Helper to extract data from MCP tool response
	private extractMCPToolData(result: any): any {
		// MCP tools return data in result.content[0].text or result.content[0]
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

	// Requirement methods
	async getRequirements(filters?: RequirementFilters): Promise<MCPResponse<Requirement[]>> {
		try {
			const result = await this.sendRequest('query_requirements', filters || {});
			const data = this.extractMCPToolData(result);
			return { success: true, data: data as Requirement[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getRequirementsJson(filters?: RequirementFilters): Promise<MCPResponse<Requirement[]>> {
		try {
			const result = await this.sendRequest('query_requirements_json', filters || {});
			const data = this.extractMCPToolData(result);
			return { success: true, data: data as Requirement[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getRequirementDetails(id: string): Promise<MCPResponse<Requirement>> {
		try {
			const result = await this.sendRequest('get_requirement_details', { requirement_id: id });
			return { success: true, data: result as Requirement };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async createRequirement(requirement: Partial<Requirement>): Promise<MCPResponse<Requirement>> {
		try {
			const result = await this.sendRequest('create_requirement', requirement);
			return { success: true, data: result as Requirement };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async updateRequirementStatus(
		id: string,
		newStatus: string,
		comment?: string
	): Promise<MCPResponse<Requirement>> {
		try {
			const result = await this.sendRequest('update_requirement_status', {
				requirement_id: id,
				new_status: newStatus,
				comment
			});
			return { success: true, data: result as Requirement };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async traceRequirement(id: string): Promise<MCPResponse<unknown>> {
		try {
			const result = await this.sendRequest('trace_requirement', { requirement_id: id });
			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Task methods
	async getTasks(filters?: TaskFilters): Promise<MCPResponse<Task[]>> {
		try {
			const result = await this.sendRequest('query_tasks', filters || {});
			const data = this.extractMCPToolData(result);
			return { success: true, data: data as Task[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getTasksJson(filters?: TaskFilters): Promise<MCPResponse<Task[]>> {
		try {
			const result = await this.sendRequest('query_tasks_json', filters || {});
			const data = this.extractMCPToolData(result);
			return { success: true, data: data as Task[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getTaskDetails(id: string): Promise<MCPResponse<Task>> {
		try {
			const result = await this.sendRequest('get_task_details', { task_id: id });
			return { success: true, data: result as Task };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async createTask(task: Partial<Task>): Promise<MCPResponse<Task>> {
		try {
			const result = await this.sendRequest('create_task', task);
			return { success: true, data: result as Task };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async updateTaskStatus(
		id: string,
		newStatus: string,
		comment?: string,
		assignee?: string
	): Promise<MCPResponse<Task>> {
		try {
			const result = await this.sendRequest('update_task_status', {
				task_id: id,
				new_status: newStatus,
				comment,
				assignee
			});
			return { success: true, data: result as Task };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Architecture methods
	async getArchitectureDecisions(
		filters?: ArchitectureFilters
	): Promise<MCPResponse<ArchitectureDecision[]>> {
		try {
			const result = await this.sendRequest('query_architecture_decisions', filters || {});
			return { success: true, data: result as ArchitectureDecision[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getArchitectureDecisionsJson(
		filters?: ArchitectureFilters
	): Promise<MCPResponse<ArchitectureDecision[]>> {
		try {
			const result = await this.sendRequest('query_architecture_decisions_json', filters || {});
			const data = this.extractMCPToolData(result);
			return { success: true, data: data as ArchitectureDecision[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getArchitectureDetails(id: string): Promise<MCPResponse<ArchitectureDecision>> {
		try {
			const result = await this.sendRequest('get_architecture_details', { architecture_id: id });
			return { success: true, data: result as ArchitectureDecision };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async createArchitectureDecision(
		decision: Partial<ArchitectureDecision>
	): Promise<MCPResponse<ArchitectureDecision>> {
		try {
			const result = await this.sendRequest('create_architecture_decision', decision);
			return { success: true, data: result as ArchitectureDecision };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async updateArchitectureStatus(
		id: string,
		newStatus: string,
		comment?: string
	): Promise<MCPResponse<ArchitectureDecision>> {
		try {
			const result = await this.sendRequest('update_architecture_status', {
				architecture_id: id,
				new_status: newStatus,
				comment
			});
			return { success: true, data: result as ArchitectureDecision };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Project status and metrics
	async getProjectStatus(): Promise<MCPResponse<ProjectMetrics>> {
		try {
			const result = await this.sendRequest('get_project_status', {});
			const data = this.extractMCPToolData(result);
			console.log('Raw MCP project status data:', data);
			return { success: true, data: data as ProjectMetrics };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getProjectMetrics(): Promise<MCPResponse<ProjectMetrics>> {
		try {
			const result = await this.sendRequest('get_project_metrics', {});
			const data = this.extractMCPToolData(result);
			console.log('Extracted project metrics data:', JSON.stringify(data, null, 2));
			return { success: true, data: data as ProjectMetrics };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Interview methods
	async startRequirementInterview(
		projectContext?: string,
		stakeholderRole?: string
	): Promise<MCPResponse<{ session_id: string; questions: Record<string, string> }>> {
		try {
			const result = await this.sendRequest('start_requirement_interview', {
				project_context: projectContext,
				stakeholder_role: stakeholderRole
			});
			return {
				success: true,
				data: result as { session_id: string; questions: Record<string, string> }
			};
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async continueRequirementInterview(
		sessionId: string,
		answers: Record<string, string>
	): Promise<MCPResponse<unknown>> {
		try {
			const result = await this.sendRequest('continue_requirement_interview', {
				session_id: sessionId,
				answers
			});
			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Export methods
	async exportProjectDocumentation(options: {
		project_name?: string;
		include_requirements?: boolean;
		include_tasks?: boolean;
		include_architecture?: boolean;
		output_directory?: string;
	}): Promise<MCPResponse<string[]>> {
		try {
			const result = await this.sendRequest('export_project_documentation', options);
			return { success: true, data: result as string[] };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async createArchitecturalDiagrams(options: {
		diagram_type?: string;
		requirement_ids?: string[];
		include_relationships?: boolean;
		output_format?: string;
	}): Promise<MCPResponse<string>> {
		try {
			const result = await this.sendRequest('create_architectural_diagrams', options);
			return { success: true, data: result as string };
		} catch (error) {
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Database management methods
	async switchDatabase(databasePath: string): Promise<MCPResponse<void>> {
		try {
			const result = await this.sendRequest('database/switch', { database: databasePath });
			const data = this.extractMCPToolData(result);

			// Check if the response indicates success
			if (data && (data.success === true || typeof data === 'object')) {
				return { success: true, data: undefined };
			} else {
				return { success: false, error: data || 'Database switch failed' };
			}
		} catch (error) {
			console.error('Database switch error:', error);
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async getCurrentDatabase(): Promise<MCPResponse<string | null>> {
		try {
			const result = await this.sendRequest('database/current', {});
			const data = this.extractMCPToolData(result);

			if (data && typeof data === 'object' && 'database' in data) {
				return { success: true, data: data.database || null };
			} else {
				return { success: true, data: null };
			}
		} catch (error) {
			console.error('Get current database error:', error);
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	async pickDatabase(): Promise<MCPResponse<string | null>> {
		try {
			const result = await this.sendRequest('database/pick', {});
			const data = this.extractMCPToolData(result);

			if (data && typeof data === 'object') {
				if (data.success && data.path) {
					return { success: true, data: data.path };
				} else if (data.cancelled) {
					return { success: false, error: 'File selection cancelled' };
				} else {
					return { success: false, error: data.error || 'File picker failed' };
				}
			} else {
				return { success: false, error: 'Invalid response from file picker' };
			}
		} catch (error) {
			console.error('File picker error:', error);
			return { success: false, error: this.extractErrorMessage(error) };
		}
	}

	// Connection management
	isConnected(): boolean {
		return this.connected && this.initialized;
	}

	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.connected = false;
		this.initialized = false;
		this.connectPromise = null;
		this.retryAttempts = 0; // Reset retry counter
	}
}

// Singleton instance
export const mcpClient = new LifecycleMCPClient();
