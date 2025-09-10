// Tool Registry and Discovery System
// Aggregates tools from multiple MCP servers with search, filtering, and real-time updates

import type {
	MCPTool,
	MCPToolResult,
	ToolSearchFilters,
	MCPServerInfo,
	ToolRegistryEvents
} from '$lib/types/mcp-tools.js';
import { ToolCategory } from '$lib/types/mcp-tools.js';

// Event emitter for tool registry events
class EventEmitter<T extends Record<string, any>> {
	private listeners: { [K in keyof T]?: Array<(data: T[K]) => void> } = {};

	on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event]!.push(listener);
	}

	off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
		if (!this.listeners[event]) return;
		const index = this.listeners[event]!.indexOf(listener);
		if (index > -1) {
			this.listeners[event]!.splice(index, 1);
		}
	}

	emit<K extends keyof T>(event: K, data: T[K]): void {
		if (!this.listeners[event]) return;
		this.listeners[event]!.forEach((listener) => listener(data));
	}
}

export class ToolRegistry extends EventEmitter<ToolRegistryEvents> {
	private tools: Map<string, MCPTool> = new Map(); // key: serverId:toolName
	private servers: Map<string, MCPServerInfo> = new Map();
	private categories: Map<string, string[]> = new Map(); // category -> tool names
	private tags: Map<string, string[]> = new Map(); // tag -> tool names

	constructor() {
		super();
		this.initializeDefaultCategories();
	}

	/**
	 * Register a new MCP server
	 */
	registerServer(server: MCPServerInfo): void {
		this.servers.set(server.id, {
			...server,
			lastUpdated: new Date()
		});

		this.emit('serverConnected', { server });
	}

	/**
	 * Unregister an MCP server and remove all its tools
	 */
	unregisterServer(serverId: string): void {
		const server = this.servers.get(serverId);
		if (!server) return;

		// Remove all tools from this server
		const toolsToRemove: string[] = [];
		for (const [key, tool] of this.tools.entries()) {
			if (tool.serverId === serverId) {
				toolsToRemove.push(key);
			}
		}

		toolsToRemove.forEach((key) => {
			const tool = this.tools.get(key);
			if (tool) {
				this.removeToolFromIndexes(tool);
				this.tools.delete(key);
			}
		});

		this.servers.delete(serverId);
		this.emit('serverDisconnected', { serverId });
	}

	/**
	 * Update tools for a specific server
	 */
	updateServerTools(serverId: string, tools: MCPTool[]): void {
		const server = this.servers.get(serverId);
		if (!server) {
			throw new Error(`Server ${serverId} not registered`);
		}

		// Remove existing tools for this server
		const existingTools: string[] = [];
		for (const [key, tool] of this.tools.entries()) {
			if (tool.serverId === serverId) {
				existingTools.push(key);
			}
		}

		existingTools.forEach((key) => {
			const tool = this.tools.get(key);
			if (tool) {
				this.removeToolFromIndexes(tool);
				this.tools.delete(key);
			}
		});

		// Add new tools
		tools.forEach((tool) => {
			const normalizedTool = this.normalizeTool(tool, server);
			const key = `${serverId}:${tool.name}`;
			this.tools.set(key, normalizedTool);
			this.addToolToIndexes(normalizedTool);
		});

		// Update server info
		server.capabilities = {
			...server.capabilities,
			tools: tools.map((t) => t.name)
		};
		server.lastUpdated = new Date();

		this.emit('toolsChanged', { serverId, tools });
	}

	/**
	 * Get all available tools with optional filtering
	 */
	getTools(filters?: ToolSearchFilters): MCPTool[] {
		let results = Array.from(this.tools.values());

		if (!filters) return results;

		// Filter by server
		if (filters.serverId) {
			results = results.filter((tool) => tool.serverId === filters.serverId);
		}

		if (filters.serverName) {
			results = results.filter((tool) => tool.serverName === filters.serverName);
		}

		// Filter by category
		if (filters.category) {
			results = results.filter((tool) => tool.category === filters.category);
		}

		// Filter by tags
		if (filters.tags && filters.tags.length > 0) {
			results = results.filter((tool) => tool.tags?.some((tag) => filters.tags!.includes(tag)));
		}

		// Search by query (name and description)
		if (filters.query) {
			const query = filters.query.toLowerCase();
			results = results.filter(
				(tool) =>
					tool.name.toLowerCase().includes(query) || tool.description?.toLowerCase().includes(query)
			);
		}

		return results;
	}

	/**
	 * Get tool by server ID and tool name
	 */
	getTool(serverId: string, toolName: string): MCPTool | undefined {
		return this.tools.get(`${serverId}:${toolName}`);
	}

	/**
	 * Search tools with fuzzy matching
	 */
	searchTools(query: string, limit: number = 20): MCPTool[] {
		if (!query.trim()) return [];

		const queryLower = query.toLowerCase();
		const results: Array<{ tool: MCPTool; score: number }> = [];

		for (const tool of this.tools.values()) {
			let score = 0;

			// Exact name match gets highest score
			if (tool.name.toLowerCase() === queryLower) {
				score += 100;
			} else if (tool.name.toLowerCase().includes(queryLower)) {
				score += 50;
			}

			// Description match
			if (tool.description?.toLowerCase().includes(queryLower)) {
				score += 30;
			}

			// Tag match
			if (tool.tags?.some((tag) => tag.toLowerCase().includes(queryLower))) {
				score += 20;
			}

			// Category match
			if (tool.category?.toLowerCase().includes(queryLower)) {
				score += 15;
			}

			if (score > 0) {
				results.push({ tool, score });
			}
		}

		// Sort by score and return top results
		return results
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map((r) => r.tool);
	}

	/**
	 * Get all available categories
	 */
	getCategories(): string[] {
		return Array.from(this.categories.keys());
	}

	/**
	 * Get all available tags
	 */
	getTags(): string[] {
		return Array.from(this.tags.keys());
	}

	/**
	 * Get registered servers
	 */
	getServers(): MCPServerInfo[] {
		return Array.from(this.servers.values());
	}

	/**
	 * Get server by ID
	 */
	getServer(serverId: string): MCPServerInfo | undefined {
		return this.servers.get(serverId);
	}

	/**
	 * Get tools grouped by category
	 */
	getToolsByCategory(): Map<string, MCPTool[]> {
		const grouped = new Map<string, MCPTool[]>();

		for (const tool of this.tools.values()) {
			const category = tool.category || 'uncategorized';
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push(tool);
		}

		return grouped;
	}

	/**
	 * Get registry statistics
	 */
	getStats(): {
		totalTools: number;
		totalServers: number;
		connectedServers: number;
		toolsByCategory: Record<string, number>;
		toolsByServer: Record<string, number>;
	} {
		const toolsByCategory: Record<string, number> = {};
		const toolsByServer: Record<string, number> = {};

		for (const tool of this.tools.values()) {
			const category = tool.category || 'uncategorized';
			toolsByCategory[category] = (toolsByCategory[category] || 0) + 1;
			toolsByServer[tool.serverId] = (toolsByServer[tool.serverId] || 0) + 1;
		}

		return {
			totalTools: this.tools.size,
			totalServers: this.servers.size,
			connectedServers: Array.from(this.servers.values()).filter((s) => s.connected).length,
			toolsByCategory,
			toolsByServer
		};
	}

	/**
	 * Clear all tools and servers
	 */
	clear(): void {
		this.tools.clear();
		this.servers.clear();
		this.categories.clear();
		this.tags.clear();
		this.initializeDefaultCategories();
	}

	// Private methods

	private normalizeTool(tool: MCPTool, server: MCPServerInfo): MCPTool {
		return {
			...tool,
			serverId: server.id,
			serverName: server.name,
			category: tool.category || this.inferCategory(tool.name),
			tags: tool.tags || this.generateTags(tool)
		};
	}

	private inferCategory(toolName: string): string {
		const name = toolName.toLowerCase();

		if (
			name.includes('query') ||
			name.includes('get') ||
			name.includes('create') ||
			name.includes('update')
		) {
			return ToolCategory.LIFECYCLE;
		}
		if (name.includes('database') || name.includes('db') || name.includes('sql')) {
			return ToolCategory.DATABASE;
		}
		if (name.includes('http') || name.includes('api') || name.includes('request')) {
			return ToolCategory.API;
		}
		if (name.includes('file') || name.includes('read') || name.includes('write')) {
			return ToolCategory.FILESYSTEM;
		}
		if (name.includes('web') || name.includes('browser') || name.includes('scrape')) {
			return ToolCategory.WEB;
		}

		return ToolCategory.UTILITY;
	}

	private generateTags(tool: MCPTool): string[] {
		const tags: string[] = [];
		const name = tool.name.toLowerCase();
		const description = tool.description?.toLowerCase() || '';

		// Add operation-based tags
		if (name.includes('query') || name.includes('get') || name.includes('list')) {
			tags.push('read');
		}
		if (name.includes('create') || name.includes('add') || name.includes('insert')) {
			tags.push('create');
		}
		if (name.includes('update') || name.includes('modify') || name.includes('edit')) {
			tags.push('update');
		}
		if (name.includes('delete') || name.includes('remove')) {
			tags.push('delete');
		}

		// Add domain-based tags from description
		if (description.includes('requirement')) tags.push('requirements');
		if (description.includes('task')) tags.push('tasks');
		if (description.includes('architecture')) tags.push('architecture');

		return tags;
	}

	private addToolToIndexes(tool: MCPTool): void {
		// Add to category index
		if (tool.category) {
			if (!this.categories.has(tool.category)) {
				this.categories.set(tool.category, []);
			}
			this.categories.get(tool.category)!.push(tool.name);
		}

		// Add to tag indexes
		if (tool.tags) {
			tool.tags.forEach((tag) => {
				if (!this.tags.has(tag)) {
					this.tags.set(tag, []);
				}
				this.tags.get(tag)!.push(tool.name);
			});
		}
	}

	private removeToolFromIndexes(tool: MCPTool): void {
		// Remove from category index
		if (tool.category && this.categories.has(tool.category)) {
			const tools = this.categories.get(tool.category)!;
			const index = tools.indexOf(tool.name);
			if (index > -1) {
				tools.splice(index, 1);
			}
			if (tools.length === 0) {
				this.categories.delete(tool.category);
			}
		}

		// Remove from tag indexes
		if (tool.tags) {
			tool.tags.forEach((tag) => {
				if (this.tags.has(tag)) {
					const tools = this.tags.get(tag)!;
					const index = tools.indexOf(tool.name);
					if (index > -1) {
						tools.splice(index, 1);
					}
					if (tools.length === 0) {
						this.tags.delete(tag);
					}
				}
			});
		}
	}

	private initializeDefaultCategories(): void {
		Object.values(ToolCategory).forEach((category) => {
			this.categories.set(category, []);
		});
	}
}

// Singleton instance for global tool registry
export const toolRegistry = new ToolRegistry();
