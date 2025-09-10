// MCP Tool Registry Types
// Defines interfaces for discovering, categorizing, and managing tools from multiple MCP servers

// Core MCP tool definition
export interface MCPTool {
	name: string;
	description?: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
	serverId: string;
	serverName?: string;
	category?: string;
	tags?: string[];
	version?: string;
}

// Tool execution result
export interface MCPToolResult {
	content: Array<{
		type: 'text' | 'image' | 'resource';
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
	isError?: boolean;
}

// Tool search and filtering
export interface ToolSearchFilters {
	query?: string;
	category?: string;
	tags?: string[];
	serverId?: string;
	serverName?: string;
}

// Tool category definitions
export enum ToolCategory {
	LIFECYCLE = 'lifecycle',
	DATABASE = 'database',
	API = 'api',
	FILESYSTEM = 'filesystem',
	WEB = 'web',
	UTILITY = 'utility',
	CUSTOM = 'custom'
}

// Server connection info for tool registry
export interface MCPServerInfo {
	id: string;
	name: string;
	url?: string;
	transport: 'websocket' | 'stdio' | 'http' | 'sse';
	connected: boolean;
	capabilities?: {
		tools?: string[];
		resources?: boolean;
		prompts?: boolean;
	};
	lastUpdated?: Date;
}

// Tool registry events
export interface ToolRegistryEvents {
	toolsChanged: { serverId: string; tools: MCPTool[] };
	serverConnected: { server: MCPServerInfo };
	serverDisconnected: { serverId: string };
	toolExecuted: { tool: MCPTool; result: MCPToolResult; duration: number };
}
