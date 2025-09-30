// TypeScript type definitions for Chat Persistence
// Corresponds to chat-tables.sql schema

// Base types
export type MessageRole = 'user' | 'assistant' | 'system';
export type ProcessingStatus = 'pending' | 'processing' | 'success' | 'error';
export type ExportFormat = 'markdown' | 'json' | 'html' | 'pdf';

// API Key Management
export interface ApiKey {
	id: number;
	user_id: string;
	encrypted_key: string;
	iv: string;
	salt: string;
	created_at: string;
	last_used_at: string;
	is_active: boolean;
	key_version: number;
}

export interface ApiKeyCreateRequest {
	user_id?: string;
	api_key: string; // Plain text key to be encrypted
}

// Conversation Management
export interface Conversation {
	id: string; // UUID
	user_id: string;
	title: string;
	description?: string;
	// Settings
	model: string;
	system_prompt?: string;
	temperature: number;
	max_tokens: number;
	// Organization
	is_archived: boolean;
	is_starred: boolean;
	tags?: string[]; // Parsed from JSON
	// Timestamps
	created_at: string;
	updated_at: string;
	last_message_at?: string;
	// Usage statistics
	message_count: number;
	total_tokens_used: number;
	estimated_cost: number;
}

export interface ConversationCreateRequest {
	title: string;
	description?: string;
	model?: string;
	system_prompt?: string;
	temperature?: number;
	max_tokens?: number;
	tags?: string[];
}

export interface ConversationUpdateRequest {
	title?: string;
	description?: string;
	model?: string;
	system_prompt?: string;
	temperature?: number;
	max_tokens?: number;
	tags?: string[];
	is_archived?: boolean;
	is_starred?: boolean;
}

// Message Management
export interface Message {
	id: string; // UUID
	conversation_id: string;
	role: MessageRole;
	content: string;
	// Rich content
	attachments?: FileAttachmentMetadata[];
	metadata?: MessageMetadata;
	// Status
	is_streaming: boolean;
	has_error: boolean;
	error_message?: string;
	// Timestamps
	created_at: string;
	updated_at: string;
	sequence_number: number;
}

export interface MessageCreateRequest {
	conversation_id: string;
	role: MessageRole;
	content: string;
	attachments?: FileAttachmentMetadata[];
	metadata?: MessageMetadata;
	is_streaming?: boolean;
}

export interface MessageMetadata {
	model?: string;
	tokens?: {
		input: number;
		output: number;
	};
	toolCalls?: ToolCallMetadata[];
	processingTime?: number;
	requestId?: string;
}

// Tool Call Tracking
export interface ToolCall {
	id: string; // UUID
	message_id: string;
	tool_name: string;
	tool_arguments: Record<string, any>;
	tool_result?: any;
	executed_at: string;
	execution_duration_ms?: number;
	success: boolean;
	error_message?: string;
}

export interface ToolCallMetadata {
	id: string;
	name: string;
	arguments: Record<string, any>;
	result?: any;
	error?: string;
	executedAt: string;
	duration?: number;
}

// File Attachment Management
export interface FileAttachment {
	id: string; // UUID
	message_id: string;
	filename: string;
	original_size: number;
	mime_type: string;
	processed_content?: string;
	content_summary?: string;
	processing_status: ProcessingStatus;
	processing_error?: string;
	is_safe: boolean;
	security_warnings?: string[];
	created_at: string;
	processed_at?: string;
}

export interface FileAttachmentMetadata {
	id: string;
	filename: string;
	size: number;
	type: string;
	content?: string;
	processingStatus: ProcessingStatus;
	error?: string;
	warning?: string;
}

// Usage Analytics
export interface UsageAnalytics {
	id: number;
	user_id: string;
	conversation_id?: string;
	date: string; // YYYY-MM-DD format
	model: string;
	message_count: number;
	input_tokens: number;
	output_tokens: number;
	total_tokens: number;
	estimated_cost: number;
	tool_calls_count: number;
	unique_tools_used: number;
}

export interface DailyUsageSummary {
	date: string;
	models: {
		[model: string]: {
			messages: number;
			tokens: number;
			cost: number;
			toolCalls: number;
		};
	};
	totals: {
		messages: number;
		tokens: number;
		cost: number;
		toolCalls: number;
	};
}

// Chat Settings
export interface ChatSettings {
	id: number;
	user_id: string;
	// UI preferences
	theme: string;
	language: string;
	timezone: string;
	// Chat behavior
	auto_save_conversations: boolean;
	default_model: string;
	default_temperature: number;
	default_max_tokens: number;
	// Privacy and security
	enable_analytics: boolean;
	auto_delete_after_days?: number;
	require_confirmation_for_delete: boolean;
	// Export preferences
	export_format: ExportFormat;
	include_metadata_in_export: boolean;
	// Timestamps
	created_at: string;
	updated_at: string;
}

export interface ChatSettingsUpdateRequest {
	theme?: string;
	language?: string;
	timezone?: string;
	auto_save_conversations?: boolean;
	default_model?: string;
	default_temperature?: number;
	default_max_tokens?: number;
	enable_analytics?: boolean;
	auto_delete_after_days?: number;
	require_confirmation_for_delete?: boolean;
	export_format?: ExportFormat;
	include_metadata_in_export?: boolean;
}

// Schema Versioning
export interface ChatSchemaVersion {
	version: string;
	applied_at: string;
	description: string;
}

// Search and Filtering
export interface ConversationFilters {
	user_id?: string;
	is_archived?: boolean;
	is_starred?: boolean;
	tags?: string[];
	created_after?: string;
	created_before?: string;
	search_text?: string; // Search in title/description
}

export interface MessageFilters {
	conversation_id?: string;
	role?: MessageRole;
	has_attachments?: boolean;
	has_tool_calls?: boolean;
	created_after?: string;
	created_before?: string;
	search_text?: string; // Search in content
}

// Database Service Responses
export interface ConversationSummary {
	id: string;
	title: string;
	description?: string;
	created_at: string;
	updated_at: string;
	last_message_at?: string;
	message_count: number;
	total_tokens_used: number;
	estimated_cost: number;
	is_archived: boolean;
	is_starred: boolean;
	latest_message?: string;
	latest_message_role?: MessageRole;
}

export interface UsageSummary {
	date: string;
	model: string;
	total_messages: number;
	total_input_tokens: number;
	total_output_tokens: number;
	total_tokens: number;
	total_cost: number;
	total_tool_calls: number;
}

// Migration and Export
export interface MigrationStatus {
	total_conversations: number;
	migrated_conversations: number;
	total_messages: number;
	migrated_messages: number;
	errors: string[];
	completed: boolean;
}

export interface ExportOptions {
	format: ExportFormat;
	include_metadata: boolean;
	include_tool_calls: boolean;
	include_attachments: boolean;
	date_range?: {
		start: string;
		end: string;
	};
	conversations?: string[]; // Specific conversation IDs
}

export interface ExportResult {
	success: boolean;
	file_path?: string;
	file_size?: number;
	export_format: ExportFormat;
	conversation_count: number;
	message_count: number;
	error?: string;
}
