// Tool Registry Tests
// Comprehensive test suite for tool discovery and registry functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from './tool-registry.js';
import type { MCPTool, MCPServerInfo, ToolSearchFilters } from '$lib/types/mcp-tools.js';
import { ToolCategory } from '$lib/types/mcp-tools.js';

describe('ToolRegistry', () => {
	let registry: ToolRegistry;

	const mockServer: MCPServerInfo = {
		id: 'test-server',
		name: 'Test MCP Server',
		transport: 'websocket',
		connected: true
	};

	const mockTool: MCPTool = {
		name: 'test_tool',
		description: 'A test tool for unit testing',
		inputSchema: {
			type: 'object',
			properties: {
				param1: { type: 'string' }
			},
			required: ['param1']
		},
		serverId: 'test-server',
		serverName: 'Test MCP Server',
		category: ToolCategory.UTILITY,
		tags: ['test', 'utility']
	};

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	describe('Server Management', () => {
		it('should register a new server', () => {
			const eventSpy = vi.fn();
			registry.on('serverConnected', eventSpy);

			registry.registerServer(mockServer);

			expect(registry.getServer(mockServer.id)).toEqual({
				...mockServer,
				lastUpdated: expect.any(Date)
			});
			expect(eventSpy).toHaveBeenCalledWith({ server: expect.any(Object) });
		});

		it('should unregister a server and remove its tools', () => {
			const eventSpy = vi.fn();
			registry.on('serverDisconnected', eventSpy);

			registry.registerServer(mockServer);
			registry.updateServerTools(mockServer.id, [mockTool]);

			registry.unregisterServer(mockServer.id);

			expect(registry.getServer(mockServer.id)).toBeUndefined();
			expect(registry.getTools()).toHaveLength(0);
			expect(eventSpy).toHaveBeenCalledWith({ serverId: mockServer.id });
		});

		it('should get all registered servers', () => {
			registry.registerServer(mockServer);

			const servers = registry.getServers();
			expect(servers).toHaveLength(1);
			expect(servers[0].id).toBe(mockServer.id);
		});
	});

	describe('Tool Management', () => {
		beforeEach(() => {
			registry.registerServer(mockServer);
		});

		it('should update tools for a server', () => {
			const eventSpy = vi.fn();
			registry.on('toolsChanged', eventSpy);

			registry.updateServerTools(mockServer.id, [mockTool]);

			const tools = registry.getTools();
			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe(mockTool.name);
			expect(eventSpy).toHaveBeenCalledWith({
				serverId: mockServer.id,
				tools: [expect.any(Object)]
			});
		});

		it('should throw error when updating tools for unregistered server', () => {
			expect(() => {
				registry.updateServerTools('non-existent', [mockTool]);
			}).toThrow('Server non-existent not registered');
		});

		it('should get tool by server ID and name', () => {
			registry.updateServerTools(mockServer.id, [mockTool]);

			const tool = registry.getTool(mockServer.id, mockTool.name);
			expect(tool).toEqual(
				expect.objectContaining({
					name: mockTool.name,
					serverId: mockServer.id
				})
			);
		});

		it('should return undefined for non-existent tool', () => {
			const tool = registry.getTool('non-existent', 'non-existent');
			expect(tool).toBeUndefined();
		});

		it('should replace existing tools when updating server tools', () => {
			const tool1: MCPTool = { ...mockTool, name: 'tool1' };
			const tool2: MCPTool = { ...mockTool, name: 'tool2' };
			const tool3: MCPTool = { ...mockTool, name: 'tool3' };

			registry.updateServerTools(mockServer.id, [tool1, tool2]);
			expect(registry.getTools()).toHaveLength(2);

			registry.updateServerTools(mockServer.id, [tool3]);
			expect(registry.getTools()).toHaveLength(1);
			expect(registry.getTools()[0].name).toBe('tool3');
		});
	});

	describe('Tool Normalization', () => {
		beforeEach(() => {
			registry.registerServer(mockServer);
		});

		it('should normalize tool with server context', () => {
			const toolWithoutServerInfo: MCPTool = {
				name: 'normalize_test',
				description: 'Test normalization',
				inputSchema: { type: 'object', properties: {} },
				serverId: 'placeholder', // This will be overridden
				serverName: undefined,
				category: undefined,
				tags: undefined
			};

			registry.updateServerTools(mockServer.id, [toolWithoutServerInfo]);

			const normalizedTool = registry.getTool(mockServer.id, 'normalize_test')!;
			expect(normalizedTool.serverId).toBe(mockServer.id);
			expect(normalizedTool.serverName).toBe(mockServer.name);
			expect(normalizedTool.category).toBeDefined();
			expect(normalizedTool.tags).toBeDefined();
		});

		it('should infer category based on tool name', () => {
			const tools: Partial<MCPTool>[] = [
				{ name: 'query_requirements' }, // Should be LIFECYCLE
				{ name: 'database_connect' }, // Should be DATABASE
				{ name: 'http_request' }, // Should be API
				{ name: 'read_file' }, // Should be FILESYSTEM
				{ name: 'web_scrape' }, // Should be WEB
				{ name: 'random_tool' } // Should be UTILITY
			];

			tools.forEach((tool, index) => {
				const serverId = `server-${index}`;
				const fullTool: MCPTool = {
					...mockTool,
					name: tool.name!,
					category: undefined // Let it be inferred
				};

				registry.registerServer({ ...mockServer, id: serverId });
				registry.updateServerTools(serverId, [fullTool]);
			});

			const allTools = registry.getTools();
			expect(allTools.find((t) => t.name === 'query_requirements')?.category).toBe(
				ToolCategory.LIFECYCLE
			);
			expect(allTools.find((t) => t.name === 'database_connect')?.category).toBe(
				ToolCategory.DATABASE
			);
			expect(allTools.find((t) => t.name === 'http_request')?.category).toBe(ToolCategory.API);
			expect(allTools.find((t) => t.name === 'read_file')?.category).toBe(ToolCategory.FILESYSTEM);
			expect(allTools.find((t) => t.name === 'web_scrape')?.category).toBe(ToolCategory.WEB);
			expect(allTools.find((t) => t.name === 'random_tool')?.category).toBe(ToolCategory.UTILITY);
		});

		it('should generate tags based on tool name and description', () => {
			const toolWithOperations: MCPTool = {
				...mockTool,
				name: 'create_requirement',
				description: 'Create a new requirement for the project',
				tags: undefined
			};

			registry.updateServerTools(mockServer.id, [toolWithOperations]);

			const tool = registry.getTool(mockServer.id, 'create_requirement')!;
			expect(tool.tags).toContain('create');
			expect(tool.tags).toContain('requirements');
		});
	});

	describe('Search and Filtering', () => {
		beforeEach(() => {
			registry.registerServer(mockServer);

			const testTools: MCPTool[] = [
				{
					...mockTool,
					name: 'query_requirements',
					description: 'Query project requirements',
					category: ToolCategory.LIFECYCLE,
					tags: ['read', 'requirements', 'query']
				},
				{
					...mockTool,
					name: 'create_task',
					description: 'Create a new task',
					category: ToolCategory.LIFECYCLE,
					tags: ['create', 'tasks']
				},
				{
					...mockTool,
					name: 'database_query',
					description: 'Execute database query',
					category: ToolCategory.DATABASE,
					tags: ['read', 'database']
				}
			];

			registry.updateServerTools(mockServer.id, testTools);
		});

		it('should filter tools by category', () => {
			const filters: ToolSearchFilters = { category: ToolCategory.LIFECYCLE };
			const tools = registry.getTools(filters);

			expect(tools).toHaveLength(2);
			expect(tools.every((t) => t.category === ToolCategory.LIFECYCLE)).toBe(true);
		});

		it('should filter tools by server ID', () => {
			const filters: ToolSearchFilters = { serverId: mockServer.id };
			const tools = registry.getTools(filters);

			expect(tools).toHaveLength(3);
			expect(tools.every((t) => t.serverId === mockServer.id)).toBe(true);
		});

		it('should filter tools by server name', () => {
			const filters: ToolSearchFilters = { serverName: mockServer.name };
			const tools = registry.getTools(filters);

			expect(tools).toHaveLength(3);
			expect(tools.every((t) => t.serverName === mockServer.name)).toBe(true);
		});

		it('should filter tools by tags', () => {
			const filters: ToolSearchFilters = { tags: ['create'] };
			const tools = registry.getTools(filters);

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe('create_task');
		});

		it('should filter tools by search query', () => {
			const filters: ToolSearchFilters = { query: 'database' };
			const tools = registry.getTools(filters);

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe('database_query');
		});

		it('should combine multiple filters', () => {
			const filters: ToolSearchFilters = {
				category: ToolCategory.LIFECYCLE,
				tags: ['read'],
				query: 'query'
			};
			const tools = registry.getTools(filters);

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe('query_requirements');
		});
	});

	describe('Fuzzy Search', () => {
		beforeEach(() => {
			registry.registerServer(mockServer);

			const testTools: MCPTool[] = [
				{
					...mockTool,
					name: 'query_requirements',
					description: 'Query project requirements with filters',
					category: ToolCategory.LIFECYCLE,
					tags: ['read', 'requirements']
				},
				{
					...mockTool,
					name: 'create_requirement',
					description: 'Create a new project requirement',
					category: ToolCategory.LIFECYCLE,
					tags: ['create', 'requirements']
				},
				{
					...mockTool,
					name: 'database_backup',
					description: 'Backup database to storage',
					category: ToolCategory.DATABASE,
					tags: ['backup', 'database']
				}
			];

			registry.updateServerTools(mockServer.id, testTools);
		});

		it('should find exact name matches with highest score', () => {
			const results = registry.searchTools('query_requirements', 10);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('query_requirements');
		});

		it('should find partial name matches', () => {
			const results = registry.searchTools('requirement', 10);

			expect(results.length).toBeGreaterThan(0);
			expect(results.some((t) => t.name.includes('requirement'))).toBe(true);
		});

		it('should find description matches', () => {
			const results = registry.searchTools('backup', 10);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('database_backup');
		});

		it('should find tag matches', () => {
			const results = registry.searchTools('create', 10);

			expect(results.some((t) => t.tags?.includes('create'))).toBe(true);
		});

		it('should limit results', () => {
			const results = registry.searchTools('requirement', 1);

			expect(results).toHaveLength(1);
		});

		it('should return empty array for no matches', () => {
			const results = registry.searchTools('nonexistent', 10);

			expect(results).toHaveLength(0);
		});
	});

	describe('Category and Tag Management', () => {
		it('should return all available categories', () => {
			const categories = registry.getCategories();

			expect(categories).toContain(ToolCategory.LIFECYCLE);
			expect(categories).toContain(ToolCategory.DATABASE);
			expect(categories).toContain(ToolCategory.API);
		});

		it('should track tags from registered tools', () => {
			registry.registerServer(mockServer);
			registry.updateServerTools(mockServer.id, [mockTool]);

			const tags = registry.getTags();
			expect(tags).toContain('test');
			expect(tags).toContain('utility');
		});

		it('should group tools by category', () => {
			registry.registerServer(mockServer);

			const tool1: MCPTool = { ...mockTool, name: 'tool1', category: ToolCategory.LIFECYCLE };
			const tool2: MCPTool = { ...mockTool, name: 'tool2', category: ToolCategory.DATABASE };
			const tool3: MCPTool = { ...mockTool, name: 'tool3', category: ToolCategory.LIFECYCLE };

			registry.updateServerTools(mockServer.id, [tool1, tool2, tool3]);

			const grouped = registry.getToolsByCategory();
			expect(grouped.get(ToolCategory.LIFECYCLE)).toHaveLength(2);
			expect(grouped.get(ToolCategory.DATABASE)).toHaveLength(1);
		});
	});

	describe('Statistics', () => {
		it('should provide registry statistics', () => {
			registry.registerServer(mockServer);
			registry.registerServer({ ...mockServer, id: 'server2', connected: false });

			const tool1: MCPTool = { ...mockTool, name: 'tool1', category: ToolCategory.LIFECYCLE };
			const tool2: MCPTool = { ...mockTool, name: 'tool2', category: ToolCategory.DATABASE };

			registry.updateServerTools(mockServer.id, [tool1, tool2]);

			const stats = registry.getStats();

			expect(stats.totalTools).toBe(2);
			expect(stats.totalServers).toBe(2);
			expect(stats.connectedServers).toBe(1);
			expect(stats.toolsByCategory[ToolCategory.LIFECYCLE]).toBe(1);
			expect(stats.toolsByCategory[ToolCategory.DATABASE]).toBe(1);
			expect(stats.toolsByServer[mockServer.id]).toBe(2);
		});
	});

	describe('Registry Cleanup', () => {
		it('should clear all tools and servers', () => {
			registry.registerServer(mockServer);
			registry.updateServerTools(mockServer.id, [mockTool]);

			registry.clear();

			expect(registry.getTools()).toHaveLength(0);
			expect(registry.getServers()).toHaveLength(0);
			expect(registry.getTags()).toHaveLength(0);
			// Categories should still exist (default categories)
			expect(registry.getCategories().length).toBeGreaterThan(0);
		});
	});

	describe('Event Handling', () => {
		it('should emit events for tool changes', () => {
			const toolsChangedSpy = vi.fn();
			const serverConnectedSpy = vi.fn();

			registry.on('toolsChanged', toolsChangedSpy);
			registry.on('serverConnected', serverConnectedSpy);

			registry.registerServer(mockServer);
			registry.updateServerTools(mockServer.id, [mockTool]);

			expect(serverConnectedSpy).toHaveBeenCalledWith({
				server: expect.objectContaining({ id: mockServer.id })
			});
			expect(toolsChangedSpy).toHaveBeenCalledWith({
				serverId: mockServer.id,
				tools: [expect.objectContaining({ name: mockTool.name })]
			});
		});

		it('should allow removing event listeners', () => {
			const spy = vi.fn();

			registry.on('serverConnected', spy);
			registry.off('serverConnected', spy);
			registry.registerServer(mockServer);

			expect(spy).not.toHaveBeenCalled();
		});
	});
});
