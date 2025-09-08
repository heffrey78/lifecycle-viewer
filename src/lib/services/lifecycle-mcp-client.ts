import { ConnectionManager } from './connection-manager.js';
import { ProtocolHandler } from './protocol-handler.js';
import { RequirementService } from './requirement-service.js';
import { TaskService } from './task-service.js';
import { ArchitectureService } from './architecture-service.js';
import { ProjectService } from './project-service.js';
import { DatabaseService } from './database-service.js';

export class LifecycleMCPClient {
	private connectionManager: ConnectionManager;
	private protocolHandler: ProtocolHandler;

	public readonly requirements: RequirementService;
	public readonly tasks: TaskService;
	public readonly architecture: ArchitectureService;
	public readonly project: ProjectService;
	public readonly database: DatabaseService;

	constructor(serverUrl: string = 'ws://localhost:3000/mcp') {
		this.connectionManager = new ConnectionManager(serverUrl);
		this.protocolHandler = new ProtocolHandler(this.connectionManager);

		this.requirements = new RequirementService(this.protocolHandler);
		this.tasks = new TaskService(this.protocolHandler);
		this.architecture = new ArchitectureService(this.protocolHandler);
		this.project = new ProjectService(this.protocolHandler);
		this.database = new DatabaseService(this.protocolHandler);
	}

	async connect(): Promise<void> {
		await this.protocolHandler.initialize();
	}

	isConnected(): boolean {
		return this.protocolHandler.isInitialized();
	}

	disconnect(): void {
		this.connectionManager.disconnect();
		this.protocolHandler.reset();
	}

	addConnectionListener(listener: (event: any) => void): void {
		this.connectionManager.addListener(listener);
	}

	removeConnectionListener(listener: (event: any) => void): void {
		this.connectionManager.removeListener(listener);
	}

	getConnectionStats(): {
		connected: boolean;
		retryAttempts: number;
		maxRetries: number;
		pendingRequests: number;
	} {
		return {
			connected: this.isConnected(),
			retryAttempts: this.connectionManager.getRetryAttempts(),
			maxRetries: this.connectionManager.getMaxRetries(),
			pendingRequests: this.protocolHandler.getPendingRequestCount()
		};
	}
}

export const mcpClient = new LifecycleMCPClient();
