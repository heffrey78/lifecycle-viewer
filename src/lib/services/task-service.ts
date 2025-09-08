import type { Task, TaskFilters, MCPResponse } from '$lib/types/lifecycle.js';
import type { ProtocolHandler } from './protocol-handler.js';

export class TaskService {
	constructor(private protocolHandler: ProtocolHandler) {}

	async getTasks(filters?: TaskFilters): Promise<MCPResponse<Task[]>> {
		return this.protocolHandler.sendRequestWithResponse<Task[]>('query_tasks', filters || {});
	}

	async getTasksJson(filters?: TaskFilters): Promise<MCPResponse<Task[]>> {
		return this.protocolHandler.sendRequestWithResponse<Task[]>('query_tasks_json', filters || {});
	}

	async getTaskDetails(id: string): Promise<MCPResponse<Task>> {
		return this.protocolHandler.sendRequestWithResponse<Task>('get_task_details', { task_id: id });
	}

	async createTask(task: Partial<Task>): Promise<MCPResponse<Task>> {
		return this.protocolHandler.sendRequestWithResponse<Task>('create_task', task);
	}

	async updateTaskStatus(
		id: string,
		newStatus: string,
		comment?: string,
		assignee?: string
	): Promise<MCPResponse<Task>> {
		return this.protocolHandler.sendRequestWithResponse<Task>('update_task_status', {
			task_id: id,
			new_status: newStatus,
			comment,
			assignee
		});
	}
}
