import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from './task-service.js';
import type { ProtocolHandler } from './protocol-handler.js';
import type { Task, TaskFilters, MCPResponse } from '$lib/types/lifecycle.js';

// Mock ProtocolHandler
class MockProtocolHandler {
	sendRequestWithResponse = vi.fn();

	mockSuccess<T>(data: T): void {
		this.sendRequestWithResponse.mockResolvedValue({
			success: true,
			data
		});
	}

	mockError(error: string): void {
		this.sendRequestWithResponse.mockResolvedValue({
			success: false,
			error
		});
	}

	mockReject(error: Error): void {
		this.sendRequestWithResponse.mockRejectedValue(error);
	}

	reset(): void {
		this.sendRequestWithResponse.mockReset();
	}
}

describe('TaskService', () => {
	let taskService: TaskService;
	let mockProtocolHandler: MockProtocolHandler;

	const sampleTask: Task = {
		id: 'TASK-001-00-00',
		requirement_ids: ['REQ-001-FUNC-00'],
		title: 'Implement user authentication',
		status: 'Not Started',
		priority: 'P1',
		effort: 'M',
		assignee: 'john.doe@company.com',
		user_story: 'As a user, I want to authenticate so that I can access protected features',
		acceptance_criteria: [
			'Login form accepts valid credentials',
			'Invalid credentials are rejected'
		],
		github_issue_url: 'https://github.com/company/repo/issues/123',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-02T00:00:00Z'
	};

	const sampleFilters: TaskFilters = {
		status: 'Not Started',
		priority: 'P1',
		assignee: 'john.doe@company.com',
		requirement_id: 'REQ-001-FUNC-00'
	};

	beforeEach(() => {
		mockProtocolHandler = new MockProtocolHandler();
		taskService = new TaskService(mockProtocolHandler as any as ProtocolHandler);
	});

	describe('getTasks', () => {
		it('should call query_tasks with filters', async () => {
			const expectedData = [sampleTask];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await taskService.getTasks(sampleFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks',
				sampleFilters
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should call query_tasks with empty filters when none provided', async () => {
			const expectedData = [sampleTask];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await taskService.getTasks();

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith('query_tasks', {});
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle empty results', async () => {
			mockProtocolHandler.mockSuccess([]);

			const result = await taskService.getTasks();

			expect(result).toEqual({
				success: true,
				data: []
			});
		});

		it('should propagate errors from protocol handler', async () => {
			mockProtocolHandler.mockError('Database connection failed');

			const result = await taskService.getTasks();

			expect(result).toEqual({
				success: false,
				error: 'Database connection failed'
			});
		});

		it('should handle protocol handler exceptions', async () => {
			mockProtocolHandler.mockReject(new Error('Network timeout'));

			await expect(taskService.getTasks()).rejects.toThrow('Network timeout');
		});
	});

	describe('getTasksJson', () => {
		it('should call query_tasks_json with filters', async () => {
			const expectedData = [sampleTask];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await taskService.getTasksJson(sampleFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks_json',
				sampleFilters
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle undefined filters', async () => {
			const expectedData = [sampleTask];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await taskService.getTasksJson(undefined);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks_json',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle partial filters', async () => {
			const partialFilters: TaskFilters = { status: 'In Progress' };
			const expectedData = [{ ...sampleTask, status: 'In Progress' }];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await taskService.getTasksJson(partialFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks_json',
				partialFilters
			);
			expect(result.success).toBe(true);
		});

		it('should filter by assignee', async () => {
			const assigneeFilter: TaskFilters = { assignee: 'jane.smith@company.com' };
			const expectedData = [{ ...sampleTask, assignee: 'jane.smith@company.com' }];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await taskService.getTasksJson(assigneeFilter);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks_json',
				assigneeFilter
			);
		});

		it('should filter by requirement ID', async () => {
			const reqFilter: TaskFilters = { requirement_id: 'REQ-002-NFUNC-00' };
			mockProtocolHandler.mockSuccess([sampleTask]);

			const result = await taskService.getTasksJson(reqFilter);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks_json',
				reqFilter
			);
		});
	});

	describe('getTaskDetails', () => {
		it('should call get_task_details with correct ID', async () => {
			mockProtocolHandler.mockSuccess(sampleTask);

			const result = await taskService.getTaskDetails('TASK-001-00-00');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith('get_task_details', {
				task_id: 'TASK-001-00-00'
			});
			expect(result).toEqual({
				success: true,
				data: sampleTask
			});
		});

		it('should handle non-existent task', async () => {
			mockProtocolHandler.mockError('Task not found');

			const result = await taskService.getTaskDetails('TASK-999-INVALID');

			expect(result).toEqual({
				success: false,
				error: 'Task not found'
			});
		});

		it('should validate ID parameter', async () => {
			mockProtocolHandler.mockSuccess(sampleTask);

			await taskService.getTaskDetails('');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith('get_task_details', {
				task_id: ''
			});
		});

		it('should handle tasks with additional relationships', async () => {
			const taskWithRelations = {
				...sampleTask,
				parent_task_id: 'TASK-000-00-00',
				subtasks: ['TASK-001-01-00', 'TASK-001-02-00'],
				dependencies: ['TASK-002-00-00']
			};
			mockProtocolHandler.mockSuccess(taskWithRelations);

			const result = await taskService.getTaskDetails('TASK-001-00-00');

			expect(result.success).toBe(true);
			expect(result.data).toEqual(taskWithRelations);
		});
	});

	describe('createTask', () => {
		it('should call create_task with task data', async () => {
			const newTask: Partial<Task> = {
				requirement_ids: ['REQ-001-FUNC-00'],
				title: 'New task implementation',
				priority: 'P2',
				effort: 'S',
				user_story: 'As a developer, I want to implement this feature'
			};
			mockProtocolHandler.mockSuccess({ ...sampleTask, ...newTask });

			const result = await taskService.createTask(newTask);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_task',
				newTask
			);
			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('New task implementation');
		});

		it('should handle creation errors', async () => {
			const invalidTask = { title: '' }; // Missing required fields
			mockProtocolHandler.mockError('Missing required requirement_ids');

			const result = await taskService.createTask(invalidTask);

			expect(result).toEqual({
				success: false,
				error: 'Missing required requirement_ids'
			});
		});

		it('should handle empty task object', async () => {
			mockProtocolHandler.mockSuccess(sampleTask);

			const result = await taskService.createTask({});

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith('create_task', {});
		});

		it('should preserve all provided fields', async () => {
			const fullTask: Partial<Task> = {
				requirement_ids: ['REQ-001-FUNC-00', 'REQ-002-NFUNC-00'],
				title: 'Complex task with multiple requirements',
				status: 'Not Started',
				priority: 'P0',
				effort: 'XL',
				assignee: 'tech.lead@company.com',
				user_story: 'As a system architect, I need to design the solution',
				acceptance_criteria: [
					'Architecture document created',
					'Technical review completed',
					'Implementation plan approved'
				],
				parent_task_id: 'TASK-000-00-00'
			};

			mockProtocolHandler.mockSuccess(fullTask as Task);

			const result = await taskService.createTask(fullTask);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_task',
				fullTask
			);
		});

		it('should handle tasks with GitHub integration', async () => {
			const taskWithGithub: Partial<Task> = {
				requirement_ids: ['REQ-001-FUNC-00'],
				title: 'Task with GitHub issue',
				priority: 'P1',
				github_issue_url: 'https://github.com/company/repo/issues/456'
			};

			mockProtocolHandler.mockSuccess(taskWithGithub as Task);

			const result = await taskService.createTask(taskWithGithub);

			expect(result.success).toBe(true);
			expect(result.data?.github_issue_url).toBe('https://github.com/company/repo/issues/456');
		});
	});

	describe('updateTaskStatus', () => {
		it('should call update_task_status with required parameters', async () => {
			const updatedTask = { ...sampleTask, status: 'In Progress' };
			mockProtocolHandler.mockSuccess(updatedTask);

			const result = await taskService.updateTaskStatus('TASK-001-00-00', 'In Progress');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_task_status',
				{
					task_id: 'TASK-001-00-00',
					new_status: 'In Progress',
					comment: undefined,
					assignee: undefined
				}
			);
			expect(result.success).toBe(true);
			expect(result.data?.status).toBe('In Progress');
		});

		it('should include comment when provided', async () => {
			const updatedTask = { ...sampleTask, status: 'Blocked' };
			mockProtocolHandler.mockSuccess(updatedTask);

			const result = await taskService.updateTaskStatus(
				'TASK-001-00-00',
				'Blocked',
				'Waiting for external API documentation'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_task_status',
				{
					task_id: 'TASK-001-00-00',
					new_status: 'Blocked',
					comment: 'Waiting for external API documentation',
					assignee: undefined
				}
			);
		});

		it('should include assignee when provided', async () => {
			const updatedTask = {
				...sampleTask,
				status: 'In Progress',
				assignee: 'jane.smith@company.com'
			};
			mockProtocolHandler.mockSuccess(updatedTask);

			const result = await taskService.updateTaskStatus(
				'TASK-001-00-00',
				'In Progress',
				'Reassigning to Jane',
				'jane.smith@company.com'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_task_status',
				{
					task_id: 'TASK-001-00-00',
					new_status: 'In Progress',
					comment: 'Reassigning to Jane',
					assignee: 'jane.smith@company.com'
				}
			);
			expect(result.data?.assignee).toBe('jane.smith@company.com');
		});

		it('should handle assignee change without comment', async () => {
			const updatedTask = { ...sampleTask, assignee: 'new.developer@company.com' };
			mockProtocolHandler.mockSuccess(updatedTask);

			const result = await taskService.updateTaskStatus(
				'TASK-001-00-00',
				'Not Started',
				undefined,
				'new.developer@company.com'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_task_status',
				{
					task_id: 'TASK-001-00-00',
					new_status: 'Not Started',
					comment: undefined,
					assignee: 'new.developer@company.com'
				}
			);
		});

		it('should handle invalid status transitions', async () => {
			mockProtocolHandler.mockError('Invalid status transition from Not Started to Complete');

			const result = await taskService.updateTaskStatus('TASK-001-00-00', 'Complete');

			expect(result).toEqual({
				success: false,
				error: 'Invalid status transition from Not Started to Complete'
			});
		});

		it('should handle empty parameters gracefully', async () => {
			const updatedTask = { ...sampleTask, status: 'In Progress' };
			mockProtocolHandler.mockSuccess(updatedTask);

			const result = await taskService.updateTaskStatus('TASK-001-00-00', 'In Progress', '', '');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_task_status',
				{
					task_id: 'TASK-001-00-00',
					new_status: 'In Progress',
					comment: '',
					assignee: ''
				}
			);
		});

		it('should handle status update with workflow validation', async () => {
			// Test different status transitions
			const statusTransitions = [
				{ from: 'Not Started', to: 'In Progress' },
				{ from: 'In Progress', to: 'Blocked' },
				{ from: 'Blocked', to: 'In Progress' },
				{ from: 'In Progress', to: 'Complete' },
				{ from: 'Complete', to: 'Abandoned' }
			];

			for (const transition of statusTransitions) {
				mockProtocolHandler.reset();
				mockProtocolHandler.mockSuccess({
					...sampleTask,
					status: transition.to
				});

				const result = await taskService.updateTaskStatus(
					'TASK-001-00-00',
					transition.to,
					`Updating from ${transition.from} to ${transition.to}`
				);

				expect(result.success).toBe(true);
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle protocol handler network errors', async () => {
			mockProtocolHandler.sendRequestWithResponse.mockRejectedValue(
				new Error('Network connection failed')
			);

			await expect(taskService.getTasks()).rejects.toThrow('Network connection failed');
		});

		it('should handle malformed response data', async () => {
			mockProtocolHandler.mockSuccess(null);

			const result = await taskService.getTasks();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle protocol handler returning undefined', async () => {
			mockProtocolHandler.mockSuccess(undefined);

			const result = await taskService.getTaskDetails('TASK-001');

			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});

		it('should handle server validation errors', async () => {
			mockProtocolHandler.mockError('Validation failed: Invalid priority level');

			const result = await taskService.createTask({
				title: 'Test task',
				priority: 'INVALID' as any
			});

			expect(result).toEqual({
				success: false,
				error: 'Validation failed: Invalid priority level'
			});
		});
	});

	describe('Type Safety', () => {
		it('should preserve TypeScript types in responses', async () => {
			mockProtocolHandler.mockSuccess([sampleTask]);

			const result = await taskService.getTasks();

			if (result.success) {
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.data?.[0]?.status).toBe('Not Started');
				expect(result.data?.[0]?.priority).toBe('P1');
				expect(result.data?.[0]?.effort).toBe('M');
			}
		});

		it('should handle generic MCPResponse properly', async () => {
			mockProtocolHandler.mockError('Test error');

			const result = await taskService.getTasks();

			if (!result.success) {
				expect(typeof result.error).toBe('string');
				expect(result.error).toBe('Test error');
			}
		});

		it('should validate effort size values', async () => {
			const taskWithEffort = {
				...sampleTask,
				effort: 'XS' as const
			};
			mockProtocolHandler.mockSuccess(taskWithEffort);

			const result = await taskService.getTaskDetails('TASK-001-00-00');

			if (result.success) {
				expect(['XS', 'S', 'M', 'L', 'XL']).toContain(result.data?.effort);
			}
		});
	});

	describe('Integration Patterns', () => {
		it('should work with all filter combinations', async () => {
			const complexFilters: TaskFilters = {
				status: 'In Progress',
				priority: 'P0',
				assignee: 'senior.dev@company.com',
				requirement_id: 'REQ-001-FUNC-00'
			};
			mockProtocolHandler.mockSuccess([sampleTask]);

			const result = await taskService.getTasksJson(complexFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_tasks_json',
				complexFilters
			);
			expect(result.success).toBe(true);
		});

		it('should handle concurrent requests', async () => {
			mockProtocolHandler.sendRequestWithResponse
				.mockResolvedValueOnce({ success: true, data: [sampleTask] })
				.mockResolvedValueOnce({ success: true, data: sampleTask })
				.mockResolvedValueOnce({ success: true, data: { ...sampleTask, status: 'Complete' } });

			const [listResult, detailResult, updateResult] = await Promise.all([
				taskService.getTasks(),
				taskService.getTaskDetails('TASK-001-00-00'),
				taskService.updateTaskStatus('TASK-001-00-00', 'Complete')
			]);

			expect(listResult.success).toBe(true);
			expect(detailResult.success).toBe(true);
			expect(updateResult.success).toBe(true);
			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledTimes(3);
		});

		it('should handle bulk operations', async () => {
			const tasks = [
				{ ...sampleTask, id: 'TASK-001-00-00' },
				{ ...sampleTask, id: 'TASK-002-00-00' },
				{ ...sampleTask, id: 'TASK-003-00-00' }
			];

			// Simulate bulk status update
			const updatePromises = tasks.map((task) => {
				mockProtocolHandler.mockSuccess({ ...task, status: 'In Progress' });
				return taskService.updateTaskStatus(task.id, 'In Progress');
			});

			const results = await Promise.all(updatePromises);

			results.forEach((result) => {
				expect(result.success).toBe(true);
			});
		});

		it('should handle task hierarchies', async () => {
			const parentTask = { ...sampleTask, id: 'TASK-PARENT-00-00' };
			const childTasks = [
				{ ...sampleTask, id: 'TASK-CHILD-01-00', parent_task_id: 'TASK-PARENT-00-00' },
				{ ...sampleTask, id: 'TASK-CHILD-02-00', parent_task_id: 'TASK-PARENT-00-00' }
			];

			mockProtocolHandler.sendRequestWithResponse
				.mockResolvedValueOnce({ success: true, data: parentTask })
				.mockResolvedValueOnce({ success: true, data: childTasks });

			const [parentResult, childrenResult] = await Promise.all([
				taskService.getTaskDetails('TASK-PARENT-00-00'),
				taskService.getTasks({ parent_task_id: 'TASK-PARENT-00-00' } as any)
			]);

			expect(parentResult.success).toBe(true);
			expect(childrenResult.success).toBe(true);
		});
	});
});
