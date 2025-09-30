// MCP Tool Discovery Service
// Integrates with existing MCP clients to discover and register tools automatically

import type { MCPTool, MCPServerInfo } from '$lib/types/mcp-tools.js';
import { ToolCategory } from '$lib/types/mcp-tools.js';
import { toolRegistry } from './tool-registry.js';
import { mcpClient as lifecycleMcpClient } from './mcp-client.js';

// MCP tool discovery interface for different server types
export interface MCPToolDiscovery {
	serverId: string;
	serverName: string;
	transport: 'websocket' | 'stdio' | 'http' | 'sse';
	discoverTools(): Promise<MCPTool[]>;
	isConnected(): boolean;
	getCapabilities(): Promise<any>;
}

// Lifecycle MCP client tool discovery implementation
class LifecycleMCPToolDiscovery implements MCPToolDiscovery {
	serverId = 'lifecycle-mcp';
	serverName = 'Lifecycle MCP Server';
	transport = 'websocket' as const;

	constructor(private client = lifecycleMcpClient) {}

	async discoverTools(): Promise<MCPTool[]> {
		try {
			// Ensure client is connected
			if (!this.client.isConnected()) {
				await this.client.connect();
				// Wait for initialization
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			// Use MCP tools/list method to discover available tools
			const toolsResponse = await this.client.sendMethodRequest('tools/list', {});

			// Extract tools from MCP response
			let serverTools: any[] = [];
			if (toolsResponse && typeof toolsResponse === 'object') {
				if ('tools' in toolsResponse) {
					serverTools = toolsResponse.tools;
				} else if (Array.isArray(toolsResponse)) {
					serverTools = toolsResponse;
				} else if ('content' in toolsResponse && Array.isArray(toolsResponse.content)) {
					// Handle MCP response format
					const content = toolsResponse.content[0];
					if (content && content.text) {
						try {
							const parsed = JSON.parse(content.text);
							serverTools = parsed.tools || parsed;
						} catch {
							console.warn('Could not parse tools response as JSON');
							serverTools = [];
						}
					}
				}
			}

			// Convert MCP tools to our format and enhance descriptions
			const discoveredTools: MCPTool[] = serverTools.map((tool: any) => ({
				name: tool.name,
				description: this.enhanceToolDescription(
					tool.name,
					tool.description || `MCP tool: ${tool.name}`,
					tool.inputSchema || tool.input_schema
				),
				inputSchema: tool.inputSchema ||
					tool.input_schema || {
						type: 'object',
						properties: {},
						required: []
					},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['mcp', 'lifecycle']
			}));

			if (discoveredTools.length > 0) {
				console.log(`Discovered ${discoveredTools.length} tools from ${this.serverName}`);
			}
			return discoveredTools;
		} catch (error) {
			console.error('Failed to discover tools from MCP server:', error);
			console.log('Falling back to hardcoded tool definitions...');

			// Fallback to hardcoded definitions if discovery fails
			return this.getHardcodedTools();
		}
	}

	private enhanceToolDescription(
		toolName: string,
		originalDescription: string,
		inputSchema: any
	): string {
		// Add parameter examples to tool descriptions to help Claude understand usage
		const examples: Record<string, string> = {
			query_tasks: `${originalDescription}. Examples: {"status": "Not Started"}, {"priority": "P0"}, {"status": "Complete", "priority": "P1"}`,
			query_requirements: `${originalDescription}. Examples: {"status": "Draft"}, {"priority": "P0"}, {"type": "FUNC"}`,
			get_task_details: `${originalDescription}. Example: {"task_id": "TASK-0047-00-00"}`,
			get_requirement_details: `${originalDescription}. Example: {"requirement_id": "REQ-0001-FUNC-00"}`,
			update_task_status: `${originalDescription}. Example: {"task_id": "TASK-0047-00-00", "new_status": "In Progress"}`,
			create_task: `${originalDescription}. Example: {"requirement_ids": ["REQ-0001-FUNC-00"], "title": "Implement feature", "priority": "P1"}`,
			query_architecture_decisions: `${originalDescription}. Examples: {"status": "Proposed"}, {"requirement_id": "REQ-0001-FUNC-00"}`
		};

		return examples[toolName] || originalDescription;
	}

	private getHardcodedTools(): MCPTool[] {
		// Fallback hardcoded tools (keeping existing definitions as backup)
		const tools: MCPTool[] = [
			{
				name: 'query_requirements',
				description: 'Query and filter requirements with optional search criteria',
				inputSchema: {
					type: 'object',
					properties: {
						search_text: { type: 'string', description: 'Search text to filter requirements' },
						status: { type: 'string', description: 'Filter by requirement status' },
						priority: { type: 'string', description: 'Filter by priority level' },
						type: { type: 'string', description: 'Filter by requirement type' }
					}
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'requirements', 'query']
			},
			{
				name: 'get_requirement_details',
				description: 'Get detailed information about a specific requirement by ID',
				inputSchema: {
					type: 'object',
					properties: {
						requirement_id: { type: 'string', description: 'Unique identifier for the requirement' }
					},
					required: ['requirement_id']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'requirements', 'details']
			},
			{
				name: 'create_requirement',
				description: 'Create a new requirement with specified properties',
				inputSchema: {
					type: 'object',
					properties: {
						type: { type: 'string', enum: ['FUNC', 'NFUNC', 'TECH', 'BUS', 'INTF'] },
						title: { type: 'string', description: 'Title of the requirement' },
						priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
						current_state: { type: 'string', description: 'Current state description' },
						desired_state: { type: 'string', description: 'Desired state description' },
						business_value: { type: 'string', description: 'Business value proposition' },
						author: { type: 'string', description: 'Author email address' },
						functional_requirements: { type: 'array', items: { type: 'string' } },
						acceptance_criteria: { type: 'array', items: { type: 'string' } },
						risk_level: { type: 'string', enum: ['High', 'Medium', 'Low'] }
					},
					required: ['type', 'title', 'priority', 'current_state', 'desired_state']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['create', 'requirements']
			},
			{
				name: 'update_requirement_status',
				description: 'Update the status of an existing requirement',
				inputSchema: {
					type: 'object',
					properties: {
						requirement_id: {
							type: 'string',
							description: 'Unique identifier for the requirement'
						},
						new_status: {
							type: 'string',
							enum: [
								'Draft',
								'Under Review',
								'Approved',
								'Architecture',
								'Ready',
								'Implemented',
								'Validated',
								'Deprecated'
							]
						},
						comment: {
							type: 'string',
							description: 'Optional comment explaining the status change'
						}
					},
					required: ['requirement_id', 'new_status']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['update', 'requirements', 'status']
			},
			{
				name: 'query_tasks',
				description: 'Query and filter tasks with optional search criteria',
				inputSchema: {
					type: 'object',
					properties: {
						assignee: { type: 'string', description: 'Filter by task assignee' },
						status: { type: 'string', description: 'Filter by task status' },
						priority: { type: 'string', description: 'Filter by priority level' },
						requirement_id: { type: 'string', description: 'Filter by associated requirement' }
					}
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'tasks', 'query']
			},
			{
				name: 'get_task_details',
				description: 'Get detailed information about a specific task by ID',
				inputSchema: {
					type: 'object',
					properties: {
						task_id: { type: 'string', description: 'Unique identifier for the task' }
					},
					required: ['task_id']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'tasks', 'details']
			},
			{
				name: 'create_task',
				description: 'Create a new task associated with requirements',
				inputSchema: {
					type: 'object',
					properties: {
						requirement_ids: { type: 'array', items: { type: 'string' } },
						title: { type: 'string', description: 'Title of the task' },
						priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
						user_story: { type: 'string', description: 'User story for the task' },
						acceptance_criteria: { type: 'array', items: { type: 'string' } },
						effort: { type: 'string', enum: ['XS', 'S', 'M', 'L', 'XL'] },
						assignee: { type: 'string', description: 'Task assignee' },
						parent_task_id: { type: 'string', description: 'Parent task ID for subtasks' }
					},
					required: ['requirement_ids', 'title', 'priority']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['create', 'tasks']
			},
			{
				name: 'update_task_status',
				description: 'Update the status of an existing task',
				inputSchema: {
					type: 'object',
					properties: {
						task_id: { type: 'string', description: 'Unique identifier for the task' },
						new_status: {
							type: 'string',
							enum: ['Not Started', 'In Progress', 'Blocked', 'Complete', 'Abandoned']
						},
						assignee: { type: 'string', description: 'Update task assignee' },
						comment: {
							type: 'string',
							description: 'Optional comment explaining the status change'
						}
					},
					required: ['task_id', 'new_status']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['update', 'tasks', 'status']
			},
			{
				name: 'query_architecture_decisions',
				description: 'Query and filter architecture decisions',
				inputSchema: {
					type: 'object',
					properties: {
						search_text: { type: 'string', description: 'Search text to filter decisions' },
						status: { type: 'string', description: 'Filter by decision status' },
						requirement_id: { type: 'string', description: 'Filter by associated requirement' },
						type: { type: 'string', description: 'Filter by decision type' }
					}
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'architecture', 'query']
			},
			{
				name: 'get_architecture_details',
				description: 'Get detailed information about a specific architecture decision',
				inputSchema: {
					type: 'object',
					properties: {
						architecture_id: {
							type: 'string',
							description: 'Unique identifier for the architecture decision'
						}
					},
					required: ['architecture_id']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'architecture', 'details']
			},
			{
				name: 'create_architecture_decision',
				description: 'Create a new architecture decision record',
				inputSchema: {
					type: 'object',
					properties: {
						requirement_ids: { type: 'array', items: { type: 'string' } },
						title: { type: 'string', description: 'Title of the architecture decision' },
						context: { type: 'string', description: 'Context and background' },
						decision: { type: 'string', description: 'The decision made' },
						decision_drivers: { type: 'array', items: { type: 'string' } },
						considered_options: { type: 'array', items: { type: 'string' } },
						consequences: { type: 'object', description: 'Consequences of the decision' },
						authors: { type: 'array', items: { type: 'string' } }
					},
					required: ['requirement_ids', 'title', 'context', 'decision']
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['create', 'architecture']
			},
			{
				name: 'get_project_status',
				description: 'Get overall project health and status metrics',
				inputSchema: {
					type: 'object',
					properties: {
						include_blocked: { type: 'boolean', description: 'Include blocked items in the status' }
					}
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'project', 'metrics']
			},
			{
				name: 'get_project_metrics',
				description: 'Get structured project metrics for programmatic use',
				inputSchema: {
					type: 'object',
					properties: {}
				},
				serverId: this.serverId,
				serverName: this.serverName,
				category: ToolCategory.LIFECYCLE,
				tags: ['read', 'project', 'metrics']
			}
		];

		return tools;
	}

	isConnected(): boolean {
		return this.client.isConnected();
	}

	async getCapabilities(): Promise<any> {
		// Return the capabilities based on the tools we know about
		return {
			tools: (await this.discoverTools()).map((t) => t.name),
			resources: false, // Lifecycle MCP doesn't expose resources yet
			prompts: false
		};
	}
}

// Tool discovery service that manages multiple MCP servers
export class MCPToolDiscoveryService {
	private discoverers = new Map<string, MCPToolDiscovery>();
	private discoveryInterval: NodeJS.Timeout | null = null;
	private isAutoDiscovering = false;
	private lastDiscoveryTime = new Map<string, number>();
	private minDiscoveryInterval = 30000; // Minimum 30 seconds between discoveries per server

	constructor() {
		// Register the default lifecycle MCP server
		this.registerDiscoverer(new LifecycleMCPToolDiscovery());
	}

	/**
	 * Register a new tool discoverer for an MCP server
	 */
	registerDiscoverer(discoverer: MCPToolDiscovery): void {
		this.discoverers.set(discoverer.serverId, discoverer);

		// Register the server in the tool registry
		const serverInfo: MCPServerInfo = {
			id: discoverer.serverId,
			name: discoverer.serverName,
			transport: discoverer.transport,
			connected: discoverer.isConnected()
		};

		toolRegistry.registerServer(serverInfo);

		// Discover tools immediately if connected
		if (discoverer.isConnected()) {
			this.discoverToolsForServer(discoverer.serverId);
		}
	}

	/**
	 * Unregister a tool discoverer
	 */
	unregisterDiscoverer(serverId: string): void {
		this.discoverers.delete(serverId);
		toolRegistry.unregisterServer(serverId);
	}

	/**
	 * Discover tools for a specific server
	 */
	async discoverToolsForServer(serverId: string): Promise<MCPTool[]> {
		const discoverer = this.discoverers.get(serverId);
		if (!discoverer) {
			throw new Error(`No discoverer registered for server ${serverId}`);
		}

		// Check if we've discovered tools recently to avoid excessive polling
		const lastDiscovery = this.lastDiscoveryTime.get(serverId) || 0;
		const timeSinceLastDiscovery = Date.now() - lastDiscovery;

		if (timeSinceLastDiscovery < this.minDiscoveryInterval) {
			// Return cached tools if discovery was recent
			const server = toolRegistry.getServer(serverId);
			if (server && server.tools && server.tools.length > 0) {
				return server.tools;
			}
		}

		try {
			const tools = await discoverer.discoverTools();
			toolRegistry.updateServerTools(serverId, tools);
			this.lastDiscoveryTime.set(serverId, Date.now());
			return tools;
		} catch (error) {
			console.error(`Failed to discover tools for server ${serverId}:`, error);
			return [];
		}
	}

	/**
	 * Discover tools for all registered servers
	 */
	async discoverAllTools(): Promise<Map<string, MCPTool[]>> {
		const results = new Map<string, MCPTool[]>();

		for (const [serverId, discoverer] of this.discoverers.entries()) {
			if (discoverer.isConnected()) {
				try {
					const tools = await this.discoverToolsForServer(serverId);
					results.set(serverId, tools);
				} catch (error) {
					console.error(`Failed to discover tools for ${serverId}:`, error);
					results.set(serverId, []);
				}
			}
		}

		return results;
	}

	/**
	 * Start automatic tool discovery at regular intervals
	 */
	startAutoDiscovery(intervalMs: number = 120000): void {
		if (this.isAutoDiscovering) {
			this.stopAutoDiscovery();
		}

		this.isAutoDiscovering = true;
		console.log(`Starting auto-discovery with ${intervalMs / 1000}s interval`);

		this.discoveryInterval = setInterval(async () => {
			try {
				// Only discover if we have connected servers
				const connectedServers = Array.from(this.discoverers.values()).filter((discoverer) =>
					discoverer.isConnected()
				);

				if (connectedServers.length > 0) {
					await this.discoverAllTools();
				}
			} catch (error) {
				console.warn('Auto discovery failed:', error);
			}
		}, intervalMs);

		// Run initial discovery only if we have connected servers
		const connectedServers = Array.from(this.discoverers.values()).filter((discoverer) =>
			discoverer.isConnected()
		);

		if (connectedServers.length > 0) {
			this.discoverAllTools();
		}
	}

	/**
	 * Stop automatic tool discovery
	 */
	stopAutoDiscovery(): void {
		if (this.discoveryInterval) {
			clearInterval(this.discoveryInterval);
			this.discoveryInterval = null;
		}
		this.isAutoDiscovering = false;
	}

	/**
	 * Check connection status for all servers and update registry
	 */
	async updateServerStatuses(): Promise<void> {
		for (const [serverId, discoverer] of this.discoverers.entries()) {
			const server = toolRegistry.getServer(serverId);
			if (server) {
				const wasConnected = server.connected;
				const isConnected = discoverer.isConnected();

				if (wasConnected !== isConnected) {
					// Connection status changed
					server.connected = isConnected;
					server.lastUpdated = new Date();

					if (isConnected && !wasConnected) {
						// Server reconnected - discover tools
						toolRegistry.emit('serverConnected', { server });
						await this.discoverToolsForServer(serverId);
					} else if (!isConnected && wasConnected) {
						// Server disconnected - keep tools but mark as disconnected
						toolRegistry.emit('serverDisconnected', { serverId });
					}
				}
			}
		}
	}

	/**
	 * Get all registered discoverers
	 */
	getDiscoverers(): Map<string, MCPToolDiscovery> {
		return new Map(this.discoverers);
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.stopAutoDiscovery();
		this.discoverers.clear();
	}
}

// Singleton instance for global tool discovery
export const mcpToolDiscovery = new MCPToolDiscoveryService();
