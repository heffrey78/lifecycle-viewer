import type { Requirement, RequirementFilters, MCPResponse } from '$lib/types/lifecycle.js';
import type { ProtocolHandler } from './protocol-handler.js';

export class RequirementService {
	constructor(private protocolHandler: ProtocolHandler) {}

	async getRequirements(filters?: RequirementFilters): Promise<MCPResponse<Requirement[]>> {
		return this.protocolHandler.sendRequestWithResponse<Requirement[]>(
			'query_requirements',
			filters || {}
		);
	}

	async getRequirementsJson(filters?: RequirementFilters): Promise<MCPResponse<Requirement[]>> {
		return this.protocolHandler.sendRequestWithResponse<Requirement[]>(
			'query_requirements_json',
			filters || {}
		);
	}

	async getRequirementDetails(id: string): Promise<MCPResponse<Requirement>> {
		return this.protocolHandler.sendRequestWithResponse<Requirement>(
			'get_requirement_details',
			{ requirement_id: id }
		);
	}

	async createRequirement(requirement: Partial<Requirement>): Promise<MCPResponse<Requirement>> {
		return this.protocolHandler.sendRequestWithResponse<Requirement>(
			'create_requirement',
			requirement
		);
	}

	async updateRequirementStatus(
		id: string,
		newStatus: string,
		comment?: string
	): Promise<MCPResponse<Requirement>> {
		return this.protocolHandler.sendRequestWithResponse<Requirement>(
			'update_requirement_status',
			{
				requirement_id: id,
				new_status: newStatus,
				comment
			}
		);
	}

	async traceRequirement(id: string): Promise<MCPResponse<unknown>> {
		return this.protocolHandler.sendRequestWithResponse<unknown>(
			'trace_requirement',
			{ requirement_id: id }
		);
	}
}