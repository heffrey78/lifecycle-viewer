// MCP Protocol Mocking Utilities
// Provides comprehensive JSON-RPC 2.0 protocol mocking for MCP testing

import {
	REQUIREMENT_FIXTURES,
	TASK_FIXTURES,
	ARCHITECTURE_FIXTURES,
	PROJECT_METRICS_FIXTURE
} from './test-fixtures.js';
import type {
	Requirement,
	Task,
	ArchitectureDecision,
	ProjectMetrics,
	MCPResponse
} from '../types/lifecycle.js';

// JSON-RPC 2.0 message interfaces
export interface JSONRPCRequest {
	jsonrpc: '2.0';
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
	jsonrpc: '2.0';
	id?: string | number;
	result?: unknown;
	error?: JSONRPCError;
}

export interface JSONRPCError {
	code: number;
	message: string;
	data?: unknown;
}

export interface JSONRPCNotification {
	jsonrpc: '2.0';
	method: string;
	params?: Record<string, unknown>;
}

// MCP tool response structure
export interface MCPToolResponse {
	content: Array<{
		type: 'text';
		text: string;
	}>;
}

// Common JSON-RPC error codes
export const JSONRPC_ERRORS = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	// MCP specific errors
	RESOURCE_NOT_FOUND: -32001,
	INVALID_RESOURCE: -32002,
	UNAUTHORIZED: -32003
} as const;

export class MCPProtocolMock {
	private messageId = 0;
	private delay = { min: 10, max: 100 }; // Response delay range in ms
	private errorRate = 0; // 0-1 probability of returning errors
	private enableLogging = false;

	// Configuration methods
	setResponseDelay(min: number, max: number): void {
		this.delay = { min, max };
	}

	setErrorRate(rate: number): void {
		this.errorRate = Math.max(0, Math.min(1, rate));
	}

	enableProtocolLogging(enable: boolean = true): void {
		this.enableLogging = enable;
	}

	// Core protocol methods
	createInitializeResponse(request: JSONRPCRequest): JSONRPCResponse {
		this.logProtocol('INIT', request);

		return {
			jsonrpc: '2.0',
			id: request.id,
			result: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {},
					resources: {},
					prompts: {}
				},
				serverInfo: {
					name: 'lifecycle-mcp-mock',
					version: '1.0.0'
				}
			}
		};
	}

	createInitializedNotification(): JSONRPCNotification {
		return {
			jsonrpc: '2.0',
			method: 'notifications/initialized'
		};
	}

	createToolCallResponse(request: JSONRPCRequest): JSONRPCResponse {
		const params = request.params as { name?: string; arguments?: Record<string, unknown> };
		const toolName = params?.name;
		const args = params?.arguments || {};

		this.logProtocol('TOOL', { name: toolName, args });

		// Check for simulated errors
		if (Math.random() < this.errorRate) {
			return this.createErrorResponse(
				request.id,
				JSONRPC_ERRORS.INTERNAL_ERROR,
				'Simulated server error'
			);
		}

		// Route to appropriate tool handler
		let result: MCPToolResponse;

		try {
			switch (toolName) {
				case 'query_requirements':
				case 'query_requirements_json':
					result = this.handleQueryRequirements(args);
					break;
				case 'get_requirement_details':
					result = this.handleGetRequirementDetails(args);
					break;
				case 'create_requirement':
					result = this.handleCreateRequirement(args);
					break;
				case 'update_requirement_status':
					result = this.handleUpdateRequirementStatus(args);
					break;
				case 'query_tasks':
				case 'query_tasks_json':
					result = this.handleQueryTasks(args);
					break;
				case 'get_task_details':
					result = this.handleGetTaskDetails(args);
					break;
				case 'create_task':
					result = this.handleCreateTask(args);
					break;
				case 'update_task_status':
					result = this.handleUpdateTaskStatus(args);
					break;
				case 'query_architecture_decisions':
				case 'query_architecture_decisions_json':
					result = this.handleQueryArchitecture(args);
					break;
				case 'get_architecture_details':
					result = this.handleGetArchitectureDetails(args);
					break;
				case 'get_project_status':
				case 'get_project_metrics':
					result = this.handleGetProjectMetrics(args);
					break;
				default:
					return this.createErrorResponse(
						request.id,
						JSONRPC_ERRORS.METHOD_NOT_FOUND,
						`Tool '${toolName}' not found`
					);
			}

			return {
				jsonrpc: '2.0',
				id: request.id,
				result
			};
		} catch (error) {
			return this.createErrorResponse(
				request.id,
				JSONRPC_ERRORS.INTERNAL_ERROR,
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	}

	createErrorResponse(
		id: string | number | undefined,
		code: number,
		message: string,
		data?: unknown
	): JSONRPCResponse {
		return {
			jsonrpc: '2.0',
			id,
			error: {
				code,
				message,
				data
			}
		};
	}

	// Tool handlers
	private handleQueryRequirements(args: Record<string, unknown>): MCPToolResponse {
		const filters = args;
		let requirements = [
			REQUIREMENT_FIXTURES.draft(),
			REQUIREMENT_FIXTURES.approved(),
			REQUIREMENT_FIXTURES.implemented(),
			REQUIREMENT_FIXTURES.complex()
		];

		// Apply basic filtering
		if (filters.status) {
			const statusFilter = Array.isArray(filters.status) ? filters.status : [filters.status];
			requirements = requirements.filter((req) => statusFilter.includes(req.status));
		}

		if (filters.priority) {
			const priorityFilter = Array.isArray(filters.priority)
				? filters.priority
				: [filters.priority];
			requirements = requirements.filter((req) => priorityFilter.includes(req.priority));
		}

		if (filters.search_text) {
			const searchText = String(filters.search_text).toLowerCase();
			requirements = requirements.filter(
				(req) =>
					req.title.toLowerCase().includes(searchText) ||
					req.current_state?.toLowerCase().includes(searchText) ||
					req.desired_state?.toLowerCase().includes(searchText)
			);
		}

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(requirements)
				}
			]
		};
	}

	private handleGetRequirementDetails(args: Record<string, unknown>): MCPToolResponse {
		const requirementId = args.requirement_id as string;

		if (!requirementId) {
			throw new Error('requirement_id is required');
		}

		const requirement = REQUIREMENT_FIXTURES.complex();
		requirement.id = requirementId;

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(requirement)
				}
			]
		};
	}

	private handleCreateRequirement(args: Record<string, unknown>): MCPToolResponse {
		const newRequirement = {
			...REQUIREMENT_FIXTURES.draft(),
			...args,
			id: `REQ-${String(Date.now()).slice(-4)}-FUNC-00`,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(newRequirement)
				}
			]
		};
	}

	private handleUpdateRequirementStatus(args: Record<string, unknown>): MCPToolResponse {
		const { requirement_id, new_status, comment } = args;

		if (!requirement_id || !new_status) {
			throw new Error('requirement_id and new_status are required');
		}

		const updatedRequirement = {
			...REQUIREMENT_FIXTURES.approved(),
			id: requirement_id as string,
			status: new_status,
			updated_at: new Date().toISOString()
		};

		if (comment) {
			// In real implementation, this would add to review/comment system
		}

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(updatedRequirement)
				}
			]
		};
	}

	private handleQueryTasks(args: Record<string, unknown>): MCPToolResponse {
		const filters = args;
		let tasks = [
			TASK_FIXTURES.notStarted(),
			TASK_FIXTURES.inProgress(),
			TASK_FIXTURES.complete(),
			TASK_FIXTURES.blocked()
		];

		// Apply filtering
		if (filters.status) {
			const statusFilter = Array.isArray(filters.status) ? filters.status : [filters.status];
			tasks = tasks.filter((task) => statusFilter.includes(task.status));
		}

		if (filters.assignee) {
			const assigneeFilter = Array.isArray(filters.assignee)
				? filters.assignee
				: [filters.assignee];
			tasks = tasks.filter((task) => task.assignee && assigneeFilter.includes(task.assignee));
		}

		if (filters.requirement_id) {
			// In real implementation, would filter by requirement relationship
		}

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(tasks)
				}
			]
		};
	}

	private handleGetTaskDetails(args: Record<string, unknown>): MCPToolResponse {
		const taskId = args.task_id as string;

		if (!taskId) {
			throw new Error('task_id is required');
		}

		const task = TASK_FIXTURES.inProgress();
		task.id = taskId;

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(task)
				}
			]
		};
	}

	private handleCreateTask(args: Record<string, unknown>): MCPToolResponse {
		const newTask = {
			...TASK_FIXTURES.notStarted(),
			...args,
			id: `TASK-${String(Date.now()).slice(-4)}-00-00`,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(newTask)
				}
			]
		};
	}

	private handleUpdateTaskStatus(args: Record<string, unknown>): MCPToolResponse {
		const { task_id, new_status, comment, assignee } = args;

		if (!task_id || !new_status) {
			throw new Error('task_id and new_status are required');
		}

		const updatedTask = {
			...TASK_FIXTURES.inProgress(),
			id: task_id as string,
			status: new_status,
			assignee: assignee || undefined,
			updated_at: new Date().toISOString()
		};

		if (new_status === 'Complete') {
			updatedTask.completed_at = new Date().toISOString();
		}

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(updatedTask)
				}
			]
		};
	}

	private handleQueryArchitecture(args: Record<string, unknown>): MCPToolResponse {
		const filters = args;
		let decisions = [
			ARCHITECTURE_FIXTURES.proposed(),
			ARCHITECTURE_FIXTURES.accepted(),
			ARCHITECTURE_FIXTURES.tdd()
		];

		// Apply filtering
		if (filters.status) {
			const statusFilter = Array.isArray(filters.status) ? filters.status : [filters.status];
			decisions = decisions.filter((decision) => statusFilter.includes(decision.status));
		}

		if (filters.type) {
			const typeFilter = Array.isArray(filters.type) ? filters.type : [filters.type];
			decisions = decisions.filter((decision) => typeFilter.includes(decision.type));
		}

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(decisions)
				}
			]
		};
	}

	private handleGetArchitectureDetails(args: Record<string, unknown>): MCPToolResponse {
		const architectureId = args.architecture_id as string;

		if (!architectureId) {
			throw new Error('architecture_id is required');
		}

		const decision = ARCHITECTURE_FIXTURES.tdd();
		decision.id = architectureId;

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(decision)
				}
			]
		};
	}

	private handleGetProjectMetrics(args: Record<string, unknown>): MCPToolResponse {
		const metrics = PROJECT_METRICS_FIXTURE();

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(metrics)
				}
			]
		};
	}

	// Utility methods
	async simulateNetworkDelay(): Promise<void> {
		const delay = Math.random() * (this.delay.max - this.delay.min) + this.delay.min;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	generateMessageId(): number {
		return ++this.messageId;
	}

	private logProtocol(type: string, data: unknown): void {
		if (this.enableLogging) {
			const timestamp = new Date().toISOString();
			console.log(`[MCPProtocolMock ${timestamp}] ${type}:`, data);
		}
	}
}

// Pre-configured mock instances
export const createMCPMock = (config?: {
	responseDelay?: { min: number; max: number };
	errorRate?: number;
	logging?: boolean;
}): MCPProtocolMock => {
	const mock = new MCPProtocolMock();

	if (config?.responseDelay) {
		mock.setResponseDelay(config.responseDelay.min, config.responseDelay.max);
	}

	if (config?.errorRate !== undefined) {
		mock.setErrorRate(config.errorRate);
	}

	if (config?.logging) {
		mock.enableProtocolLogging(config.logging);
	}

	return mock;
};

// Common mock scenarios
export const MOCK_SCENARIOS = {
	perfect: () =>
		createMCPMock({
			responseDelay: { min: 0, max: 10 },
			errorRate: 0,
			logging: false
		}),

	realistic: () =>
		createMCPMock({
			responseDelay: { min: 50, max: 200 },
			errorRate: 0.01,
			logging: false
		}),

	slow: () =>
		createMCPMock({
			responseDelay: { min: 500, max: 2000 },
			errorRate: 0.05,
			logging: true
		}),

	unreliable: () =>
		createMCPMock({
			responseDelay: { min: 100, max: 1000 },
			errorRate: 0.2,
			logging: true
		})
};
