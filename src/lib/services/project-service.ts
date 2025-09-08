import type { ProjectMetrics, MCPResponse } from '$lib/types/lifecycle.js';
import type { ProtocolHandler } from './protocol-handler.js';

export class ProjectService {
	constructor(private protocolHandler: ProtocolHandler) {}

	async getProjectStatus(): Promise<MCPResponse<ProjectMetrics>> {
		return this.protocolHandler.sendRequestWithResponse<ProjectMetrics>(
			'get_project_status',
			{}
		);
	}

	async getProjectMetrics(): Promise<MCPResponse<ProjectMetrics>> {
		return this.protocolHandler.sendRequestWithResponse<ProjectMetrics>(
			'get_project_metrics',
			{}
		);
	}

	async startRequirementInterview(
		projectContext?: string,
		stakeholderRole?: string
	): Promise<MCPResponse<{ session_id: string; questions: Record<string, string> }>> {
		return this.protocolHandler.sendRequestWithResponse<{
			session_id: string;
			questions: Record<string, string>;
		}>('start_requirement_interview', {
			project_context: projectContext,
			stakeholder_role: stakeholderRole
		});
	}

	async continueRequirementInterview(
		sessionId: string,
		answers: Record<string, string>
	): Promise<MCPResponse<unknown>> {
		return this.protocolHandler.sendRequestWithResponse<unknown>(
			'continue_requirement_interview',
			{
				session_id: sessionId,
				answers
			}
		);
	}

	async exportProjectDocumentation(options: {
		project_name?: string;
		include_requirements?: boolean;
		include_tasks?: boolean;
		include_architecture?: boolean;
		output_directory?: string;
	}): Promise<MCPResponse<string[]>> {
		return this.protocolHandler.sendRequestWithResponse<string[]>(
			'export_project_documentation',
			options
		);
	}

	async createArchitecturalDiagrams(options: {
		diagram_type?: string;
		requirement_ids?: string[];
		include_relationships?: boolean;
		output_format?: string;
	}): Promise<MCPResponse<string>> {
		return this.protocolHandler.sendRequestWithResponse<string>(
			'create_architectural_diagrams',
			options
		);
	}
}