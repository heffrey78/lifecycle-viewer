import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArchitectureService } from './architecture-service.js';
import type { ProtocolHandler } from './protocol-handler.js';
import type {
	ArchitectureDecision,
	ArchitectureFilters,
	MCPResponse
} from '$lib/types/lifecycle.js';

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

describe('ArchitectureService', () => {
	let architectureService: ArchitectureService;
	let mockProtocolHandler: MockProtocolHandler;

	const sampleArchitectureDecision: ArchitectureDecision = {
		id: 'ADR-001-00-00',
		requirement_ids: ['REQ-001-FUNC-00', 'REQ-002-TECH-00'],
		title: 'Use JWT for Authentication',
		status: 'Proposed',
		context: 'We need to implement stateless authentication for our API',
		decision: 'Implement JWT-based authentication with refresh tokens',
		consequences: {
			positive: ['Stateless authentication', 'Scalable across multiple services'],
			negative: [
				'Token management complexity',
				'Potential security risks if not implemented properly'
			]
		},
		decision_drivers: ['Security requirements', 'Scalability needs', 'Development team expertise'],
		considered_options: ['Session-based auth', 'OAuth 2.0', 'JWT tokens'],
		authors: ['Tech Lead', 'Security Architect'],
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-02T00:00:00Z'
	};

	const sampleFilters: ArchitectureFilters = {
		search_text: 'authentication',
		status: 'Proposed',
		requirement_id: 'REQ-001-FUNC-00'
	};

	beforeEach(() => {
		mockProtocolHandler = new MockProtocolHandler();
		architectureService = new ArchitectureService(mockProtocolHandler as any as ProtocolHandler);
	});

	describe('getArchitectureDecisions', () => {
		it('should call query_architecture_decisions with filters', async () => {
			const expectedData = [sampleArchitectureDecision];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await architectureService.getArchitectureDecisions(sampleFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions',
				sampleFilters
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should call query_architecture_decisions with empty filters when none provided', async () => {
			const expectedData = [sampleArchitectureDecision];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await architectureService.getArchitectureDecisions();

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle empty results', async () => {
			mockProtocolHandler.mockSuccess([]);

			const result = await architectureService.getArchitectureDecisions();

			expect(result).toEqual({
				success: true,
				data: []
			});
		});

		it('should propagate errors from protocol handler', async () => {
			mockProtocolHandler.mockError('Database query failed');

			const result = await architectureService.getArchitectureDecisions();

			expect(result).toEqual({
				success: false,
				error: 'Database query failed'
			});
		});

		it('should handle protocol handler exceptions', async () => {
			mockProtocolHandler.mockReject(new Error('Connection timeout'));

			await expect(architectureService.getArchitectureDecisions()).rejects.toThrow(
				'Connection timeout'
			);
		});
	});

	describe('getArchitectureDecisionsJson', () => {
		it('should call query_architecture_decisions_json with filters', async () => {
			const expectedData = [sampleArchitectureDecision];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await architectureService.getArchitectureDecisionsJson(sampleFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions_json',
				sampleFilters
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle undefined filters', async () => {
			const expectedData = [sampleArchitectureDecision];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await architectureService.getArchitectureDecisionsJson(undefined);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions_json',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle partial filters', async () => {
			const partialFilters: ArchitectureFilters = { status: 'Accepted' };
			const expectedData = [{ ...sampleArchitectureDecision, status: 'Accepted' }];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await architectureService.getArchitectureDecisionsJson(partialFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions_json',
				partialFilters
			);
			expect(result.success).toBe(true);
		});

		it('should filter by search text', async () => {
			const searchFilter: ArchitectureFilters = { search_text: 'JWT token' };
			mockProtocolHandler.mockSuccess([sampleArchitectureDecision]);

			const result = await architectureService.getArchitectureDecisionsJson(searchFilter);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions_json',
				searchFilter
			);
		});

		it('should filter by requirement ID', async () => {
			const reqFilter: ArchitectureFilters = { requirement_id: 'REQ-003-NFUNC-00' };
			mockProtocolHandler.mockSuccess([sampleArchitectureDecision]);

			const result = await architectureService.getArchitectureDecisionsJson(reqFilter);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions_json',
				reqFilter
			);
		});
	});

	describe('getArchitectureDetails', () => {
		it('should call get_architecture_details with correct ID', async () => {
			mockProtocolHandler.mockSuccess(sampleArchitectureDecision);

			const result = await architectureService.getArchitectureDetails('ADR-001-00-00');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'get_architecture_details',
				{ architecture_id: 'ADR-001-00-00' }
			);
			expect(result).toEqual({
				success: true,
				data: sampleArchitectureDecision
			});
		});

		it('should handle non-existent architecture decision', async () => {
			mockProtocolHandler.mockError('Architecture decision not found');

			const result = await architectureService.getArchitectureDetails('ADR-999-INVALID');

			expect(result).toEqual({
				success: false,
				error: 'Architecture decision not found'
			});
		});

		it('should validate ID parameter', async () => {
			mockProtocolHandler.mockSuccess(sampleArchitectureDecision);

			await architectureService.getArchitectureDetails('');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'get_architecture_details',
				{ architecture_id: '' }
			);
		});

		it('should handle architecture decisions with complex structures', async () => {
			const complexDecision = {
				...sampleArchitectureDecision,
				consequences: {
					positive: ['Benefit 1', 'Benefit 2', 'Benefit 3'],
					negative: ['Risk 1', 'Risk 2'],
					neutral: ['Trade-off 1']
				},
				decision_drivers: [
					'Performance requirements',
					'Security constraints',
					'Budget limitations',
					'Timeline constraints'
				],
				considered_options: [
					'Option A: Existing solution',
					'Option B: Build from scratch',
					'Option C: Third-party service',
					'Option D: Hybrid approach'
				],
				related_decisions: ['ADR-002-00-00', 'ADR-003-00-00']
			};
			mockProtocolHandler.mockSuccess(complexDecision);

			const result = await architectureService.getArchitectureDetails('ADR-001-00-00');

			expect(result.success).toBe(true);
			expect(result.data).toEqual(complexDecision);
		});
	});

	describe('createArchitectureDecision', () => {
		it('should call create_architecture_decision with decision data', async () => {
			const newDecision: Partial<ArchitectureDecision> = {
				requirement_ids: ['REQ-002-TECH-00'],
				title: 'Database Selection',
				context: 'We need to choose a database for our application',
				decision: 'Use PostgreSQL as the primary database',
				decision_drivers: ['ACID compliance', 'Performance requirements'],
				authors: ['Database Architect']
			};
			mockProtocolHandler.mockSuccess({ ...sampleArchitectureDecision, ...newDecision });

			const result = await architectureService.createArchitectureDecision(newDecision);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_architecture_decision',
				newDecision
			);
			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('Database Selection');
		});

		it('should handle creation errors', async () => {
			const invalidDecision = { title: '' }; // Missing required fields
			mockProtocolHandler.mockError('Missing required fields: context, decision');

			const result = await architectureService.createArchitectureDecision(invalidDecision);

			expect(result).toEqual({
				success: false,
				error: 'Missing required fields: context, decision'
			});
		});

		it('should handle empty decision object', async () => {
			mockProtocolHandler.mockSuccess(sampleArchitectureDecision);

			const result = await architectureService.createArchitectureDecision({});

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_architecture_decision',
				{}
			);
		});

		it('should preserve all provided fields', async () => {
			const fullDecision: Partial<ArchitectureDecision> = {
				requirement_ids: ['REQ-001-FUNC-00', 'REQ-002-TECH-00'],
				title: 'Microservices Architecture Pattern',
				status: 'Under Review',
				context: 'Our monolithic application is becoming difficult to maintain and scale',
				decision: 'Migrate to microservices architecture using containerization',
				consequences: {
					positive: ['Independent deployments', 'Technology diversity', 'Fault isolation'],
					negative: [
						'Increased operational complexity',
						'Network latency',
						'Data consistency challenges'
					]
				},
				decision_drivers: [
					'Scalability requirements',
					'Team autonomy',
					'Technology modernization',
					'Deployment flexibility'
				],
				considered_options: [
					'Continue with monolith',
					'Modular monolith',
					'Microservices',
					'Serverless functions'
				],
				authors: ['Senior Architect', 'Tech Lead', 'DevOps Engineer']
			};

			mockProtocolHandler.mockSuccess(fullDecision as ArchitectureDecision);

			const result = await architectureService.createArchitectureDecision(fullDecision);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_architecture_decision',
				fullDecision
			);
		});

		it('should handle decisions with multiple requirements', async () => {
			const multiReqDecision: Partial<ArchitectureDecision> = {
				requirement_ids: [
					'REQ-001-FUNC-00',
					'REQ-002-NFUNC-00',
					'REQ-003-TECH-00',
					'REQ-004-BUS-00'
				],
				title: 'Cross-cutting Architecture Decision',
				context: 'This decision affects multiple requirements',
				decision: 'Implement comprehensive solution'
			};

			mockProtocolHandler.mockSuccess(multiReqDecision as ArchitectureDecision);

			const result = await architectureService.createArchitectureDecision(multiReqDecision);

			expect(result.success).toBe(true);
			expect(result.data?.requirement_ids).toHaveLength(4);
		});
	});

	describe('updateArchitectureStatus', () => {
		it('should call update_architecture_status with required parameters', async () => {
			const updatedDecision = { ...sampleArchitectureDecision, status: 'Accepted' };
			mockProtocolHandler.mockSuccess(updatedDecision);

			const result = await architectureService.updateArchitectureStatus(
				'ADR-001-00-00',
				'Accepted'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_architecture_status',
				{
					architecture_id: 'ADR-001-00-00',
					new_status: 'Accepted',
					comment: undefined
				}
			);
			expect(result.success).toBe(true);
			expect(result.data?.status).toBe('Accepted');
		});

		it('should include comment when provided', async () => {
			const updatedDecision = { ...sampleArchitectureDecision, status: 'Rejected' };
			mockProtocolHandler.mockSuccess(updatedDecision);

			const result = await architectureService.updateArchitectureStatus(
				'ADR-001-00-00',
				'Rejected',
				'Security concerns raised during review'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_architecture_status',
				{
					architecture_id: 'ADR-001-00-00',
					new_status: 'Rejected',
					comment: 'Security concerns raised during review'
				}
			);
		});

		it('should handle invalid status transitions', async () => {
			mockProtocolHandler.mockError('Invalid status transition from Proposed to Deprecated');

			const result = await architectureService.updateArchitectureStatus(
				'ADR-001-00-00',
				'Deprecated'
			);

			expect(result).toEqual({
				success: false,
				error: 'Invalid status transition from Proposed to Deprecated'
			});
		});

		it('should handle empty comment', async () => {
			const updatedDecision = { ...sampleArchitectureDecision, status: 'Under Review' };
			mockProtocolHandler.mockSuccess(updatedDecision);

			const result = await architectureService.updateArchitectureStatus(
				'ADR-001-00-00',
				'Under Review',
				''
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_architecture_status',
				{
					architecture_id: 'ADR-001-00-00',
					new_status: 'Under Review',
					comment: ''
				}
			);
		});

		it('should handle architecture decision lifecycle states', async () => {
			// Test different status transitions in ADR lifecycle
			const statusTransitions = [
				{ from: 'Proposed', to: 'Under Review' },
				{ from: 'Under Review', to: 'Accepted' },
				{ from: 'Accepted', to: 'Implemented' },
				{ from: 'Implemented', to: 'Superseded' },
				{ from: 'Proposed', to: 'Rejected' }
			];

			for (const transition of statusTransitions) {
				mockProtocolHandler.reset();
				mockProtocolHandler.mockSuccess({
					...sampleArchitectureDecision,
					status: transition.to
				});

				const result = await architectureService.updateArchitectureStatus(
					'ADR-001-00-00',
					transition.to,
					`Transitioning from ${transition.from} to ${transition.to}`
				);

				expect(result.success).toBe(true);
			}
		});

		it('should handle status update with review comments', async () => {
			const detailedComment = `
				Review findings:
				- Security implications assessed
				- Performance impact analyzed
				- Implementation complexity evaluated
				- Team capacity confirmed
				Decision: Approved for implementation
			`;

			const updatedDecision = { ...sampleArchitectureDecision, status: 'Approved' };
			mockProtocolHandler.mockSuccess(updatedDecision);

			const result = await architectureService.updateArchitectureStatus(
				'ADR-001-00-00',
				'Approved',
				detailedComment.trim()
			);

			expect(result.success).toBe(true);
			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_architecture_status',
				expect.objectContaining({
					comment: detailedComment.trim()
				})
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle protocol handler network errors', async () => {
			mockProtocolHandler.sendRequestWithResponse.mockRejectedValue(
				new Error('Network connection failed')
			);

			await expect(architectureService.getArchitectureDecisions()).rejects.toThrow(
				'Network connection failed'
			);
		});

		it('should handle malformed response data', async () => {
			mockProtocolHandler.mockSuccess(null);

			const result = await architectureService.getArchitectureDecisions();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle protocol handler returning undefined', async () => {
			mockProtocolHandler.mockSuccess(undefined);

			const result = await architectureService.getArchitectureDetails('ADR-001');

			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});

		it('should handle server validation errors', async () => {
			mockProtocolHandler.mockError('Validation failed: Authors field is required');

			const result = await architectureService.createArchitectureDecision({
				title: 'Test Decision',
				context: 'Test context',
				decision: 'Test decision'
				// Missing authors field
			});

			expect(result).toEqual({
				success: false,
				error: 'Validation failed: Authors field is required'
			});
		});

		it('should handle concurrent modification errors', async () => {
			mockProtocolHandler.mockError('Architecture decision was modified by another user');

			const result = await architectureService.updateArchitectureStatus(
				'ADR-001-00-00',
				'Accepted'
			);

			expect(result).toEqual({
				success: false,
				error: 'Architecture decision was modified by another user'
			});
		});
	});

	describe('Type Safety', () => {
		it('should preserve TypeScript types in responses', async () => {
			mockProtocolHandler.mockSuccess([sampleArchitectureDecision]);

			const result = await architectureService.getArchitectureDecisions();

			if (result.success) {
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.data?.[0]?.status).toBe('Proposed');
				expect(Array.isArray(result.data?.[0]?.requirement_ids)).toBe(true);
				expect(typeof result.data?.[0]?.context).toBe('string');
			}
		});

		it('should handle generic MCPResponse properly', async () => {
			mockProtocolHandler.mockError('Test error');

			const result = await architectureService.getArchitectureDecisions();

			if (!result.success) {
				expect(typeof result.error).toBe('string');
				expect(result.error).toBe('Test error');
			}
		});

		it('should validate complex decision structures', async () => {
			const decisionWithComplexConsequences = {
				...sampleArchitectureDecision,
				consequences: {
					positive: ['Benefit 1', 'Benefit 2'],
					negative: ['Risk 1', 'Risk 2'],
					neutral: ['Neutral impact']
				}
			};
			mockProtocolHandler.mockSuccess(decisionWithComplexConsequences);

			const result = await architectureService.getArchitectureDetails('ADR-001-00-00');

			if (result.success && result.data?.consequences) {
				expect(Array.isArray(result.data.consequences.positive)).toBe(true);
				expect(Array.isArray(result.data.consequences.negative)).toBe(true);
			}
		});
	});

	describe('Integration Patterns', () => {
		it('should work with all filter combinations', async () => {
			const complexFilters: ArchitectureFilters = {
				search_text: 'microservices containerization',
				status: 'Implemented',
				requirement_id: 'REQ-001-FUNC-00',
				type: 'architectural'
			};
			mockProtocolHandler.mockSuccess([sampleArchitectureDecision]);

			const result = await architectureService.getArchitectureDecisionsJson(complexFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_architecture_decisions_json',
				complexFilters
			);
			expect(result.success).toBe(true);
		});

		it('should handle concurrent requests', async () => {
			mockProtocolHandler.sendRequestWithResponse
				.mockResolvedValueOnce({ success: true, data: [sampleArchitectureDecision] })
				.mockResolvedValueOnce({ success: true, data: sampleArchitectureDecision })
				.mockResolvedValueOnce({
					success: true,
					data: { ...sampleArchitectureDecision, status: 'Accepted' }
				});

			const [listResult, detailResult, updateResult] = await Promise.all([
				architectureService.getArchitectureDecisions(),
				architectureService.getArchitectureDetails('ADR-001-00-00'),
				architectureService.updateArchitectureStatus('ADR-001-00-00', 'Accepted')
			]);

			expect(listResult.success).toBe(true);
			expect(detailResult.success).toBe(true);
			expect(updateResult.success).toBe(true);
			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledTimes(3);
		});

		it('should handle architecture decision templates', async () => {
			const templateDecision: Partial<ArchitectureDecision> = {
				requirement_ids: ['REQ-TEMPLATE'],
				title: 'Architecture Decision Template',
				context: 'Standard template for architecture decisions',
				decision: 'Follow ADR format for all decisions',
				consequences: {
					positive: ['Consistent documentation', 'Better traceability'],
					negative: ['Initial overhead']
				},
				decision_drivers: ['Documentation standards', 'Team alignment'],
				considered_options: ['Free-form documents', 'ADR template', 'No documentation'],
				authors: ['Architecture Team']
			};

			mockProtocolHandler.mockSuccess(templateDecision as ArchitectureDecision);

			const result = await architectureService.createArchitectureDecision(templateDecision);

			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('Architecture Decision Template');
		});

		it('should handle architecture decision relationships', async () => {
			// Test related decisions and superseding
			const baseDecision = { ...sampleArchitectureDecision, id: 'ADR-001-00-00' };
			const supersedingDecision = {
				...sampleArchitectureDecision,
				id: 'ADR-002-00-00',
				title: 'Updated Authentication Strategy',
				context: 'Original JWT decision needs updating based on new requirements'
			};

			mockProtocolHandler.sendRequestWithResponse
				.mockResolvedValueOnce({ success: true, data: baseDecision })
				.mockResolvedValueOnce({ success: true, data: supersedingDecision })
				.mockResolvedValueOnce({ success: true, data: { ...baseDecision, status: 'Superseded' } });

			const [originalResult, newResult, updateResult] = await Promise.all([
				architectureService.getArchitectureDetails('ADR-001-00-00'),
				architectureService.createArchitectureDecision({
					requirement_ids: ['REQ-001-FUNC-00'],
					title: 'Updated Authentication Strategy',
					context: 'Original JWT decision needs updating',
					decision: 'Use OAuth 2.0 with PKCE'
				}),
				architectureService.updateArchitectureStatus(
					'ADR-001-00-00',
					'Superseded',
					'Superseded by ADR-002-00-00'
				)
			]);

			expect(originalResult.success).toBe(true);
			expect(newResult.success).toBe(true);
			expect(updateResult.success).toBe(true);
		});
	});
});
