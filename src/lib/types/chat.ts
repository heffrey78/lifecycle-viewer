export interface FileAttachment {
	id: string;
	filename: string;
	size: number;
	type: string;
	content?: string; // Processed file content
	lastModified: Date;
	processingStatus: 'pending' | 'processing' | 'success' | 'error';
	error?: string;
	warning?: string;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
	isStreaming?: boolean;
	error?: string;
	attachments?: FileAttachment[];
	metadata?: {
		toolCalls?: ToolCall[];
		model?: string;
		tokens?: {
			input: number;
			output: number;
		};
		hasFileContent?: boolean; // Indicates if message includes file content in context
		originalContent?: string; // Original user content without file attachment info
	};
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, any>;
	result?: any;
	error?: string;
	executedAt?: string;
	partialJsonInput?: string; // For accumulating streamed tool input
}

export interface ChatInterfaceProps {
	// Optional props that can be passed to the component
}

export interface ChatSession {
	id: string;
	title: string;
	messages: ChatMessage[];
	createdAt: string;
	updatedAt: string;
	metadata?: {
		projectId?: string;
		totalTokens?: number;
		averageResponseTime?: number;
	};
}

export interface ConversationThread {
	id: string;
	title: string;
	messages: ChatMessage[];
	createdAt: string;
	updatedAt: string;
	metadata?: {
		projectId?: string;
		totalTokens?: number;
		averageResponseTime?: number;
		tags?: string[];
	};
}

export interface ConversationSearchFilter {
	query?: string;
	dateFrom?: string;
	dateTo?: string;
	tags?: string[];
	participantType?: 'user' | 'assistant' | 'both';
}

export interface ConversationBranch {
	id: string;
	parentMessageId: string;
	threadId: string;
	title: string;
	messages: ChatMessage[];
	createdAt: string;
}

export interface ChatService {
	sendMessage(content: string, attachments?: File[]): Promise<ChatMessage>;
	clearHistory(): Promise<void>;
	retryMessage(messageId: string): Promise<ChatMessage>;
	getConnectionStatus(): 'connected' | 'disconnected' | 'checking';

	// Conversation management
	getCurrentThread(): ConversationThread | null;
	switchToThread(threadId: string): Promise<void>;
	createNewThread(title?: string): Promise<ConversationThread>;
	getAllThreads(): Promise<ConversationThread[]>;
	deleteThread(threadId: string): Promise<void>;
	updateThreadTitle(threadId: string, title: string): Promise<void>;

	// Search and filtering
	searchConversations(filter: ConversationSearchFilter): Promise<ConversationThread[]>;
	exportThread(threadId: string, format: 'markdown' | 'json'): Promise<string>;

	// Branching
	createBranch(messageId: string, title?: string): Promise<ConversationBranch>;
	switchToBranch(branchId: string): Promise<void>;
}

export interface StreamingOptions {
	onStart?: () => void;
	onToken?: (token: string, fullContent: string) => void;
	onToolCall?: (toolCall: ToolCall) => void;
	onComplete?: (message: ChatMessage) => void;
	onError?: (error: string) => void;
}

export interface ChatConfiguration {
	model: string;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	tools?: string[];
	contextLimit?: number;
}
