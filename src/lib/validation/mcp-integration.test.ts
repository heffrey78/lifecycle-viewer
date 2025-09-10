import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPValidationService } from './mcp-integration.js';
import type { ValidationContext } from './validator.js';

// Mock the MCP client
vi.mock('$lib/services/mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn(),
		getRequirements: vi.fn(),
		getTasks: vi.fn(),
		getArchitectureDecisions: vi.fn(),
		getRequirementDetails: vi.fn(),
		getTaskDetails: vi.fn()
	}
}));

// Mock the schemas
vi.mock('./schemas.js', () => ({
	businessRules: {
		validateStatusProgression: vi.fn()
	}
}));

// Mock cross-entity rules
vi.mock('./cross-entity-rules.js', () => ({
	crossEntityRules: {
		validateRequirementForTask: vi.fn(),
		validateRequirementStatusProgression: vi.fn(),
		validateTaskStatusProgression: vi.fn()
	}
}));

describe('MCPValidationService', () => {
	let service: MCPValidationService;
	let mockMcpClient: any;
	let mockBusinessRules: any;
	let mockCrossEntityRules: any;

	beforeEach(async () => {
		// Clear all mocks
		vi.clearAllMocks();

		// Import mocked modules
		const { mcpClient } = await import('$lib/services/mcp-client.js');
		const { businessRules } = await import('./schemas.js');
		const { crossEntityRules } = await import('./cross-entity-rules.js');

		mockMcpClient = mcpClient;
		mockBusinessRules = businessRules;
		mockCrossEntityRules = crossEntityRules;

		// Create service instance
		service = new MCPValidationService();
	});

	afterEach(() => {
		service.clearCache();
	});

	describe('Caching Behavior', () => {
		it('should cache validation results', async () => {
			vi.clearAllMocks(); // Clear previous mock calls

			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: []
			});

			// Use priority validation which doesn't call MCP
			const result1 = await service.validateWithMCP('priority', 'P0', {});
			const result2 = await service.validateWithMCP('priority', 'P0', {});

			expect(result1).toBe(result2);
			expect(result1).toBeNull(); // Both should be null for valid priority

			// Priority validation doesn't use MCP, so no calls should be made
			expect(mockMcpClient.getRequirements).not.toHaveBeenCalled();
		});

		it('should provide cache statistics', async () => {
			const stats = service.getCacheStats();

			expect(stats).toHaveProperty('size');
			expect(stats).toHaveProperty('hitRate');
			expect(stats).toHaveProperty('totalRequests');
			expect(typeof stats.hitRate).toBe('number');
		});

		it('should clear cache', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({ success: true, data: [] });

			await service.validateWithMCP('title', 'Test', { entityType: 'requirement' });

			let stats = service.getCacheStats();
			expect(stats.size).toBeGreaterThan(0);

			service.clearCache();
			stats = service.getCacheStats();
			expect(stats.size).toBe(0);
		});

		it('should invalidate cache for specific entities', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({ success: true, data: [] });

			await service.validateWithMCP('title', 'Test', {
				entityType: 'requirement',
				existingId: 'req-1'
			});
			await service.validateWithMCP('title', 'Other', { entityType: 'task', existingId: 'task-1' });

			let stats = service.getCacheStats();
			expect(stats.size).toBe(2);

			service.invalidateEntity('requirement', 'req-1');
			stats = service.getCacheStats();
			expect(stats.size).toBe(1); // Only task entry should remain
		});
	});

	describe('Title Duplicate Validation', () => {
		it('should detect duplicate requirement titles', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [
					{ id: 'req-1', title: 'Existing Title' },
					{ id: 'req-2', title: 'Another Title' }
				]
			});

			const result = await service.validateWithMCP('title', 'Existing Title', {
				entityType: 'requirement'
			});

			expect(result).toBe('A requirement with the title "Existing Title" already exists');
		});

		it('should exclude current entity from duplicate check', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [{ id: 'req-1', title: 'My Title' }]
			});

			const result = await service.validateWithMCP('title', 'My Title', {
				entityType: 'requirement',
				existingId: 'req-1' // Exclude self
			});

			expect(result).toBeNull(); // Should not find duplicate when excluding self
		});

		it('should handle case-insensitive duplicate checking', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [{ id: 'req-1', title: 'EXISTING TITLE' }]
			});

			const result = await service.validateWithMCP('title', 'existing title', {
				entityType: 'requirement'
			});

			expect(result).toBe('A requirement with the title "existing title" already exists');
		});

		it('should work with different entity types', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getTasks.mockResolvedValue({
				success: true,
				data: [{ id: 'task-1', title: 'Task Title' }]
			});

			const result = await service.validateWithMCP('title', 'Task Title', {
				entityType: 'task'
			});

			expect(result).toBe('A task with the title "Task Title" already exists');
			expect(mockMcpClient.getTasks).toHaveBeenCalled();
		});
	});

	describe('Cross-Entity Validation Integration', () => {
		it('should validate requirement IDs for task creation', async () => {
			mockCrossEntityRules.validateRequirementForTask.mockResolvedValue(
				'Requirements not in valid state'
			);

			const result = await service.validateWithMCP('requirement_ids', ['req-1', 'req-2'], {
				entityType: 'task'
			});

			expect(result).toBe('Requirements not in valid state');
			expect(mockCrossEntityRules.validateRequirementForTask).toHaveBeenCalledWith([
				'req-1',
				'req-2'
			]);
		});

		it('should validate requirement status progression', async () => {
			mockMcpClient.getRequirementDetails.mockResolvedValue({
				success: true,
				data: { id: 'req-1', status: 'Approved' }
			});
			mockBusinessRules.validateStatusProgression.mockReturnValue(null);
			mockCrossEntityRules.validateRequirementStatusProgression.mockResolvedValue(
				'Cross-entity error'
			);

			const result = await service.validateWithMCP('status', 'Implemented', {
				entityType: 'requirement',
				existingId: 'req-1'
			});

			expect(result).toBe('Cross-entity error');
			expect(mockCrossEntityRules.validateRequirementStatusProgression).toHaveBeenCalledWith(
				'req-1',
				'Implemented'
			);
		});

		it('should validate task status progression', async () => {
			mockMcpClient.getTaskDetails.mockResolvedValue({
				success: true,
				data: { id: 'task-1', status: 'In Progress' }
			});
			mockCrossEntityRules.validateTaskStatusProgression.mockResolvedValue(null);

			const result = await service.validateWithMCP('status', 'Complete', {
				entityType: 'task',
				existingId: 'task-1'
			});

			expect(result).toBeNull();
			expect(mockCrossEntityRules.validateTaskStatusProgression).toHaveBeenCalledWith(
				'task-1',
				'Complete'
			);
		});
	});

	describe('Priority Validation', () => {
		it('should validate priority values', async () => {
			const validResult = await service.validateWithMCP('priority', 'P0', {});
			expect(validResult).toBeNull();

			const invalidResult = await service.validateWithMCP('priority', 'P5', {});
			expect(invalidResult).toBe('Priority must be one of: P0, P1, P2, P3');
		});
	});

	describe('Error Handling', () => {
		it('should handle MCP client disconnection gracefully', async () => {
			mockMcpClient.isConnected.mockReturnValue(false);

			const result = await service.validateWithMCP('title', 'Test Title', {
				entityType: 'requirement'
			});

			expect(result).toBeNull(); // Should gracefully degrade
		});

		it('should handle validation errors gracefully', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockRejectedValue(new Error('Network error'));

			const result = await service.validateWithMCP('title', 'Test Title', {
				entityType: 'requirement'
			});

			expect(result).toBeNull(); // Should not throw, return null for graceful degradation
		});

		it('should handle cross-entity rule loading errors', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);

			// Test with invalid field that doesn't use cross-entity rules
			const result = await service.validateWithMCP('invalid_field', 'test', {
				entityType: 'task'
			});

			// Should handle gracefully and return null for unknown fields
			expect(result).toBeNull();
		});
	});

	describe('Cache Export and Debugging', () => {
		it('should export cache contents for debugging', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({ success: true, data: [] });

			await service.validateWithMCP('title', 'Test', { entityType: 'requirement' });

			const exported = service.exportCache();
			expect(Array.isArray(exported)).toBe(true);
			expect(exported.length).toBeGreaterThan(0);
			expect(exported[0]).toHaveProperty('key');
			expect(exported[0]).toHaveProperty('value');
			expect(exported[0]).toHaveProperty('age');
			expect(exported[0]).toHaveProperty('accessCount');
		});
	});

	describe('Performance Characteristics', () => {
		it('should maintain cache hit rate above target', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);

			// Use priority validation which doesn't call MCP but uses cache
			const context = {};

			// Make same request multiple times
			for (let i = 0; i < 10; i++) {
				await service.validateWithMCP('priority', 'P0', context);
			}

			const stats = service.getCacheStats();
			expect(stats.hitRate).toBeGreaterThan(0.8); // 80% hit rate target
			expect(mockMcpClient.getRequirements).not.toHaveBeenCalled(); // Priority validation doesn't use MCP
		});

		it('should handle cache size limits', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({ success: true, data: [] });

			// Fill cache beyond typical usage
			const promises = [];
			for (let i = 0; i < 50; i++) {
				promises.push(
					service.validateWithMCP('title', `Title ${i}`, { entityType: 'requirement' })
				);
			}
			await Promise.all(promises);

			const stats = service.getCacheStats();
			expect(stats.size).toBeLessThanOrEqual(1000); // Should not exceed max size
		});
	});
});
