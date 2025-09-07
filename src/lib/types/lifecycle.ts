// TypeScript type definitions for Lifecycle MCP entities
// Based on the database schema from lifecycle-mcp

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type RiskLevel = 'High' | 'Medium' | 'Low';
export type ArchitectureReview = 'Not Required' | 'Required' | 'Complete';

// Requirement types and statuses
export type RequirementType = 'FUNC' | 'NFUNC' | 'TECH' | 'BUS' | 'INTF';
export type RequirementStatus =
	| 'Draft'
	| 'Under Review'
	| 'Approved'
	| 'Architecture'
	| 'Ready'
	| 'Implemented'
	| 'Validated'
	| 'Deprecated';

// Task types and statuses
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Complete' | 'Abandoned';

export type EffortSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

// Architecture types and statuses
export type ArchitectureType = 'ADR' | 'TDD' | 'INTG';
export type ArchitectureStatus =
	| 'Proposed'
	| 'Accepted'
	| 'Rejected'
	| 'Deprecated'
	| 'Superseded'
	| 'Draft'
	| 'Under Review'
	| 'Approved'
	| 'Implemented';

// Core entity interfaces
export interface Requirement {
	id: string; // REQ-XXXX-TYPE-VV format
	requirement_number: number;
	type: RequirementType;
	version: number;
	title: string;
	status: RequirementStatus;
	priority: Priority;
	risk_level?: RiskLevel;
	business_value?: string;
	architecture_review?: ArchitectureReview;

	// Content fields
	current_state?: string;
	desired_state?: string;
	gap_analysis?: string;
	impact_of_not_acting?: string;
	functional_requirements?: string[]; // JSON array
	nonfunctional_requirements?: Record<string, any>; // JSON object
	technical_constraints?: Record<string, any>; // JSON object
	business_rules?: string[]; // JSON array
	interface_requirements?: Record<string, any>; // JSON object
	acceptance_criteria?: string[]; // JSON array
	validation_metrics?: string[]; // JSON array
	out_of_scope?: string[]; // JSON array

	// Metadata
	author: string;
	created_at: string;
	updated_at: string;

	// Denormalized for performance
	task_count: number;
	tasks_completed: number;
}

export interface Task {
	id: string; // TASK-XXXX-YY-ZZ format
	task_number: number;
	subtask_number: number;
	version: number;
	title: string;
	status: TaskStatus;
	priority: Priority;
	effort?: EffortSize;

	// Content
	user_story?: string;
	context_research?: Record<string, any>; // JSON object
	acceptance_criteria?: string[]; // JSON array
	behavioral_specs?: string; // Gherkin scenarios
	implementation_plan?: Record<string, any>; // JSON object
	test_plan?: Record<string, any>; // JSON object
	definition_of_done?: string[]; // JSON array

	// Metadata
	assignee?: string;
	created_at: string;
	updated_at: string;
	completed_at?: string;

	// GitHub Integration
	github_issue_number?: string;
	github_issue_url?: string;

	// Relationships
	parent_task_id?: string;
}

export interface ArchitectureDecision {
	id: string; // ADR-XXXX or TDD-XXXX-Component-VV
	type: ArchitectureType;
	title: string;
	status: ArchitectureStatus;

	// Content
	context?: string;
	decision_drivers?: string[]; // JSON array
	considered_options?: string[]; // JSON array
	decision_outcome?: string;
	consequences?: {
		good?: string[];
		bad?: string[];
		neutral?: string[];
	}; // JSON object
	pros_cons?: Record<string, any>; // JSON object per option
	implementation_notes?: string;
	validation_criteria?: string[]; // JSON array

	// TDD specific fields
	executive_summary?: string;
	system_design?: Record<string, any>; // JSON object with diagrams
	key_decisions?: Record<string, any>; // JSON object
	performance_considerations?: Record<string, any>; // JSON object
	risk_assessment?: Array<{
		risk: string;
		likelihood: string;
		impact: string;
		mitigation: string;
	}>; // JSON array

	// Metadata
	authors?: string[]; // JSON array
	deciders?: string[]; // JSON array
	created_at: string;
	updated_at: string;
	superseded_by?: string;
}

// Relationship interfaces
export interface RequirementTask {
	requirement_id: string;
	task_id: string;
	created_at: string;
}

export interface RequirementArchitecture {
	requirement_id: string;
	architecture_id: string;
	relationship_type?: 'addresses' | 'modifies' | 'implements';
}

export interface TaskDependency {
	task_id: string;
	depends_on_task_id: string;
	dependency_type?: 'blocks' | 'informs' | 'requires';
}

// Review and approval interfaces
export interface Review {
	id: number;
	entity_type: 'requirement' | 'task' | 'architecture';
	entity_id: string;
	reviewer: string;
	comment: string;
	created_at: string;
	resolved: boolean;
}

export interface Approval {
	id: number;
	entity_type: 'requirement' | 'architecture';
	entity_id: string;
	role: string; // 'Product Owner', 'Technical Lead', 'Architecture', 'Security'
	approver_name: string;
	approved_at: string;
	comments?: string;
}

// Dashboard and metrics interfaces
export interface ProjectMetrics {
	requirements: {
		total: number;
		by_status: Record<RequirementStatus, number>;
		by_priority: Record<Priority, number>;
		completion_percentage: number;
	};
	tasks: {
		total: number;
		by_status: Record<TaskStatus, number>;
		by_assignee: Record<string, number>;
		completion_percentage: number;
	};
	architecture: {
		total: number;
		by_status: Record<ArchitectureStatus, number>;
		by_type: Record<ArchitectureType, number>;
	};
}

export interface RequirementProgress {
	id: string;
	title: string;
	status: RequirementStatus;
	priority: Priority;
	task_count: number;
	tasks_completed: number;
	completion_percentage: number;
	architecture_artifacts: number;
}

// MCP Tool interfaces
export interface MCPResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
}

// Filter interfaces for UI
export interface RequirementFilters {
	status?: RequirementStatus[];
	priority?: Priority[];
	type?: RequirementType[];
	search_text?: string;
	[key: string]: unknown;
}

export interface TaskFilters {
	status?: TaskStatus[];
	priority?: Priority[];
	assignee?: string[];
	requirement_id?: string;
	[key: string]: unknown;
}

export interface ArchitectureFilters {
	status?: ArchitectureStatus[];
	type?: ArchitectureType[];
	requirement_id?: string;
	search_text?: string;
	[key: string]: unknown;
}

// UI State interfaces
export interface ConnectionStatus {
	connected: boolean;
	server_info?: string;
	last_ping?: string;
	error?: string;
}

export interface UIState {
	loading: boolean;
	error?: string;
	selectedEntity?: {
		type: 'requirement' | 'task' | 'architecture';
		id: string;
	};
}
