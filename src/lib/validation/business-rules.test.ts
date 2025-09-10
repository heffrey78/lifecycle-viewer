import { describe, it, expect, vi, beforeEach } from 'vitest';
import { businessRules } from './schemas.js';

// Mock the MCP client
vi.mock('$lib/services/mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn(),
		getRequirements: vi.fn(),
		getTasks: vi.fn(),
		getArchitectureDecisions: vi.fn(),
		getRequirementDetails: vi.fn()
	}
}));

describe('Business Rules Integration', () => {
	let mockMcpClient: any;

	beforeEach(async () => {
		// Import the mocked client
		const { mcpClient } = await import('$lib/services/mcp-client.js');
		mockMcpClient = mcpClient;

		// Reset all mocks
		vi.clearAllMocks();
	});

	describe('checkDuplicateTitle', () => {
		it('should return null when MCP client is not connected', async () => {
			mockMcpClient.isConnected.mockReturnValue(false);

			const result = await businessRules.checkDuplicateTitle('Test Title', 'requirement');
			expect(result).toBeNull();
			expect(mockMcpClient.isConnected).toHaveBeenCalled();
		});

		it('should return null when no duplicates exist', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [
					{ id: '1', title: 'Different Title' },
					{ id: '2', title: 'Another Title' }
				]
			});

			const result = await businessRules.checkDuplicateTitle('Test Title', 'requirement');
			expect(result).toBeNull();
		});

		it('should return error message when duplicate title exists', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [
					{ id: '1', title: 'Test Title' },
					{ id: '2', title: 'Another Title' }
				]
			});

			const result = await businessRules.checkDuplicateTitle('Test Title', 'requirement');
			expect(result).toBe('A requirement with the title "Test Title" already exists');
		});

		it('should exclude current entity when checking duplicates', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [
					{ id: '1', title: 'Test Title' },
					{ id: '2', title: 'Another Title' }
				]
			});

			const result = await businessRules.checkDuplicateTitle('Test Title', 'requirement', '1');
			expect(result).toBeNull(); // Should not find duplicate when excluding self
		});

		it('should handle case-insensitive matching', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockResolvedValue({
				success: true,
				data: [{ id: '1', title: 'TEST TITLE' }]
			});

			const result = await businessRules.checkDuplicateTitle('test title', 'requirement');
			expect(result).toBe('A requirement with the title "test title" already exists');
		});

		it('should handle tasks correctly', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getTasks.mockResolvedValue({
				success: true,
				data: [{ id: '1', title: 'Test Task' }]
			});

			const result = await businessRules.checkDuplicateTitle('Test Task', 'task');
			expect(result).toBe('A task with the title "Test Task" already exists');
		});

		it('should handle architecture decisions correctly', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getArchitectureDecisions.mockResolvedValue({
				success: true,
				data: [{ id: '1', title: 'Test Architecture' }]
			});

			const result = await businessRules.checkDuplicateTitle('Test Architecture', 'architecture');
			expect(result).toBe('A architecture with the title "Test Architecture" already exists');
		});

		it('should gracefully handle MCP client errors', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirements.mockRejectedValue(new Error('Network error'));

			const result = await businessRules.checkDuplicateTitle('Test Title', 'requirement');
			expect(result).toBeNull(); // Should not block form on network errors
		});
	});

	describe('validateRequirementStatus', () => {
		it('should return null when MCP client is not connected', async () => {
			mockMcpClient.isConnected.mockReturnValue(false);

			const result = await businessRules.validateRequirementStatus(['req-1']);
			expect(result).toBeNull();
		});

		it('should return error when requirement not found', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirementDetails.mockResolvedValue({
				success: false,
				data: null
			});

			const result = await businessRules.validateRequirementStatus(['req-1']);
			expect(result).toBe('Requirement req-1 not found');
		});

		it('should return null when all requirements are in valid states', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirementDetails.mockImplementation((id: string) =>
				Promise.resolve({
					success: true,
					data: { id, title: `Requirement ${id}`, status: 'Approved' }
				})
			);

			const result = await businessRules.validateRequirementStatus(['req-1', 'req-2']);
			expect(result).toBeNull();
		});

		it('should return error when requirements are in invalid states', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirementDetails.mockImplementation((id: string) =>
				Promise.resolve({
					success: true,
					data: {
						id,
						title: `Requirement ${id}`,
						status: id === 'req-1' ? 'Draft' : 'Under Review'
					}
				})
			);

			const result = await businessRules.validateRequirementStatus(['req-1', 'req-2']);
			expect(result).toContain('Cannot create tasks for requirements in invalid states');
			expect(result).toContain('Requirement req-1 (Draft)');
			expect(result).toContain('Requirement req-2 (Under Review)');
		});

		it('should handle mixed valid/invalid requirement states', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirementDetails.mockImplementation((id: string) =>
				Promise.resolve({
					success: true,
					data: {
						id,
						title: `Requirement ${id}`,
						status: id === 'req-1' ? 'Approved' : 'Draft'
					}
				})
			);

			const result = await businessRules.validateRequirementStatus(['req-1', 'req-2']);
			expect(result).toContain('Cannot create tasks for requirements in invalid states');
			expect(result).toContain('Requirement req-2 (Draft)');
			expect(result).not.toContain('req-1');
		});

		it('should gracefully handle MCP client errors', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			mockMcpClient.getRequirementDetails.mockRejectedValue(new Error('Network error'));

			const result = await businessRules.validateRequirementStatus(['req-1']);
			expect(result).toBeNull(); // Should not block form on network errors
		});
	});
});
