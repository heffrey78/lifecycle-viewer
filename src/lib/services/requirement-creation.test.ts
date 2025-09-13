// Tests for RequirementCreationService
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequirementCreationService } from './requirement-creation.js';
import type { RequirementFormData, MCPResponse, Requirement } from '$lib/types/lifecycle.js';

// Mock the MCP client
vi.mock('./lifecycle-mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn(),
		connect: vi.fn(),
		createRequirement: vi.fn()
	}
}));

import { mcpClient } from './lifecycle-mcp-client.js';

// Get typed mock functions
const mockMcpClient = vi.mocked(mcpClient);

describe('RequirementCreationService', () => {
	let service: RequirementCreationService;
	
	const mockFormData: RequirementFormData = {
		type: 'FUNC',
		title: 'Test Requirement',
		priority: 'P1',
		current_state: 'Current state description',
		desired_state: 'Desired state description',
		business_value: 'Business value description',
		risk_level: 'Medium',
		functional_requirements: ['Requirement 1', 'Requirement 2'],
		acceptance_criteria: ['Criteria 1', 'Criteria 2'],
		author: 'Test Author'
	};

	const mockSuccessResponse: MCPResponse<Requirement> = {
		success: true,
		data: {
			id: 'REQ-0001-FUNC-01',
			requirement_number: 1,
			type: 'FUNC',
			version: 1,
			title: 'Test Requirement',
			status: 'Draft',
			priority: 'P1',
			risk_level: 'Medium',
			business_value: 'Business value description',
			current_state: 'Current state description',
			desired_state: 'Desired state description',
			acceptance_criteria: ['Criteria 1', 'Criteria 2'],
			functional_requirements: ['Requirement 1', 'Requirement 2'],
			author: 'Test Author',
			created_at: '2025-01-01T00:00:00Z',
			updated_at: '2025-01-01T00:00:00Z',
			task_count: 0,
			tasks_completed: 0
		}
	};

	beforeEach(() => {
		service = new RequirementCreationService();
		service.disableRateLimiting(); // Disable rate limiting for tests
		vi.clearAllMocks();
		mockMcpClient.isConnected.mockReturnValue(true);
		mockMcpClient.connect.mockResolvedValue(undefined);
		mockMcpClient.createRequirement.mockResolvedValue(mockSuccessResponse);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Form Validation', () => {
		it('should reject empty title', async () => {
			const invalidData = { ...mockFormData, title: '' };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Title is required');
			expect(result.isRetryable).toBe(false);
		});

		it('should reject empty current state', async () => {
			const invalidData = { ...mockFormData, current_state: '' };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Current state is required');
		});

		it('should reject empty desired state', async () => {
			const invalidData = { ...mockFormData, desired_state: '' };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Desired state is required');
		});

		it('should reject empty acceptance criteria', async () => {
			const invalidData = { ...mockFormData, acceptance_criteria: [] };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('At least one acceptance criterion is required');
		});

		it('should reject acceptance criteria with only empty strings', async () => {
			const invalidData = { ...mockFormData, acceptance_criteria: ['', '  ', '\t'] };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('At least one acceptance criterion is required');
		});

		it('should require business value for business requirements', async () => {
			const invalidData = { ...mockFormData, type: 'BUS', business_value: '' };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Business value is required');
		});

		it('should reject titles over 100 characters', async () => {
			const invalidData = { ...mockFormData, title: 'A'.repeat(101) };
			
			const result = await service.createRequirement(invalidData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Title must be 100 characters or less');
		});
	});

	describe('Data Transformation', () => {
		it('should clean up empty acceptance criteria', async () => {
			const dataWithEmptyItems = {
				...mockFormData,
				acceptance_criteria: ['Valid criteria', '', 'Another criteria', '  ']
			};
			
			await service.createRequirement(dataWithEmptyItems);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith(
				expect.objectContaining({
					acceptance_criteria: ['Valid criteria', 'Another criteria']
				})
			);
		});

		it('should clean up empty functional requirements', async () => {
			const dataWithEmptyItems = {
				...mockFormData,
				functional_requirements: ['Valid requirement', '', 'Another requirement']
			};
			
			await service.createRequirement(dataWithEmptyItems);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith(
				expect.objectContaining({
					functional_requirements: ['Valid requirement', 'Another requirement']
				})
			);
		});

		it('should default author to "System" if empty', async () => {
			const dataWithoutAuthor = { ...mockFormData, author: '' };
			
			await service.createRequirement(dataWithoutAuthor);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith(
				expect.objectContaining({
					author: 'System'
				})
			);
		});

		it('should trim whitespace from string fields', async () => {
			const dataWithWhitespace = {
				...mockFormData,
				title: '  Test Title  ',
				business_value: '\tBusiness Value\n',
				author: '  Author Name  '
			};
			
			await service.createRequirement(dataWithWhitespace);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Test Title',
					business_value: 'Business Value',
					author: 'Author Name'
				})
			);
		});
	});

	describe('Connection Handling', () => {
		it('should handle disconnected client', async () => {
			mockMcpClient.isConnected.mockReturnValue(false);
			mockMcpClient.connect.mockRejectedValue(new Error('Connection failed'));
			
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Unable to connect to the server');
			expect(result.isRetryable).toBe(true);
		});

		it('should attempt to connect if not connected', async () => {
			mockMcpClient.isConnected.mockReturnValue(false);
			mockMcpClient.connect.mockResolvedValue(undefined);
			
			await service.createRequirement(mockFormData);
			
			expect(mockMcpClient.connect).toHaveBeenCalled();
		});

		it('should check connection status', async () => {
			mockMcpClient.isConnected.mockReturnValue(true);
			
			const isConnected = await service.checkConnection();
			
			expect(isConnected).toBe(true);
			expect(mockMcpClient.isConnected).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should handle MCP client errors', async () => {
			const errorResponse: MCPResponse<Requirement> = {
				success: false,
				error: 'Server error occurred'
			};
			mockMcpClient.createRequirement.mockResolvedValue(errorResponse);
			
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(false);
			expect(result.error).toBe('Server error occurred');
		});

		it('should handle network timeout errors', async () => {
			// Mock a slow response that will be timed out by the service
			mockMcpClient.createRequirement.mockImplementation(() => 
				new Promise(resolve => setTimeout(resolve, 2000)) // Takes 2 seconds, timeout is 500ms
			);
			
			const result = await service.createRequirement(mockFormData, { timeout: 500, retries: 1 });
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('timed out');
			expect(result.isRetryable).toBe(true);
		});

		it('should provide user-friendly error messages for duplicate titles', async () => {
			const errorResponse: MCPResponse<Requirement> = {
				success: false,
				error: 'UNIQUE constraint failed: requirements.title'
			};
			mockMcpClient.createRequirement.mockResolvedValue(errorResponse);
			
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('A requirement with this title already exists');
		});

		it('should provide user-friendly error messages for validation errors', async () => {
			const errorResponse: MCPResponse<Requirement> = {
				success: false,
				error: 'Invalid data: title is required'
			};
			mockMcpClient.createRequirement.mockResolvedValue(errorResponse);
			
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('The provided data is invalid');
		});

		it('should provide user-friendly error messages for permission errors', async () => {
			const errorResponse: MCPResponse<Requirement> = {
				success: false,
				error: 'Permission denied: not authorized to create requirements'
			};
			mockMcpClient.createRequirement.mockResolvedValue(errorResponse);
			
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('You do not have permission to create requirements');
		});

		it('should handle JSON-RPC error codes correctly', async () => {
			const jsonRpcError = {
				code: -32603,
				message: 'Internal error'
			};
			mockMcpClient.createRequirement.mockRejectedValue(jsonRpcError);
			
			const result = await service.createRequirement(mockFormData, { retries: 1 });
			
			expect(result.success).toBe(false);
			expect(result.isRetryable).toBe(true);
		}, 10000);

		it('should not retry client errors (4xx equivalent)', async () => {
			const jsonRpcError = {
				code: -32602,
				message: 'Invalid params'
			};
			mockMcpClient.createRequirement.mockRejectedValue(jsonRpcError);
			
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(false);
			expect(result.isRetryable).toBe(false);
		});
	});

	describe('Retry Mechanism', () => {
		it('should retry on retryable errors', async () => {
			mockMcpClient.createRequirement
				.mockRejectedValueOnce(new Error('Network error'))
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValue(mockSuccessResponse);
			
			const result = await service.createRequirement(mockFormData, { retries: 2 });
			
			expect(result.success).toBe(true);
			expect(mockMcpClient.createRequirement).toHaveBeenCalledTimes(3);
		});

		it('should not retry non-retryable errors', async () => {
			const validationError = {
				code: -32602,
				message: 'Invalid params'
			};
			mockMcpClient.createRequirement.mockRejectedValue(validationError);
			
			const result = await service.createRequirement(mockFormData, { retries: 3 });
			
			expect(result.success).toBe(false);
			expect(mockMcpClient.createRequirement).toHaveBeenCalledTimes(1);
		});

		it('should respect retry limit', async () => {
			mockMcpClient.createRequirement.mockRejectedValue(new Error('Network error'));
			
			const result = await service.createRequirement(mockFormData, { retries: 2 });
			
			expect(result.success).toBe(false);
			expect(mockMcpClient.createRequirement).toHaveBeenCalledTimes(3); // initial + 2 retries
		});

		it('should use exponential backoff for retries', async () => {
			const startTime = Date.now();
			mockMcpClient.createRequirement.mockRejectedValue(new Error('Network error'));
			
			await service.createRequirement(mockFormData, { retries: 2 });
			
			const endTime = Date.now();
			const elapsed = endTime - startTime;
			
			// Should have waited at least 1000ms + 2000ms = 3000ms total for backoff
			expect(elapsed).toBeGreaterThan(3000);
		});
	});

	describe('Timeout Handling', () => {
		it('should timeout long-running operations', async () => {
			mockMcpClient.createRequirement.mockImplementation(() => 
				new Promise(resolve => setTimeout(resolve, 2000)) // Takes 2 seconds
			);
			
			const result = await service.createRequirement(mockFormData, { timeout: 500, retries: 0 });
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('timed out');
		});

		it('should not timeout fast operations', async () => {
			mockMcpClient.createRequirement.mockImplementation(() =>
				Promise.resolve(mockSuccessResponse)
			);
			
			const result = await service.createRequirement(mockFormData, { timeout: 1000 });
			
			expect(result.success).toBe(true);
		});
	});

	describe('Successful Creation', () => {
		it('should return success result on successful creation', async () => {
			const result = await service.createRequirement(mockFormData);
			
			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockSuccessResponse.data);
			expect(result.error).toBeUndefined();
		});

		it('should call MCP client with correct parameters', async () => {
			await service.createRequirement(mockFormData);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith({
				type: 'FUNC',
				title: 'Test Requirement',
				priority: 'P1',
				current_state: 'Current state description',
				desired_state: 'Desired state description',
				business_value: 'Business value description',
				risk_level: 'Medium',
				functional_requirements: ['Requirement 1', 'Requirement 2'],
				acceptance_criteria: ['Criteria 1', 'Criteria 2'],
				author: 'Test Author'
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle undefined optional fields', async () => {
			const minimalData: RequirementFormData = {
				type: 'FUNC',
				title: 'Minimal Requirement',
				priority: 'P2',
				current_state: 'Current state',
				desired_state: 'Desired state',
				acceptance_criteria: ['One criteria']
			};
			
			const result = await service.createRequirement(minimalData);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith(
				expect.objectContaining({
					business_value: undefined,
					risk_level: undefined,
					functional_requirements: undefined,
					author: 'System'
				})
			);
		});

		it('should handle concurrent creation requests', async () => {
			// Simulate two concurrent requests
			const promise1 = service.createRequirement(mockFormData);
			const promise2 = service.createRequirement({
				...mockFormData,
				title: 'Second Requirement'
			});
			
			const [result1, result2] = await Promise.all([promise1, promise2]);
			
			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
			expect(mockMcpClient.createRequirement).toHaveBeenCalledTimes(2);
		});

		it('should handle empty arrays gracefully', async () => {
			const dataWithEmptyArrays = {
				...mockFormData,
				functional_requirements: [],
				acceptance_criteria: ['Valid criteria'] // At least one required
			};
			
			await service.createRequirement(dataWithEmptyArrays);
			
			expect(mockMcpClient.createRequirement).toHaveBeenCalledWith(
				expect.objectContaining({
					functional_requirements: undefined
				})
			);
		});
	});
});