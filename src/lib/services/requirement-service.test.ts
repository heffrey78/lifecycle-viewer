import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequirementService } from './requirement-service.js';
import type { ProtocolHandler } from './protocol-handler.js';
import type { Requirement, RequirementFilters, MCPResponse } from '$lib/types/lifecycle.js';

// Mock ProtocolHandler
class MockProtocolHandler {
	sendRequestWithResponse = vi.fn();

	// Helper to simulate successful responses
	mockSuccess<T>(data: T): void {
		this.sendRequestWithResponse.mockResolvedValue({
			success: true,
			data
		});
	}

	// Helper to simulate error responses
	mockError(error: string): void {
		this.sendRequestWithResponse.mockResolvedValue({
			success: false,
			error
		});
	}

	// Helper to simulate rejection
	mockReject(error: Error): void {
		this.sendRequestWithResponse.mockRejectedValue(error);
	}

	reset(): void {
		this.sendRequestWithResponse.mockReset();
	}
}

describe('RequirementService', () => {
	let requirementService: RequirementService;
	let mockProtocolHandler: MockProtocolHandler;

	const sampleRequirement: Requirement = {
		id: 'REQ-001-FUNC-00',
		type: 'FUNC',
		title: 'User Authentication',
		status: 'Draft',
		priority: 'P1',
		current_state: 'No authentication system exists',
		desired_state: 'Users can securely authenticate',
		business_value: 'Enables secure user access',
		risk_level: 'Medium',
		functional_requirements: ['Login form', 'Password validation'],
		acceptance_criteria: ['User can log in', 'Invalid credentials rejected'],
		author: 'Product Manager',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-02T00:00:00Z'
	};

	const sampleFilters: RequirementFilters = {
		search_text: 'authentication',
		status: 'Draft',
		type: 'FUNC',
		priority: 'P1'
	};

	beforeEach(() => {
		mockProtocolHandler = new MockProtocolHandler();
		requirementService = new RequirementService(mockProtocolHandler as any as ProtocolHandler);
	});

	describe('getRequirements', () => {
		it('should call query_requirements with filters', async () => {
			const expectedData = [sampleRequirement];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await requirementService.getRequirements(sampleFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_requirements',
				sampleFilters
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should call query_requirements with empty filters when none provided', async () => {
			const expectedData = [sampleRequirement];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await requirementService.getRequirements();

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_requirements',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle empty results', async () => {
			mockProtocolHandler.mockSuccess([]);

			const result = await requirementService.getRequirements();

			expect(result).toEqual({
				success: true,
				data: []
			});
		});

		it('should propagate errors from protocol handler', async () => {
			mockProtocolHandler.mockError('Server connection failed');

			const result = await requirementService.getRequirements();

			expect(result).toEqual({
				success: false,
				error: 'Server connection failed'
			});
		});

		it('should handle protocol handler exceptions', async () => {
			mockProtocolHandler.mockReject(new Error('Network timeout'));

			await expect(requirementService.getRequirements())
				.rejects.toThrow('Network timeout');
		});
	});

	describe('getRequirementsJson', () => {
		it('should call query_requirements_json with filters', async () => {
			const expectedData = [sampleRequirement];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await requirementService.getRequirementsJson(sampleFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_requirements_json',
				sampleFilters
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle undefined filters', async () => {
			const expectedData = [sampleRequirement];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await requirementService.getRequirementsJson(undefined);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_requirements_json',
				{}
			);
			expect(result).toEqual({
				success: true,
				data: expectedData
			});
		});

		it('should handle partial filters', async () => {
			const partialFilters: RequirementFilters = { status: 'Approved' };
			const expectedData = [{ ...sampleRequirement, status: 'Approved' }];
			mockProtocolHandler.mockSuccess(expectedData);

			const result = await requirementService.getRequirementsJson(partialFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_requirements_json',
				partialFilters
			);
			expect(result.success).toBe(true);
		});
	});

	describe('getRequirementDetails', () => {
		it('should call get_requirement_details with correct ID', async () => {
			mockProtocolHandler.mockSuccess(sampleRequirement);

			const result = await requirementService.getRequirementDetails('REQ-001-FUNC-00');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'get_requirement_details',
				{ requirement_id: 'REQ-001-FUNC-00' }
			);
			expect(result).toEqual({
				success: true,
				data: sampleRequirement
			});
		});

		it('should handle non-existent requirement', async () => {
			mockProtocolHandler.mockError('Requirement not found');

			const result = await requirementService.getRequirementDetails('REQ-999-INVALID');

			expect(result).toEqual({
				success: false,
				error: 'Requirement not found'
			});
		});

		it('should validate ID parameter', async () => {
			mockProtocolHandler.mockSuccess(sampleRequirement);

			await requirementService.getRequirementDetails('');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'get_requirement_details',
				{ requirement_id: '' }
			);
		});
	});

	describe('createRequirement', () => {
		it('should call create_requirement with requirement data', async () => {
			const newRequirement: Partial<Requirement> = {
				type: 'FUNC',
				title: 'New Feature',
				priority: 'P2',
				current_state: 'No implementation',
				desired_state: 'Feature implemented'
			};
			mockProtocolHandler.mockSuccess({ ...sampleRequirement, ...newRequirement });

			const result = await requirementService.createRequirement(newRequirement);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_requirement',
				newRequirement
			);
			expect(result.success).toBe(true);
			expect(result.data?.title).toBe('New Feature');
		});

		it('should handle creation errors', async () => {
			const invalidRequirement = { title: '' }; // Missing required fields
			mockProtocolHandler.mockError('Missing required fields');

			const result = await requirementService.createRequirement(invalidRequirement);

			expect(result).toEqual({
				success: false,
				error: 'Missing required fields'
			});
		});

		it('should handle empty requirement object', async () => {
			mockProtocolHandler.mockSuccess(sampleRequirement);

			const result = await requirementService.createRequirement({});

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_requirement',
				{}
			);
		});

		it('should preserve all provided fields', async () => {
			const fullRequirement: Partial<Requirement> = {
				type: 'NFUNC',
				title: 'Performance Requirement',
				priority: 'P0',
				current_state: 'Slow response times',
				desired_state: 'Sub-second response times',
				business_value: 'Better user experience',
				risk_level: 'High',
				functional_requirements: ['Response time < 1s'],
				acceptance_criteria: ['All API calls < 1s'],
				author: 'Technical Lead'
			};
			
			mockProtocolHandler.mockSuccess(fullRequirement as Requirement);

			const result = await requirementService.createRequirement(fullRequirement);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'create_requirement',
				fullRequirement
			);
		});
	});

	describe('updateRequirementStatus', () => {
		it('should call update_requirement_status with required parameters', async () => {
			const updatedRequirement = { ...sampleRequirement, status: 'Approved' };
			mockProtocolHandler.mockSuccess(updatedRequirement);

			const result = await requirementService.updateRequirementStatus(
				'REQ-001-FUNC-00',
				'Approved'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_requirement_status',
				{
					requirement_id: 'REQ-001-FUNC-00',
					new_status: 'Approved',
					comment: undefined
				}
			);
			expect(result.success).toBe(true);
			expect(result.data?.status).toBe('Approved');
		});

		it('should include comment when provided', async () => {
			const updatedRequirement = { ...sampleRequirement, status: 'Rejected' };
			mockProtocolHandler.mockSuccess(updatedRequirement);

			const result = await requirementService.updateRequirementStatus(
				'REQ-001-FUNC-00',
				'Rejected',
				'Insufficient business value'
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_requirement_status',
				{
					requirement_id: 'REQ-001-FUNC-00',
					new_status: 'Rejected',
					comment: 'Insufficient business value'
				}
			);
		});

		it('should handle invalid status transitions', async () => {
			mockProtocolHandler.mockError('Invalid status transition from Draft to Implemented');

			const result = await requirementService.updateRequirementStatus(
				'REQ-001-FUNC-00',
				'Implemented'
			);

			expect(result).toEqual({
				success: false,
				error: 'Invalid status transition from Draft to Implemented'
			});
		});

		it('should handle empty comment', async () => {
			const updatedRequirement = { ...sampleRequirement, status: 'Under Review' };
			mockProtocolHandler.mockSuccess(updatedRequirement);

			const result = await requirementService.updateRequirementStatus(
				'REQ-001-FUNC-00',
				'Under Review',
				''
			);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'update_requirement_status',
				{
					requirement_id: 'REQ-001-FUNC-00',
					new_status: 'Under Review',
					comment: ''
				}
			);
		});
	});

	describe('traceRequirement', () => {
		it('should call trace_requirement with requirement ID', async () => {
			const traceData = {
				requirement: sampleRequirement,
				tasks: [
					{ id: 'TASK-001', title: 'Implement login form' },
					{ id: 'TASK-002', title: 'Add password validation' }
				],
				architecture_decisions: [
					{ id: 'ADR-001', title: 'Choose authentication method' }
				]
			};
			mockProtocolHandler.mockSuccess(traceData);

			const result = await requirementService.traceRequirement('REQ-001-FUNC-00');

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'trace_requirement',
				{ requirement_id: 'REQ-001-FUNC-00' }
			);
			expect(result).toEqual({
				success: true,
				data: traceData
			});
		});

		it('should handle requirements with no related items', async () => {
			const emptyTrace = {
				requirement: sampleRequirement,
				tasks: [],
				architecture_decisions: []
			};
			mockProtocolHandler.mockSuccess(emptyTrace);

			const result = await requirementService.traceRequirement('REQ-001-FUNC-00');

			expect(result.success).toBe(true);
			expect(result.data).toEqual(emptyTrace);
		});

		it('should handle tracing errors', async () => {
			mockProtocolHandler.mockError('Requirement not found for tracing');

			const result = await requirementService.traceRequirement('REQ-999-INVALID');

			expect(result).toEqual({
				success: false,
				error: 'Requirement not found for tracing'
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle protocol handler network errors', async () => {
			mockProtocolHandler.sendRequestWithResponse.mockRejectedValue(
				new Error('Network connection failed')
			);

			await expect(requirementService.getRequirements())
				.rejects.toThrow('Network connection failed');
		});

		it('should handle malformed response data', async () => {
			// Protocol handler returns success but with malformed data
			mockProtocolHandler.mockSuccess(null);

			const result = await requirementService.getRequirements();

			expect(result).toEqual({
				success: true,
				data: null
			});
		});

		it('should handle protocol handler returning undefined', async () => {
			mockProtocolHandler.mockSuccess(undefined);

			const result = await requirementService.getRequirementDetails('REQ-001');

			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});
	});

	describe('Type Safety', () => {
		it('should preserve TypeScript types in responses', async () => {
			mockProtocolHandler.mockSuccess([sampleRequirement]);

			const result = await requirementService.getRequirements();

			if (result.success) {
				// TypeScript should infer correct types
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.data?.[0]?.type).toBe('FUNC');
				expect(result.data?.[0]?.priority).toBe('P1');
			}
		});

		it('should handle generic MCPResponse properly', async () => {
			mockProtocolHandler.mockError('Test error');

			const result = await requirementService.getRequirements();

			if (!result.success) {
				// TypeScript should infer error property exists
				expect(typeof result.error).toBe('string');
				expect(result.error).toBe('Test error');
			}
		});
	});

	describe('Integration Patterns', () => {
		it('should work with all filter combinations', async () => {
			const complexFilters: RequirementFilters = {
				search_text: 'authentication login',
				status: 'Under Review',
				type: 'FUNC',
				priority: 'P1'
			};
			mockProtocolHandler.mockSuccess([sampleRequirement]);

			const result = await requirementService.getRequirementsJson(complexFilters);

			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledWith(
				'query_requirements_json',
				complexFilters
			);
			expect(result.success).toBe(true);
		});

		it('should handle concurrent requests', async () => {
			mockProtocolHandler.sendRequestWithResponse
				.mockResolvedValueOnce({ success: true, data: [sampleRequirement] })
				.mockResolvedValueOnce({ success: true, data: sampleRequirement });

			const [listResult, detailResult] = await Promise.all([
				requirementService.getRequirements(),
				requirementService.getRequirementDetails('REQ-001-FUNC-00')
			]);

			expect(listResult.success).toBe(true);
			expect(detailResult.success).toBe(true);
			expect(mockProtocolHandler.sendRequestWithResponse).toHaveBeenCalledTimes(2);
		});
	});
});