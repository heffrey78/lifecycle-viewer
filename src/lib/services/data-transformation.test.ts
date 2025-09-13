import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LifecycleMCPClient } from './mcp-client.js';
import type { Requirement, Task, ArchitectureDecision, MCPResponse } from '$lib/types/lifecycle.js';

describe('LifecycleMCPClient - Data Transformation and Type Safety', () => {
	let client: LifecycleMCPClient;
	let originalWebSocket: any;

	// Mock WebSocket for data transformation testing
	class DataTransformWebSocket {
		static CONNECTING = 0;
		static OPEN = 1;
		static CLOSING = 2;
		static CLOSED = 3;

		public readyState = DataTransformWebSocket.CONNECTING;
		public onopen: ((event: Event) => void) | null = null;
		public onclose: ((event: Event) => void) | null = null;
		public onmessage: ((event: MessageEvent) => void) | null = null;
		public onerror: ((event: Event) => void) | null = null;

		constructor(url: string) {
			// Simulate connection opening
			setTimeout(() => {
				this.readyState = DataTransformWebSocket.OPEN;
				this.onopen?.(new Event('open'));
			}, 1);
		}

		send(data: string) {
			const message = JSON.parse(data);
			// Auto-respond to initialize
			if (message.method === 'initialize') {
				setTimeout(() => {
					this.simulateMessage({
						jsonrpc: '2.0',
						id: message.id,
						result: {
							protocolVersion: '1.0.0',
							capabilities: { tools: {} },
							serverInfo: { name: 'test-server', version: '1.0.0' }
						}
					});
				}, 1);
			}
		}
		
		// Helper method to simulate MCP tool responses
		simulateMCPToolResponse(id: number, data: any) {
			this.simulateMessage({
				jsonrpc: '2.0',
				id,
				result: {
					content: [{
						type: 'text',
						text: JSON.stringify(data)
					}]
				}
			});
		}

		close() {}

		simulateMessage(message: any) {
			const event = new MessageEvent('message', {
				data: JSON.stringify(message)
			});
			this.onmessage?.(event);
		}
	}

	beforeEach(async () => {
		originalWebSocket = global.WebSocket;
		global.WebSocket = DataTransformWebSocket as any;
		client = new LifecycleMCPClient('ws://localhost:3000/test');
		await client.connect();
	});

	afterEach(() => {
		client.disconnect();
		global.WebSocket = originalWebSocket;
	});

	describe('Requirement Data Transformation', () => {
		it('should properly transform valid requirement data', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			// Send well-formed requirement data
			ws.simulateMCPToolResponse(2, [
						{
							id: 'REQ-001-FUNC-00',
							requirement_number: 1,
							type: 'FUNC',
							title: 'User Authentication',
							status: 'Draft',
							priority: 'P1',
							current_state: 'No authentication system',
							desired_state: 'Users can log in securely',
							business_value: 'Secure access control',
							risk_level: 'Medium',
							created_at: '2024-01-01T00:00:00Z',
							updated_at: '2024-01-02T00:00:00Z',
							version: 1,
							author: 'test@example.com',
							functional_requirements: ['Login form', 'Password validation'],
							acceptance_criteria: ['User can log in', 'Invalid credentials rejected'],
							task_count: 3,
							tasks_completed: 1
						}
					]);

			const response = await promise;

			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);

			const requirement = response.data[0] as Requirement;
			expect(requirement.id).toBe('REQ-001-FUNC-00');
			expect(requirement.type).toBe('FUNC');
			expect(requirement.status).toBe('Draft');
			expect(requirement.priority).toBe('P1');
			expect(requirement.functional_requirements).toBeInstanceOf(Array);
			expect(requirement.acceptance_criteria).toBeInstanceOf(Array);
			expect(typeof requirement.task_count).toBe('number');
		});

		it('should handle missing optional fields in requirement data', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			// Send minimal requirement data
			ws.simulateMCPToolResponse(2, [
				{
					id: 'REQ-002',
					title: 'Basic Requirement',
					status: 'Draft',
					priority: 'P2',
					type: 'FUNC'
					// Missing many optional fields
				}
			]);

			const response = await promise;

			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);

			const requirement = response.data[0] as Requirement;
			expect(requirement.id).toBe('REQ-002');
			expect(requirement.title).toBe('Basic Requirement');
			// Should handle undefined fields gracefully
		});

		it('should handle malformed requirement data gracefully', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			// Send malformed data
			ws.simulateMCPToolResponse(2, [
						{
							// Missing required id field
							title: 123, // Wrong type
							status: 'InvalidStatus', // Invalid enum value
							priority: null,
							functional_requirements: 'not an array'
						}
					]);

			const response = await promise;

			// Should still succeed but data might be transformed/sanitized
			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);
		});

		it('should handle array vs single item response formats', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			// Test array format (normal case)
			const arrayPromise = client.getRequirements();
			ws.simulateMCPToolResponse(2, [{ id: 'REQ-1', title: 'Test', status: 'Draft', priority: 'P1', type: 'FUNC' }]);
			const arrayResponse = await arrayPromise;
			expect(Array.isArray(arrayResponse.data)).toBe(true);

			// Test single item format (edge case)
			const singlePromise = client.getRequirements();
			ws.simulateMCPToolResponse(3, { id: 'REQ-2', title: 'Single', status: 'Draft', priority: 'P1', type: 'FUNC' });
			const singleResponse = await singlePromise;
			// Should handle both formats consistently
			expect(singleResponse.success).toBe(true);
		});
	});

	describe('Task Data Transformation', () => {
		it('should properly transform valid task data', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getTasks();

			ws.simulateMCPToolResponse(2, [
				{
					id: 'TASK-001-00-00',
					task_number: 1,
					subtask_number: 0,
					title: 'Implement Login Form',
					status: 'In Progress',
					priority: 'P1',
					effort: 'M',
					user_story: 'As a user, I want to log in',
					assignee: 'dev@example.com',
					requirement_ids: ['REQ-001-FUNC-00'],
					acceptance_criteria: ['Form validates input', 'Submits to backend'],
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-02T00:00:00Z',
					github_issue_number: 123,
					github_issue_url: 'https://github.com/repo/issues/123'
				}
			]);

			const response = await promise;

			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);

			const task = response.data[0] as Task;
			expect(task.id).toBe('TASK-001-00-00');
			expect(task.status).toBe('In Progress');
			expect(task.priority).toBe('P1');
			expect(task.effort).toBe('M');
			expect(task.requirement_ids).toBeInstanceOf(Array);
			expect(task.acceptance_criteria).toBeInstanceOf(Array);
			expect(typeof task.github_issue_number).toBe('number');
		});

		it('should handle task effort size validation', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getTasks();

			// Test all valid effort sizes
			ws.simulateMCPToolResponse(2, [
						{ id: 'T1', title: 'XS Task', effort: 'XS', status: 'Not Started', priority: 'P1' },
						{ id: 'T2', title: 'S Task', effort: 'S', status: 'Not Started', priority: 'P1' },
						{ id: 'T3', title: 'M Task', effort: 'M', status: 'Not Started', priority: 'P1' },
						{ id: 'T4', title: 'L Task', effort: 'L', status: 'Not Started', priority: 'P1' },
						{ id: 'T5', title: 'XL Task', effort: 'XL', status: 'Not Started', priority: 'P1' }
					]);

			const response = await promise;

			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(5);

			const efforts = response.data.map((task: Task) => task.effort);
			expect(efforts).toEqual(['XS', 'S', 'M', 'L', 'XL']);
		});

		it('should handle task status validation', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getTasks();

			// Test all valid statuses
			ws.simulateMCPToolResponse(2, [
						{ id: 'T1', title: 'Task 1', status: 'Not Started', priority: 'P1' },
						{ id: 'T2', title: 'Task 2', status: 'In Progress', priority: 'P1' },
						{ id: 'T3', title: 'Task 3', status: 'Blocked', priority: 'P1' },
						{ id: 'T4', title: 'Task 4', status: 'Complete', priority: 'P1' },
						{ id: 'T5', title: 'Task 5', status: 'Abandoned', priority: 'P1' }
					]);

			const response = await promise;

			expect(response.success).toBe(true);
			const statuses = response.data.map((task: Task) => task.status);
			expect(statuses).toEqual(['Not Started', 'In Progress', 'Blocked', 'Complete', 'Abandoned']);
		});
	});

	describe('Architecture Decision Data Transformation', () => {
		it('should properly transform architecture decision data', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getArchitectureDecisions();

			ws.simulateMCPToolResponse(2, [
				{
					id: 'ADR-001-00-00',
					title: 'Use React for Frontend',
					status: 'Accepted',
					context: 'Need to choose frontend framework',
					decision: 'We will use React',
					consequences: {
						positive: ['Large community', 'Good tooling'],
						negative: ['Learning curve', 'Bundle size']
					},
					considered_options: ['React', 'Vue', 'Angular'],
					decision_drivers: ['Team expertise', 'Ecosystem'],
					requirement_ids: ['REQ-001'],
					authors: ['architect@example.com'],
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-02T00:00:00Z'
				}
			]);

			const response = await promise;

			expect(response.success).toBe(true);
			expect(response.data).toHaveLength(1);

			const adr = response.data[0] as ArchitectureDecision;
			expect(adr.id).toBe('ADR-001-00-00');
			expect(adr.status).toBe('Accepted');
			expect(adr.consequences).toHaveProperty('positive');
			expect(adr.consequences).toHaveProperty('negative');
			expect(adr.considered_options).toBeInstanceOf(Array);
			expect(adr.decision_drivers).toBeInstanceOf(Array);
			expect(adr.authors).toBeInstanceOf(Array);
		});
	});

	describe('Error Response Transformation', () => {
		it('should transform error responses consistently', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				error: {
					code: -32000,
					message: 'Database connection failed',
					data: {
						details: 'Connection timeout after 30 seconds',
						retryable: true
					}
				}
			});

			const response = await promise;

			expect(response.success).toBe(false);
			expect(response.error).toBeDefined();
			expect(typeof response.error).toBe('string');
			expect(response.error).toContain('Database connection failed');
		});

		it('should handle various error formats', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const testCases = [
				// String error
				{ error: 'Simple string error' },
				// Object error
				{ error: { message: 'Object error' } },
				// JSON-RPC error with data
				{ error: { code: -32603, message: 'Internal error', data: { trace: 'stack trace' } } },
				// Minimal error
				{ error: { code: -32000 } }
			];

			for (let i = 0; i < testCases.length; i++) {
				const promise = client.getRequirements();

				ws.simulateMessage({
					jsonrpc: '2.0',
					id: 2 + i,
					...testCases[i]
				});

				const response = await promise;
				expect(response.success).toBe(false);
				expect(response.error).toBeDefined();
				expect(typeof response.error).toBe('string');
			}
		});
	});

	describe('Data Type Coercion and Validation', () => {
		it('should handle string to number coercion where appropriate', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			ws.simulateMCPToolResponse(2, [
				{
					id: 'REQ-001',
					title: 'Test',
					status: 'Draft',
					priority: 'P1',
					type: 'FUNC',
					task_count: '5', // String instead of number
					tasks_completed: '2', // String instead of number
					requirement_number: '1' // String instead of number
				}
			]);

			const response = await promise;
			expect(response.success).toBe(true);

			// Numbers should be handled properly regardless of string/number input
			const req = response.data[0];
			expect(req.task_count).toBeDefined();
			expect(req.tasks_completed).toBeDefined();
		});

		it('should handle date string validation', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getTasks();

			ws.simulateMCPToolResponse(2, [
				{
					id: 'TASK-001',
					title: 'Test Task',
					status: 'Complete',
					priority: 'P1',
					created_at: '2024-01-01T00:00:00Z', // Valid ISO date
					updated_at: 'invalid-date', // Invalid date
					completed_at: '2024-01-02T10:30:00Z' // Valid ISO date
				}
			]);

			const response = await promise;
			expect(response.success).toBe(true);

			const task = response.data[0];
			expect(task.created_at).toBeDefined();
			expect(task.updated_at).toBeDefined(); // Should handle invalid date gracefully
			expect(task.completed_at).toBeDefined();
		});

		it('should handle array field validation', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			ws.simulateMCPToolResponse(2, [
				{
					id: 'REQ-001',
					title: 'Test',
					status: 'Draft',
					priority: 'P1',
					type: 'FUNC',
					functional_requirements: 'single string instead of array',
					acceptance_criteria: ['valid', 'array'],
					nonfunctional_requirements: null // null instead of array
				}
			]);

			const response = await promise;
			expect(response.success).toBe(true);

			const req = response.data[0];
			// Should handle various array field formats gracefully
			expect(req).toBeDefined();
		});
	});

	describe('MCPResponse Wrapper Validation', () => {
		it('should ensure MCPResponse structure is consistent', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			ws.simulateMCPToolResponse(2, [{ id: 'REQ-1', title: 'Test', status: 'Draft', priority: 'P1', type: 'FUNC' }]);

			const response: MCPResponse<Requirement[]> = await promise;

			// Validate MCPResponse structure
			expect(response).toHaveProperty('success');
			expect(typeof response.success).toBe('boolean');
			expect(response.success).toBe(true);
			expect(response).toHaveProperty('data');
			expect(response.data).toBeInstanceOf(Array);
			expect(response).not.toHaveProperty('error'); // Should not have error when successful
		});

		it('should validate MCPResponse error structure', async () => {
			const ws = (client as any).ws as DataTransformWebSocket;

			const promise = client.getRequirements();

			ws.simulateMessage({
				jsonrpc: '2.0',
				id: 2,
				error: {
					code: -32000,
					message: 'Test error'
				}
			});

			const response: MCPResponse<Requirement[]> = await promise;

			// Validate error MCPResponse structure
			expect(response).toHaveProperty('success');
			expect(response.success).toBe(false);
			expect(response).toHaveProperty('error');
			expect(typeof response.error).toBe('string');
			expect(response).not.toHaveProperty('data'); // Should not have data when error
		});
	});
});
