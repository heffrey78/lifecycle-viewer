import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from './project-service.js';
import type { ProtocolHandler } from './protocol-handler.js';
import type { ProjectMetrics, MCPResponse } from '$lib/types/lifecycle.js';

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

describe('ProjectService', () => {
	let projectService: ProjectService;
	let mockProtocolHandler: MockProtocolHandler;

	const sampleProjectMetrics: ProjectMetrics = {
		requirements: {
			total: 25,
			by_status: {
				Draft: 5,
				'Under Review': 3,
				Approved: 8,
				Architecture: 2,
				Ready: 4,
				Implemented: 2,
				Validated: 1,
				Deprecated: 0
			},
			by_priority: {
				P0: 5,
				P1: 10,
				P2: 8,
				P3: 2
			},
			by_type: {
				FUNC: 15,
				NFUNC: 5,
				TECH: 3,
				BUS: 2,
				INTF: 0
			}
		},
		tasks: {
			total: 45,
			by_status: {
				'Not Started': 15,
				'In Progress': 12,
				Blocked: 3,
				Complete: 13,
				Abandoned: 2
			},
			by_priority: {
				P0: 8,
				P1: 20,
				P2: 15,
				P3: 2
			},
			by_assignee: {
				'john.doe@company.com': 12,
				'jane.smith@company.com': 10,
				'tech.lead@company.com': 8,
				unassigned: 15
			}
		},
		architecture_decisions: {
			total: 12,
			by_status: {
				Proposed: 4,
				Accepted: 6,
				Rejected: 1,
				Deprecated: 0,
				Superseded: 1,
				Draft: 0,
				'Under Review': 0,
				Approved: 0,
				Implemented: 0
			}
		}
	};

	beforeEach(() => {
		mockProtocolHandler = new MockProtocolHandler();
		projectService = new ProjectService(mockProtocolHandler as any as ProtocolHandler);
	});

	describe('getProjectStatus', () => {
		it('should call get_project_status and return metrics', async () => {
			mockProtocolHandler.mockSuccess(sampleProjectMetrics);

			const result = await projectService.getProjectStatus();

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'get_project_status',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: sampleProjectMetrics
			});
		});

		it('should handle empty project metrics', async () => {
			const emptyMetrics: ProjectMetrics = {
				requirements: {
					total: 0,
					by_status: {},
					by_priority: {},
					by_type: {}
				},
				tasks: {
					total: 0,
					by_status: {},
					by_priority: {},
					by_assignee: {}
				},
				architecture_decisions: {
					total: 0,
					by_status: {}
				}
			};
			mockProtocolHandler.mockSuccess(emptyMetrics);

			const result = await projectService.getProjectStatus();

			expect(result).toEqual({
				success: true,
				data: emptyMetrics
			});
		});

		it('should propagate errors from protocol handler', async () => {
			mockProtocolHandler.mockError('Failed to retrieve project status');

			const result = await projectService.getProjectStatus();

			expect(result).toEqual({
				success: false,
				error: 'Failed to retrieve project status'
			});
		});

		it('should handle protocol handler exceptions', async () => {
			mockProtocolHandler.mockReject(new Error('Database connection failed'));

			await expect(projectService.getProjectStatus())
				.rejects.toThrow('Database connection failed');
		});
	});

	describe('getProjectMetrics', () => {
		it('should call get_project_metrics and return detailed metrics', async () => {
			mockProtocolHandler.mockSuccess(sampleProjectMetrics);

			const result = await projectService.getProjectMetrics();

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'get_project_metrics',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: sampleProjectMetrics
			});
		});

		it('should handle metrics with additional fields', async () => {
			const extendedMetrics = {
				...sampleProjectMetrics,
				project_health: {
					score: 85,
					trend: 'improving',
					blockers: 3,
					risks: 2
				},
				velocity: {
					tasks_completed_last_sprint: 12,
					average_completion_time: 4.5,
					burndown_rate: 0.8
				}
			};
			mockProtocolHandler.mockSuccess(extendedMetrics);

			const result = await projectService.getProjectMetrics();

			expect(result.success).toBe(true);
			expect(result.data).toEqual(extendedMetrics);
		});

		it('should handle malformed metrics gracefully', async () => {
			mockProtocolHandler.mockSuccess(null);

			const result = await projectService.getProjectMetrics();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});
	});

	describe('startRequirementInterview', () => {
		it('should call start_requirement_interview with context and role', async () => {
			const interviewResponse = {
				session_id: 'interview-123',
				questions: {
					business_goal: 'What is the main business goal for this requirement?',
					user_story: 'Can you describe this as a user story?',
					acceptance_criteria: 'What are the key acceptance criteria?',
					constraints: 'Are there any technical or business constraints?'
				}
			};
			mockProtocolHandler.mockSuccess(interviewResponse);

			const result = await projectService.startRequirementInterview(
				'E-commerce platform development',
				'Product Manager'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'start_requirement_interview',
				{
					project_context: 'E-commerce platform development',
					stakeholder_role: 'Product Manager'
				}
			);
			expect(result).toEqual({
				success: true,
				data: interviewResponse
			});
		});

		it('should handle interview without context or role', async () => {
			const interviewResponse = {
				session_id: 'interview-456',
				questions: {
					requirement_type: 'What type of requirement is this?',
					description: 'Please describe the requirement in detail'
				}
			};
			mockProtocolHandler.mockSuccess(interviewResponse);

			const result = await projectService.startRequirementInterview();

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'start_requirement_interview',
				{
					project_context: undefined,
					stakeholder_role: undefined
				}
			);
		});

		it('should handle interview initialization errors', async () => {
			mockProtocolHandler.mockError('Failed to initialize interview session');

			const result = await projectService.startRequirementInterview(
				'Mobile app project',
				'Business Analyst'
			);

			expect(result).toEqual({
				success: false,
				error: 'Failed to initialize interview session'
			});
		});

		it('should handle empty strings for context and role', async () => {
			const interviewResponse = {
				session_id: 'interview-789',
				questions: {
					basic_info: 'Please provide basic requirement information'
				}
			};
			mockProtocolHandler.mockSuccess(interviewResponse);

			const result = await projectService.startRequirementInterview('', '');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'start_requirement_interview',
				{
					project_context: '',
					stakeholder_role: ''
				}
			);
		});
	});

	describe('continueRequirementInterview', () => {
		it('should call continue_requirement_interview with session and answers', async () => {
			const answers = {
				business_goal: 'Increase user engagement by 30%',
				user_story: 'As a user, I want to receive personalized recommendations',
				acceptance_criteria: 'Recommendations are accurate and relevant',
				constraints: 'Must integrate with existing user analytics system'
			};

			const continueResponse = {
				session_id: 'interview-123',
				next_questions: {
					technical_details: 'What are the technical implementation details?',
					timeline: 'What is the expected timeline for this requirement?'
				},
				progress: {
					completed: 4,
					total: 8,
					percentage: 50
				}
			};
			mockProtocolHandler.mockSuccess(continueResponse);

			const result = await projectService.continueRequirementInterview(
				'interview-123',
				answers
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'continue_requirement_interview',
				{
					session_id: 'interview-123',
					answers
				}
			);
			expect(result).toEqual({
				success: true,
				data: continueResponse
			});
		});

		it('should handle incomplete answers', async () => {
			const partialAnswers = {
				business_goal: 'Improve system performance',
				user_story: ''  // Empty answer
			};

			const continueResponse = {
				session_id: 'interview-456',
				validation_errors: {
					user_story: 'User story is required'
				}
			};
			mockProtocolHandler.mockSuccess(continueResponse);

			const result = await projectService.continueRequirementInterview(
				'interview-456',
				partialAnswers
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(continueResponse);
		});

		it('should handle invalid session ID', async () => {
			mockProtocolHandler.mockError('Interview session not found or expired');

			const result = await projectService.continueRequirementInterview(
				'invalid-session',
				{ answer1: 'response' }
			);

			expect(result).toEqual({
				success: false,
				error: 'Interview session not found or expired'
			});
		});

		it('should handle empty answers object', async () => {
			mockProtocolHandler.mockSuccess({ session_id: 'interview-789' });

			const result = await projectService.continueRequirementInterview(
				'interview-789',
				{}
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'continue_requirement_interview',
				{
					session_id: 'interview-789',
					answers: {}
				}
			);
		});

		it('should handle completed interview', async () => {
			const answers = {
				final_question: 'All requirements have been captured'
			};

			const completionResponse = {
				session_id: 'interview-123',
				status: 'completed',
				generated_requirement: {
					type: 'FUNC',
					title: 'Personalized Recommendations System',
					priority: 'P1',
					business_value: 'Increase user engagement by 30%'
				}
			};
			mockProtocolHandler.mockSuccess(completionResponse);

			const result = await projectService.continueRequirementInterview(
				'interview-123',
				answers
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(completionResponse);
		});
	});

	describe('exportProjectDocumentation', () => {
		it('should call export_project_documentation with options', async () => {
			const exportOptions = {
				project_name: 'E-commerce Platform',
				include_requirements: true,
				include_tasks: true,
				include_architecture: false,
				output_directory: '/exports/docs'
			};

			const exportResponse = [
				'/exports/docs/requirements_summary.md',
				'/exports/docs/task_breakdown.md',
				'/exports/docs/project_overview.md'
			];
			mockProtocolHandler.mockSuccess(exportResponse);

			const result = await projectService.exportProjectDocumentation(exportOptions);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'export_project_documentation',
				exportOptions
			);
			expect(result).toEqual({
				success: true,
				data: exportResponse
			});
		});

		it('should handle export with default options', async () => {
			const exportResponse = [
				'/default/project_documentation.md'
			];
			mockProtocolHandler.mockSuccess(exportResponse);

			const result = await projectService.exportProjectDocumentation({});

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'export_project_documentation',
				{}
			);
		});

		it('should handle export errors', async () => {
			mockProtocolHandler.mockError('Failed to write to output directory');

			const result = await projectService.exportProjectDocumentation({
				output_directory: '/readonly/directory'
			});

			expect(result).toEqual({
				success: false,
				error: 'Failed to write to output directory'
			});
		});

		it('should handle comprehensive export options', async () => {
			const comprehensiveOptions = {
				project_name: 'Full Project Export',
				include_requirements: true,
				include_tasks: true,
				include_architecture: true,
				output_directory: '/exports/comprehensive'
			};

			const comprehensiveResponse = [
				'/exports/comprehensive/requirements_detailed.md',
				'/exports/comprehensive/tasks_with_progress.md',
				'/exports/comprehensive/architecture_decisions.md',
				'/exports/comprehensive/project_metrics.md',
				'/exports/comprehensive/traceability_matrix.md'
			];
			mockProtocolHandler.mockSuccess(comprehensiveResponse);

			const result = await projectService.exportProjectDocumentation(comprehensiveOptions);

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(5);
		});
	});

	describe('createArchitecturalDiagrams', () => {
		it('should call create_architectural_diagrams with options', async () => {
			const diagramOptions = {
				diagram_type: 'requirements',
				requirement_ids: ['REQ-001-FUNC-00', 'REQ-002-TECH-00'],
				include_relationships: true,
				output_format: 'mermaid'
			};

			const diagramResponse = `
				graph TD
					REQ001[REQ-001-FUNC-00: User Authentication]
					REQ002[REQ-002-TECH-00: Database Selection]
					TASK001[TASK-001: Implement Login]
					
					REQ001 --> TASK001
					REQ002 --> TASK001
			`;
			mockProtocolHandler.mockSuccess(diagramResponse.trim());

			const result = await projectService.createArchitecturalDiagrams(diagramOptions);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_architectural_diagrams',
				diagramOptions
			);
			expect(result).toEqual({
				success: true,
				data: diagramResponse.trim()
			});
		});

		it('should handle different diagram types', async () => {
			const diagramTypes = ['requirements', 'tasks', 'architecture', 'full_project'];

			for (const diagramType of diagramTypes) {
				mockProtocolHandler.reset();
				mockProtocolHandler.mockSuccess(`${diagramType} diagram content`);

				const result = await projectService.createArchitecturalDiagrams({
					diagram_type: diagramType
				});

				expect(result.success).toBe(true);
				expect(result.data).toBe(`${diagramType} diagram content`);
			}
		});

		it('should handle diagram generation errors', async () => {
			mockProtocolHandler.mockError('Failed to generate diagram: Invalid requirement IDs');

			const result = await projectService.createArchitecturalDiagrams({
				diagram_type: 'requirements',
				requirement_ids: ['INVALID-REQ']
			});

			expect(result).toEqual({
				success: false,
				error: 'Failed to generate diagram: Invalid requirement IDs'
			});
		});

		it('should handle complex diagram with all options', async () => {
			const complexOptions = {
				diagram_type: 'full_project',
				requirement_ids: [
					'REQ-001-FUNC-00',
					'REQ-002-NFUNC-00',
					'REQ-003-TECH-00'
				],
				include_relationships: true,
				output_format: 'markdown_with_mermaid'
			};

			const complexDiagram = `
# Project Architecture Diagram

\`\`\`mermaid
graph LR
    REQ001[User Authentication]
    REQ002[Performance Requirements]
    REQ003[Technology Stack]
    
    TASK001[Implement Auth]
    TASK002[Optimize Performance]
    
    ADR001[JWT Decision]
    ADR002[Database Choice]
    
    REQ001 --> TASK001
    REQ002 --> TASK002
    REQ001 --> ADR001
    REQ003 --> ADR002
\`\`\`
			`;
			mockProtocolHandler.mockSuccess(complexDiagram.trim());

			const result = await projectService.createArchitecturalDiagrams(complexOptions);

			expect(result.success).toBe(true);
			expect(result.data).toContain('mermaid');
			expect(result.data).toContain('graph LR');
		});

		it('should handle empty options', async () => {
			const defaultDiagram = 'basic project diagram';
			mockProtocolHandler.mockSuccess(defaultDiagram);

			const result = await projectService.createArchitecturalDiagrams({});

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_architectural_diagrams',
				{}
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle protocol handler network errors', async () => {
			mockProtocolHandler.sendRequestWithResponse.mockRejectedValue(
				new Error('Network connection failed')
			);

			await expect(projectService.getProjectStatus())
				.rejects.toThrow('Network connection failed');
		});

		it('should handle malformed response data', async () => {
			mockProtocolHandler.mockSuccess(null);

			const result = await projectService.getProjectMetrics();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle interview session timeouts', async () => {
			mockProtocolHandler.mockError('Interview session expired');

			const result = await projectService.continueRequirementInterview(
				'expired-session',
				{ answer: 'test' }
			);

			expect(result).toEqual({
				success: false,
				error: 'Interview session expired'
			});
		});

		it('should handle export permission errors', async () => {
			mockProtocolHandler.mockError('Permission denied: Cannot write to directory');

			const result = await projectService.exportProjectDocumentation({
				output_directory: '/protected/directory'
			});

			expect(result).toEqual({
				success: false,
				error: 'Permission denied: Cannot write to directory'
			});
		});
	});

	describe('Type Safety', () => {
		it('should preserve TypeScript types in metrics responses', async () => {
			mockProtocolHandler.mockSuccess(sampleProjectMetrics);

			const result = await projectService.getProjectMetrics();

			if (result.success) {
				expect(typeof result.data?.requirements.total).toBe('number');
				expect(typeof result.data?.requirements.by_status).toBe('object');
				expect(typeof result.data?.tasks.total).toBe('number');
			}
		});

		it('should handle interview response types', async () => {
			const interviewResponse = {
				session_id: 'test-session',
				questions: {
					question1: 'What is your goal?',
					question2: 'What are the constraints?'
				}
			};
			mockProtocolHandler.mockSuccess(interviewResponse);

			const result = await projectService.startRequirementInterview();

			if (result.success) {
				expect(typeof result.data?.session_id).toBe('string');
				expect(typeof result.data?.questions).toBe('object');
			}
		});

		it('should validate export response format', async () => {
			const exportResponse = [
				'/path/to/file1.md',
				'/path/to/file2.md'
			];
			mockProtocolHandler.mockSuccess(exportResponse);

			const result = await projectService.exportProjectDocumentation({});

			if (result.success) {
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.data?.every(path => typeof path === 'string')).toBe(true);
			}
		});
	});

	describe('Integration Patterns', () => {
		it('should handle concurrent operations', async () => {
			mockProtocolHandler.sendRequestWithResponse
				.mockResolvedValueOnce({ success: true, data: sampleProjectMetrics })
				.mockResolvedValueOnce({ success: true, data: { session_id: 'test', questions: {} } })
				.mockResolvedValueOnce({ success: true, data: ['exported_file.md'] });

			const [metricsResult, interviewResult, exportResult] = await Promise.all([
				projectService.getProjectMetrics(),
				projectService.startRequirementInterview('Test project', 'PM'),
				projectService.exportProjectDocumentation({ project_name: 'Test' })
			]);

			expect(metricsResult.success).toBe(true);
			expect(interviewResult.success).toBe(true);
			expect(exportResult.success).toBe(true);
			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledTimes(3);
		});

		it('should handle complete interview workflow', async () => {
			// Start interview
			const startResponse = {
				session_id: 'workflow-test',
				questions: { q1: 'First question?' }
			};
			mockProtocolHandler.mockSuccess(startResponse);

			const startResult = await projectService.startRequirementInterview(
				'Workflow test',
				'Analyst'
			);
			expect(startResult.success).toBe(true);

			// Continue interview
			mockProtocolHandler.reset();
			const continueResponse = {
				session_id: 'workflow-test',
				next_questions: { q2: 'Second question?' }
			};
			mockProtocolHandler.mockSuccess(continueResponse);

			const continueResult = await projectService.continueRequirementInterview(
				'workflow-test',
				{ q1: 'First answer' }
			);
			expect(continueResult.success).toBe(true);
		});

		it('should handle project documentation pipeline', async () => {
			// Get metrics first
			mockProtocolHandler.mockSuccess(sampleProjectMetrics);
			const metricsResult = await projectService.getProjectMetrics();

			// Export based on metrics
			mockProtocolHandler.reset();
			const exportFiles = [
				'/exports/requirements.md',
				'/exports/tasks.md',
				'/exports/metrics.md'
			];
			mockProtocolHandler.mockSuccess(exportFiles);

			const exportResult = await projectService.exportProjectDocumentation({
				project_name: 'Data-Driven Export',
				include_requirements: metricsResult.data!.requirements.total > 0,
				include_tasks: metricsResult.data!.tasks.total > 0
			});

			expect(exportResult.success).toBe(true);
			expect(exportResult.data).toHaveLength(3);
		});
	});
});