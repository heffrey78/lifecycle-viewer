import type {
	ArchitectureDecision,
	ArchitectureFilters,
	MCPResponse
} from '$lib/types/lifecycle.js';
import type { ProtocolHandler } from './protocol-handler.js';

export class ArchitectureService {
	constructor(private protocolHandler: ProtocolHandler) {}

	async getArchitectureDecisions(
		filters?: ArchitectureFilters
	): Promise<MCPResponse<ArchitectureDecision[]>> {
		return this.protocolHandler.sendRequestWithResponse<ArchitectureDecision[]>(
			'query_architecture_decisions',
			filters || {}
		);
	}

	async getArchitectureDecisionsJson(
		filters?: ArchitectureFilters
	): Promise<MCPResponse<ArchitectureDecision[]>> {
		return this.protocolHandler.sendRequestWithResponse<ArchitectureDecision[]>(
			'query_architecture_decisions_json',
			filters || {}
		);
	}

	async getArchitectureDetails(id: string): Promise<MCPResponse<ArchitectureDecision>> {
		return this.protocolHandler.sendRequestWithResponse<ArchitectureDecision>(
			'get_architecture_details',
			{ architecture_id: id }
		);
	}

	async createArchitectureDecision(
		decision: Partial<ArchitectureDecision>
	): Promise<MCPResponse<ArchitectureDecision>> {
		return this.protocolHandler.sendRequestWithResponse<ArchitectureDecision>(
			'create_architecture_decision',
			decision
		);
	}

	async updateArchitectureStatus(
		id: string,
		newStatus: string,
		comment?: string
	): Promise<MCPResponse<ArchitectureDecision>> {
		return this.protocolHandler.sendRequestWithResponse<ArchitectureDecision>(
			'update_architecture_status',
			{
				architecture_id: id,
				new_status: newStatus,
				comment
			}
		);
	}
}
