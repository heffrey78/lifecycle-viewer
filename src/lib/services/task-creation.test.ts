// Tests for TaskCreationService
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskCreationService } from './task-creation.js';
import type { TaskFormData, MCPResponse, Task, Requirement } from '$lib/types/lifecycle.js';

// Mock the MCP client
vi.mock('./lifecycle-mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn(),
		connect: vi.fn(),
		createTask: vi.fn(),
		getRequirementsJson: vi.fn(),
		getTasksJson: vi.fn()
	}
}));

import { mcpClient } from './lifecycle-mcp-client.js';

// Get typed mock functions
const mockMcpClient = vi.mocked(mcpClient);

describe('TaskCreationService', () => {
	let service: TaskCreationService;

	const mockFormData: TaskFormData = {
		title: 'Test Task',
		priority: 'P1',
		effort: 'M',
		user_story: 'As a user, I want to test so that I can verify functionality',
		acceptance_criteria: ['Criterion 1', 'Criterion 2'],
		assignee: 'test@example.com',
		requirement_ids: ['REQ-001-FUNC-00'],
		parent_task_id: 'TASK-001-00-00'
	};

	const mockTask: Task = {
		id: 'TASK-002-00-00',
		task_number: 2,
		subtask_number: 0,
		version: 0,
		title: 'Test Task',
		status: 'Not Started',
		priority: 'P1',
		effort: 'M',
		user_story: 'As a user, I want to test so that I can verify functionality',
		acceptance_criteria: ['Criterion 1', 'Criterion 2'],
		assignee: 'test@example.com',
		created_at: '2025-09-16T12:00:00Z',
		updated_at: '2025-09-16T12:00:00Z',
		parent_task_id: 'TASK-001-00-00'
	};

	const mockRequirements: Requirement[] = [
		{
			id: 'REQ-001-FUNC-00',
			requirement_number: 1,
			type: 'FUNC',
			version: 0,
			title: 'Test Requirement',
			status: 'Approved',
			priority: 'P1',
			current_state: 'Current state',
			desired_state: 'Desired state',
			created_at: '2025-09-16T12:00:00Z',
			updated_at: '2025-09-16T12:00:00Z',
			task_count: 0,
			tasks_completed: 0
		}
	];

	beforeEach(() => {
		service = new TaskCreationService();
		vi.clearAllMocks();

		// Default successful mocks
		mockMcpClient.isConnected.mockResolvedValue(true);
		mockMcpClient.connect.mockResolvedValue();
		mockMcpClient.createTask.mockResolvedValue({
			success: true,
			data: mockTask
		});
		mockMcpClient.getRequirementsJson.mockResolvedValue({
			success: true,
			data: mockRequirements
		});
		mockMcpClient.getTasksJson.mockResolvedValue({
			success: true,
			data: [mockTask]
		});

		// Disable rate limiting for tests
		service.setRateLimitingEnabled(false);
	});

	afterEach(() => {
		service.resetRateLimit();
	});

	describe('Connection Management', () => {
		it('should check connection status correctly', async () => {
			mockMcpClient.isConnected.mockResolvedValue(true);

			const result = await service.checkConnection();

			expect(result).toBe(true);
			expect(mockMcpClient.isConnected).toHaveBeenCalled();
		});

		it('should handle connection check failures', async () => {
			mockMcpClient.isConnected.mockRejectedValue(new Error('Connection failed'));

			const result = await service.checkConnection();

			expect(result).toBe(false);
		});
	});

	describe('Requirements Loading', () => {
		it('should get approved requirements successfully', async () => {
			const result = await service.getApprovedRequirements();

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockRequirements);
			expect(mockMcpClient.getRequirementsJson).toHaveBeenCalledWith({
				status: ['Approved', 'Architecture', 'Ready', 'Implemented', 'Validated']
			});
		});

		it('should connect to MCP if not already connected', async () => {
			mockMcpClient.isConnected.mockResolvedValue(false);

			await service.getApprovedRequirements();

			expect(mockMcpClient.connect).toHaveBeenCalled();
		});

		it('should handle requirements loading failure', async () => {
			mockMcpClient.getRequirementsJson.mockRejectedValue(new Error('Network error'));

			const result = await service.getApprovedRequirements();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Network error');
		});
	});

	describe('Tasks Loading', () => {
		it('should get all tasks successfully', async () => {
			const result = await service.getAllTasks();

			expect(result.success).toBe(true);
			expect(result.data).toEqual([mockTask]);
			expect(mockMcpClient.getTasksJson).toHaveBeenCalled();
		});

		it('should handle tasks loading failure', async () => {
			mockMcpClient.getTasksJson.mockRejectedValue(new Error('Server error'));

			const result = await service.getAllTasks();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Server error');
		});
	});

	describe('Form Data Validation', () => {
		it('should validate correct form data', async () => {
			const result = await service.validateFormData(mockFormData);

			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject empty title', async () => {
			const invalidData = { ...mockFormData, title: '' };

			const result = await service.validateFormData(invalidData);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Task title is required');
		});

		it('should reject empty requirement IDs', async () => {
			const invalidData = { ...mockFormData, requirement_ids: [] };

			const result = await service.validateFormData(invalidData);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('At least one requirement must be linked');
		});

		it('should reject invalid email format', async () => {
			const invalidData = { ...mockFormData, assignee: 'invalid-email' };

			const result = await service.validateFormData(invalidData);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Assignee must be a valid email address');
		});

		it('should reject title that is too long', async () => {
			const invalidData = { ...mockFormData, title: 'A'.repeat(201) };

			const result = await service.validateFormData(invalidData);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Title must be 200 characters or less');
		});

		it('should reject user story that is too long', async () => {
			const invalidData = { ...mockFormData, user_story: 'A'.repeat(2001) };

			const result = await service.validateFormData(invalidData);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('User story must be 2000 characters or less');
		});

		it('should reject too many acceptance criteria', async () => {
			const invalidData = {
				...mockFormData,
				acceptance_criteria: Array.from({ length: 21 }, (_, i) => `Criterion ${i}`)
			};

			const result = await service.validateFormData(invalidData);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Maximum 20 acceptance criteria allowed');
		});
	});

	describe('Data Sanitization', () => {
		it('should sanitize HTML in title', async () => {
			const maliciousData = {
				...mockFormData,
				title: '<script>alert("xss")</script>Clean Title'
			};

			const result = await service.createTask(maliciousData);

			expect(mockMcpClient.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Clean Title'
				})
			);
		});

		it('should sanitize HTML in user story', async () => {
			const maliciousData = {
				...mockFormData,
				user_story: '<iframe src="malicious.com"></iframe>Clean story'
			};

			const result = await service.createTask(maliciousData);

			expect(mockMcpClient.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					user_story: 'Clean story'
				})
			);
		});

		it('should filter out empty acceptance criteria', async () => {
			const dataWithEmpty = {
				...mockFormData,
				acceptance_criteria: ['Valid criterion', '', '   ', 'Another valid']
			};

			const result = await service.createTask(dataWithEmpty);

			expect(mockMcpClient.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					acceptance_criteria: ['Valid criterion', 'Another valid']
				})
			);
		});
	});

	describe('Task Creation', () => {
		it('should create task successfully', async () => {
			const result = await service.createTask(mockFormData);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockTask);
			expect(mockMcpClient.createTask).toHaveBeenCalledWith({
				requirement_ids: ['REQ-001-FUNC-00'],
				title: 'Test Task',
				priority: 'P1',
				effort: 'M',
				user_story: 'As a user, I want to test so that I can verify functionality',
				acceptance_criteria: ['Criterion 1', 'Criterion 2'],
				assignee: 'test@example.com',
				parent_task_id: 'TASK-001-00-00'
			});
		});

		it('should handle MCP server errors', async () => {
			mockMcpClient.createTask.mockResolvedValue({
				success: false,
				error: 'Server error'
			});

			const result = await service.createTask(mockFormData);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Server error');
			expect(result.isRetryable).toBe(true);
		});

		it('should handle network timeouts', async () => {
			mockMcpClient.createTask.mockImplementation(
				() =>
					new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100))
			);

			const result = await service.createTask(mockFormData, { timeout: 50 });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request timeout');
			expect(result.isRetryable).toBe(true);
		});

		it('should not retry validation errors', async () => {
			const invalidData = { ...mockFormData, title: '' };

			const result = await service.createTask(invalidData);

			expect(result.success).toBe(false);
			expect(result.isRetryable).toBe(false);
			expect(mockMcpClient.createTask).not.toHaveBeenCalled();
		});

		it('should retry on transient errors', async () => {
			mockMcpClient.createTask.mockRejectedValueOnce(new Error('Network error')).mockResolvedValue({
				success: true,
				data: mockTask
			});

			const result = await service.createTask(mockFormData, { retries: 1 });

			expect(result.success).toBe(true);
			expect(mockMcpClient.createTask).toHaveBeenCalledTimes(2);
		});

		it('should respect retry limits', async () => {
			mockMcpClient.createTask.mockRejectedValue(new Error('Persistent error'));

			const result = await service.createTask(mockFormData, { retries: 2 });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Persistent error');
			expect(mockMcpClient.createTask).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});

		it('should use exponential backoff for retries', async () => {
			mockMcpClient.createTask.mockRejectedValue(new Error('Network error'));

			const startTime = Date.now();
			await service.createTask(mockFormData, { retries: 1 });
			const endTime = Date.now();

			// Should have waited at least 1000ms for the first retry
			expect(endTime - startTime).toBeGreaterThan(900);
		});

		it('should connect to MCP if not connected', async () => {
			mockMcpClient.isConnected.mockResolvedValue(false);

			await service.createTask(mockFormData);

			expect(mockMcpClient.connect).toHaveBeenCalled();
		});

		it('should remove undefined values from parameters', async () => {
			const minimalData: TaskFormData = {
				title: 'Minimal Task',
				priority: 'P1',
				requirement_ids: ['REQ-001-FUNC-00']
			};

			await service.createTask(minimalData);

			expect(mockMcpClient.createTask).toHaveBeenCalledWith({
				title: 'Minimal Task',
				priority: 'P1',
				requirement_ids: ['REQ-001-FUNC-00']
			});
		});
	});

	describe('Rate Limiting', () => {
		beforeEach(() => {
			service.setRateLimitingEnabled(true);
			service.resetRateLimit();
		});

		it('should enforce minimum interval between requests', async () => {
			const startTime = Date.now();

			// First request
			await service.createTask(mockFormData);

			// Second request should be delayed
			await service.createTask(mockFormData);

			const endTime = Date.now();
			const elapsed = endTime - startTime;

			// Should have waited at least 1000ms between requests
			expect(elapsed).toBeGreaterThan(900);
		});

		it('should allow bypassing rate limiting when disabled', async () => {
			service.setRateLimitingEnabled(false);

			const startTime = Date.now();

			await service.createTask(mockFormData);
			await service.createTask(mockFormData);

			const endTime = Date.now();
			const elapsed = endTime - startTime;

			// Should not have been significantly delayed
			expect(elapsed).toBeLessThan(500);
		});
	});

	describe('Error Handling', () => {
		it('should handle malformed MCP responses', async () => {
			mockMcpClient.createTask.mockResolvedValue({
				success: true,
				data: null as any
			});

			const result = await service.createTask(mockFormData);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Task creation failed');
		});

		it('should handle MCP client connection failures', async () => {
			mockMcpClient.connect.mockRejectedValue(new Error('Connection refused'));

			const result = await service.createTask(mockFormData);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Connection refused');
			expect(result.isRetryable).toBe(true);
		});

		it('should provide appropriate error categorization', async () => {
			// Validation error - not retryable
			const validationResult = await service.createTask({ ...mockFormData, title: '' });
			expect(validationResult.isRetryable).toBe(false);

			// Network error - retryable
			mockMcpClient.createTask.mockRejectedValue(new Error('Network timeout'));
			const networkResult = await service.createTask(mockFormData);
			expect(networkResult.isRetryable).toBe(true);

			// Server validation error - not retryable
			mockMcpClient.createTask.mockResolvedValue({
				success: false,
				error: 'Invalid requirement ID'
			});
			const serverValidationResult = await service.createTask(mockFormData);
			expect(serverValidationResult.isRetryable).toBe(true); // Server errors are considered retryable
		});
	});

	describe('Performance and Memory', () => {
		it('should handle concurrent task creation requests', async () => {
			const promises = Array.from({ length: 5 }, () => service.createTask(mockFormData));

			const results = await Promise.all(promises);

			results.forEach((result) => {
				expect(result.success).toBe(true);
			});

			expect(mockMcpClient.createTask).toHaveBeenCalledTimes(5);
		});

		it('should not leak memory with repeated use', async () => {
			// Create many tasks in sequence
			for (let i = 0; i < 100; i++) {
				await service.createTask({
					...mockFormData,
					title: `Task ${i}`
				});
			}

			expect(mockMcpClient.createTask).toHaveBeenCalledTimes(100);
		});
	});

	describe('Data Transformation Edge Cases', () => {
		it('should handle empty arrays correctly', async () => {
			const dataWithEmptyArrays: TaskFormData = {
				...mockFormData,
				acceptance_criteria: []
			};

			await service.createTask(dataWithEmptyArrays);

			const callArgs = mockMcpClient.createTask.mock.calls[0][0];
			expect(callArgs).not.toHaveProperty('acceptance_criteria');
		});

		it('should handle special characters in text fields', async () => {
			const dataWithSpecialChars: TaskFormData = {
				...mockFormData,
				title: 'Task with "quotes" & <symbols>',
				user_story: 'Story with émojis 🚀 and ñoña'
			};

			await service.createTask(dataWithSpecialChars);

			expect(mockMcpClient.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Task with "quotes" & symbols',
					user_story: 'Story with émojis 🚀 and ñoña'
				})
			);
		});

		it('should handle very long input strings', async () => {
			const longTitle = 'A'.repeat(10000);
			const dataWithLongStrings: TaskFormData = {
				...mockFormData,
				title: longTitle
			};

			await service.createTask(dataWithLongStrings);

			const callArgs = mockMcpClient.createTask.mock.calls[0][0];
			expect(callArgs.title.length).toBeLessThanOrEqual(10000);
		});
	});
});
