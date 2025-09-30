import type {
	ChatMessage,
	ChatService,
	StreamingOptions,
	ChatConfiguration,
	ToolCall,
	ConversationThread,
	ConversationSearchFilter,
	ConversationBranch,
	FileAttachment
} from '$lib/types/chat';
import { writable, type Writable } from 'svelte/store';
import { claudeApiService } from './claude-api-service';
import { conversationPersistence } from './conversation-persistence';
import { fileProcessingService, type FileContent } from './file-processing-service';
import { mcpClient } from './mcp-client';
import { browser } from '$app/environment';

export class ChatServiceImpl implements ChatService {
	private messages: Writable<ChatMessage[]> = writable([]);
	private connectionStatus: Writable<'connected' | 'disconnected' | 'checking'> =
		writable('checking');
	private currentStreamingMessage: ChatMessage | null = null;
	private config: ChatConfiguration;
	private currentThread: ConversationThread | null = null;
	private useMCPStorage: boolean = true;

	constructor(config: Partial<ChatConfiguration> = {}) {
		this.config = {
			model: 'claude-3-7-sonnet-latest',
			systemPrompt:
				'You are a helpful assistant for project management and software development lifecycle tasks.',
			temperature: 0.7,
			maxTokens: 4000,
			tools: ['query_requirements', 'create_task', 'update_requirement_status'],
			contextLimit: 10,
			...config
		};

		// Initialize connection check
		this.checkConnection();

		// Initialize conversation persistence with migration check
		this.initializeConversation();

		// Initialize API key from secure storage (after connections are established)
		this.initializeApiKey();
	}

	private async initializeConversation(): Promise<void> {
		try {
			// Check if MCP client is available and enable MCP storage
			if (mcpClient.isConnected()) {
				this.useMCPStorage = true;
				console.log('Chat service: MCP storage enabled');
			} else {
				// Try to connect to MCP bridge
				try {
					await mcpClient.connect();
					this.useMCPStorage = true;
					console.log('Chat service: Connected to MCP bridge, storage enabled');
				} catch (error) {
					console.log('Chat service: MCP bridge not available, using localStorage fallback');
					this.useMCPStorage = false;
				}
			}

			// Initialize with current thread or create new one
			if (this.useMCPStorage) {
				try {
					const rawResult = await mcpClient.sendRequest('chat/get_current_thread', {});
					// Extract the actual data from MCP response format
					const result = this.extractMCPData(rawResult);
					if (result.success && result.thread) {
						this.currentThread = result.thread;
						this.messages.set(result.thread.messages || []);
					} else {
						// No current thread, create a new one
						await this.createNewThread();
					}
				} catch (error) {
					console.warn('Failed to get current thread from MCP, creating new one:', error);
					await this.createNewThread();
				}
			} else {
				// Use localStorage persistence
				this.currentThread = await conversationPersistence.getCurrentThread();
				if (this.currentThread) {
					this.messages.set(this.currentThread.messages);
				} else {
					await this.createNewThread();
				}
			}
		} catch (error) {
			console.error('Failed to initialize conversation:', error);
			// Fallback to creating a new thread
			await this.createNewThread();
		}
	}

	// Public stores for reactive UI
	get messagesStore() {
		return this.messages;
	}

	get connectionStatusStore() {
		return this.connectionStatus;
	}

	async sendMessage(content: string, attachments?: File[]): Promise<ChatMessage> {
		// Process file attachments if provided
		let fileAttachments: FileAttachment[] = [];
		let allFileContents: FileContent[] = [];

		if (attachments && attachments.length > 0) {
			// Create initial attachments with pending status
			fileAttachments = attachments.map((file) => ({
				id: crypto.randomUUID(),
				filename: file.name,
				size: file.size,
				type: file.type || 'application/octet-stream',
				lastModified: new Date(file.lastModified),
				processingStatus: 'pending' as const
			}));

			// Process files and update attachment status
			for (let i = 0; i < attachments.length; i++) {
				const file = attachments[i];
				const attachment = fileAttachments[i];

				attachment.processingStatus = 'processing';

				try {
					console.log(`Processing file: ${file.name} (${file.size} bytes)`);
					const result = await fileProcessingService.processFile(file);
					console.log(`Processing result for ${file.name}:`, result);

					if (result.success && result.fileContent) {
						attachment.content = result.fileContent.content;
						attachment.processingStatus = 'success';
						attachment.warning = result.warning;
						allFileContents.push(result.fileContent);
						console.log(
							`Successfully processed ${file.name}, content length: ${result.fileContent.content.length}`
						);
					} else {
						attachment.processingStatus = 'error';
						attachment.error = result.error || 'Failed to process file';
						console.error(`Failed to process ${file.name}:`, result.error);
					}
				} catch (error) {
					attachment.processingStatus = 'error';
					attachment.error = error instanceof Error ? error.message : 'File processing failed';
					console.error(`Exception processing ${file.name}:`, error);
				}
			}

			console.log(`Total files processed: ${allFileContents.length}`);
		}

		// Create user message with attachments - show file processing status
		let displayContent = content.trim();
		if (fileAttachments.length > 0) {
			const fileList = fileAttachments
				.map((f) => {
					if (f.processingStatus === 'success') {
						return `📎 ${f.filename} (${f.size} bytes) ✅`;
					} else if (f.processingStatus === 'error') {
						return `📎 ${f.filename} (${f.size} bytes) ❌ ${f.error}`;
					} else {
						return `📎 ${f.filename} (${f.size} bytes) 🔄`;
					}
				})
				.join('\n');
			displayContent = `${content.trim()}\n\n**Files attached:**\n${fileList}`;
		}

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: displayContent,
			timestamp: new Date().toISOString(),
			attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
			metadata: {
				hasFileContent: allFileContents.length > 0,
				originalContent: content.trim() // Store original content without file info
			}
		};

		// Add user message to store and persist
		this.messages.update((msgs) => [...msgs, userMessage]);
		await this.persistCurrentMessage(userMessage);

		// Create streaming assistant message
		const assistantMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			timestamp: new Date().toISOString(),
			isStreaming: true
		};

		this.currentStreamingMessage = assistantMessage;
		this.messages.update((msgs) => [...msgs, assistantMessage]);

		try {
			// Check if Claude API is configured
			if (!claudeApiService.isConfigured()) {
				// Fall back to simulation if Claude API is not configured
				await this.simulateStreamingResponse(assistantMessage, content);
			} else {
				// Use real Claude API
				let currentMessages: ChatMessage[] = [];
				const unsubscribe = this.messages.subscribe((msgs) => (currentMessages = msgs));
				unsubscribe(); // Immediately unsubscribe to avoid memory leak
				// Exclude both the streaming message AND the current user message (we'll send it separately with file content)
				const conversationHistory = currentMessages.slice(0, -2);

				// Prepare message content with file contents if available
				let messageContent = content; // Use original content as base
				console.log(`Preparing Claude API message with ${allFileContents.length} file contents`);

				if (allFileContents.length > 0) {
					const fileContentSections = allFileContents
						.map((fileContent) => {
							console.log(
								`Including file content: ${fileContent.filename} (${fileContent.content.length} chars)`
							);

							// Simpler format - just the file content with clear demarcation
							return `FILE: ${fileContent.filename} (${fileContent.size} bytes)\n===BEGIN FILE CONTENT===\n${fileContent.content}\n===END FILE CONTENT===`;
						})
						.join('\n\n');

					messageContent = `${messageContent}\n\nI have uploaded the following files for you to analyze. Please read and analyze the content that appears between the BEGIN/END markers:\n\n${fileContentSections}`;
					console.log(`Final message content length: ${messageContent.length} chars`);
				} else {
					console.log('No file contents to include in Claude API message');
				}

				const response = await claudeApiService.sendMessage(messageContent, conversationHistory, {
					onStart: () => {
						// Already started above
					},
					onToken: (_token: string, fullContent: string) => {
						assistantMessage.content = fullContent;
						this.messages.update((msgs) =>
							msgs.map((m) => (m.id === assistantMessage.id ? { ...assistantMessage } : m))
						);
					},
					onToolCall: (toolCall: ToolCall) => {
						if (!assistantMessage.metadata) {
							assistantMessage.metadata = { toolCalls: [] };
						}
						if (!assistantMessage.metadata.toolCalls) {
							assistantMessage.metadata.toolCalls = [];
						}
						assistantMessage.metadata.toolCalls.push(toolCall);
					},
					onComplete: (finalMessage: ChatMessage) => {
						// Update the assistant message with the final content
						assistantMessage.content = finalMessage.content;
						assistantMessage.metadata = finalMessage.metadata;
					},
					onError: (error: string) => {
						assistantMessage.error = error;
					}
				});

				// Update the final message
				assistantMessage.content = response.content;
				assistantMessage.metadata = response.metadata;
			}

			// Mark as complete
			assistantMessage.isStreaming = false;
			this.currentStreamingMessage = null;
			this.messages.update((msgs) =>
				msgs.map((m) => (m.id === assistantMessage.id ? assistantMessage : m))
			);

			// Persist the completed assistant message
			await this.persistCurrentMessage(assistantMessage);

			return assistantMessage;
		} catch (error) {
			// Handle error
			assistantMessage.error =
				error instanceof Error ? error.message : 'An unexpected error occurred';
			assistantMessage.isStreaming = false;
			this.currentStreamingMessage = null;

			this.messages.update((msgs) =>
				msgs.map((m) => (m.id === assistantMessage.id ? assistantMessage : m))
			);

			// Persist the error message
			await this.persistCurrentMessage(assistantMessage);

			throw error;
		}
	}

	async clearHistory(): Promise<void> {
		// Create a new thread instead of clearing the current one
		await this.createNewThread();
	}

	async retryMessage(messageId: string): Promise<ChatMessage> {
		// Find the message and its preceding user message
		let messagesToRetry: ChatMessage[] = [];
		this.messages.update((msgs) => {
			const messageIndex = msgs.findIndex((m) => m.id === messageId);
			if (messageIndex === -1) return msgs;

			// Find the user message that prompted this response
			let userMessageIndex = messageIndex - 1;
			while (userMessageIndex >= 0 && msgs[userMessageIndex].role !== 'user') {
				userMessageIndex--;
			}

			if (userMessageIndex >= 0) {
				// Remove the failed message and retry
				const userMessage = msgs[userMessageIndex];
				messagesToRetry = msgs.slice(0, messageIndex);
				return messagesToRetry;
			}
			return msgs;
		});

		// Find the user message that needs to be retried
		const lastUserMessage = messagesToRetry.find((m) => m.role === 'user');
		if (lastUserMessage) {
			// Note: File attachments cannot be re-sent in retry, only text content
			return await this.sendMessage(lastUserMessage.content);
		}

		throw new Error('Unable to find message to retry');
	}

	getConnectionStatus(): 'connected' | 'disconnected' | 'checking' {
		let status: 'connected' | 'disconnected' | 'checking' = 'checking';
		this.connectionStatus.subscribe((s) => (status = s))();
		return status;
	}

	private async initializeApiKey(): Promise<void> {
		try {
			// Wait a bit for MCP connection to be established
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Try to initialize API key from secure storage
			await claudeApiService.initializeFromSecureStorage();

			console.log(
				'Chat service: API key initialization complete, configured:',
				claudeApiService.isConfigured()
			);

			// Update connection status after API key is loaded
			await this.checkConnection();
		} catch (error) {
			console.warn('Chat service: Failed to initialize API key:', error);
			// Update connection status even if initialization fails
			await this.checkConnection();
		}
	}

	private async checkConnection(): Promise<void> {
		this.connectionStatus.set('checking');

		try {
			// Ensure MCP client is connected first
			if (!mcpClient.isConnected()) {
				console.log('Chat service: MCP client not connected, attempting to connect...');
				await mcpClient.connect();
			}

			// Enable MCP storage if connected
			if (mcpClient.isConnected() && !this.useMCPStorage) {
				this.useMCPStorage = true;
				console.log('Chat service: MCP storage enabled after connection');
			}

			// Check Claude API service status
			const claudeStatus = claudeApiService.getConnectionStatus();
			this.connectionStatus.set(claudeStatus);
		} catch (error) {
			console.warn('Chat service: Connection check failed:', error);
			this.connectionStatus.set('disconnected');
		}
	}

	private async simulateStreamingResponse(message: ChatMessage, _userInput: string): Promise<void> {
		// Show helpful message about API configuration instead of fake responses
		const response = `I need a Claude API key to provide intelligent responses.

To configure the Claude API:
1. Get an API key from https://console.anthropic.com
2. Click the settings icon to configure your API key
3. Once configured, I can help you query your project data intelligently

For now, you can use the UI to browse requirements, tasks, and architecture decisions directly.`;

		const words = response.split(' ');

		// Simulate word-by-word streaming
		for (let i = 0; i < words.length; i++) {
			await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 50));

			const currentContent = words.slice(0, i + 1).join(' ');
			message.content = currentContent;

			// Update the message in the store
			this.messages.update((msgs) => msgs.map((m) => (m.id === message.id ? { ...message } : m)));
		}

		// No fake tool calls - just provide the configuration message
	}

	// Method to update configuration
	updateConfig(newConfig: Partial<ChatConfiguration>): void {
		this.config = { ...this.config, ...newConfig };
	}

	// Method to get current configuration
	getConfig(): ChatConfiguration {
		return { ...this.config };
	}

	// Method to configure Claude API
	async configureClaudeApi(apiKey: string): Promise<void> {
		try {
			await claudeApiService.updateApiKey(apiKey);
			// Update connection status after configuration
			await this.checkConnection();
		} catch (error) {
			console.error('Failed to configure Claude API:', error);
			throw error;
		}
	}

	// Check if Claude API is configured
	isClaudeConfigured(): boolean {
		return claudeApiService.isConfigured();
	}

	// Get API key information
	async getApiKeyInfo(): Promise<{
		isConfigured: boolean;
		keyFormat?: string;
		lastUsed?: Date;
		keyVersion?: number;
	}> {
		return await claudeApiService.getApiKeyInfo();
	}

	// Clear API key
	async clearApiKey(): Promise<void> {
		try {
			await claudeApiService.clearApiKey();
			await this.checkConnection();
		} catch (error) {
			console.error('Failed to clear API key:', error);
			throw error;
		}
	}

	// Rotate API key
	async rotateApiKey(newApiKey: string): Promise<void> {
		try {
			await claudeApiService.rotateApiKey(newApiKey);
			await this.checkConnection();
		} catch (error) {
			console.error('Failed to rotate API key:', error);
			throw error;
		}
	}

	// Conversation management methods
	getCurrentThread(): ConversationThread | null {
		return this.currentThread;
	}

	async switchToThread(threadId: string): Promise<void> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				const rawResult = await mcpClient.sendRequest('chat/switch_thread', {
					thread_id: threadId
				});
				const result = this.extractMCPData(rawResult);
				if (result.success) {
					this.currentThread = await this.getCurrentThread();
				}
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
				await conversationPersistence.switchToThread(threadId);
				this.currentThread = await conversationPersistence.getCurrentThread();
			}
		} else {
			await conversationPersistence.switchToThread(threadId);
			this.currentThread = await conversationPersistence.getCurrentThread();
		}

		if (this.currentThread) {
			this.messages.set(this.currentThread.messages);
		}
	}

	async createNewThread(title?: string): Promise<ConversationThread> {
		let thread: ConversationThread;

		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				const rawResult = await mcpClient.sendRequest('chat/create_thread', { title });
				const result = this.extractMCPData(rawResult);
				if (result.success && result.thread) {
					thread = result.thread;
				} else {
					throw new Error('Failed to create thread via MCP');
				}
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
				thread = await conversationPersistence.createThread(title);
			}
		} else {
			thread = await conversationPersistence.createThread(title);
		}

		this.currentThread = thread;
		this.messages.set([]);
		return thread;
	}

	async getAllThreads(): Promise<ConversationThread[]> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				const rawResult = await mcpClient.sendRequest('chat/get_threads', {});
				const result = this.extractMCPData(rawResult);
				if (result.success && result.threads) {
					return result.threads;
				}
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
			}
		}
		return await conversationPersistence.getAllThreads();
	}

	async deleteThread(threadId: string): Promise<void> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				await mcpClient.sendRequest('chat/delete_thread', { thread_id: threadId });
				this.currentThread = await this.getCurrentThread();
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
				await conversationPersistence.deleteThread(threadId);
				this.currentThread = await conversationPersistence.getCurrentThread();
			}
		} else {
			await conversationPersistence.deleteThread(threadId);
			this.currentThread = await conversationPersistence.getCurrentThread();
		}

		if (this.currentThread) {
			this.messages.set(this.currentThread.messages);
		} else {
			this.messages.set([]);
		}
	}

	async updateThreadTitle(threadId: string, title: string): Promise<void> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				await mcpClient.sendRequest('chat/update_thread_title', { thread_id: threadId, title });
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
				await conversationPersistence.updateThreadTitle(threadId, title);
			}
		} else {
			await conversationPersistence.updateThreadTitle(threadId, title);
		}

		// Update current thread if it's the one being updated
		if (this.currentThread?.id === threadId) {
			this.currentThread.title = title;
		}
	}

	async searchConversations(filter: ConversationSearchFilter): Promise<ConversationThread[]> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				const rawResult = await mcpClient.sendRequest(
					'chat/search_conversations',
					filter as Record<string, unknown>
				);
				const result = this.extractMCPData(rawResult);
				if (result.success && result.threads) {
					return result.threads;
				}
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
			}
		}
		return await conversationPersistence.searchConversations(filter);
	}

	async exportThread(threadId: string, format: 'markdown' | 'json'): Promise<string> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				const rawResult = await mcpClient.sendRequest('chat/export_thread', {
					thread_id: threadId,
					format
				});
				const result = this.extractMCPData(rawResult);
				if (result.success && result.content) {
					return result.content;
				}
			} catch (error) {
				console.warn('MCP storage failed, falling back to localStorage:', error);
			}
		}
		return await conversationPersistence.exportThread(threadId, format);
	}

	async createBranch(messageId: string, title?: string): Promise<ConversationBranch> {
		if (!this.currentThread) {
			throw new Error('No active conversation thread');
		}
		return await conversationPersistence.createBranch(this.currentThread.id, messageId, title);
	}

	async switchToBranch(_branchId: string): Promise<void> {
		// This would need additional implementation for branch switching
		throw new Error('Branch switching not yet implemented');
	}

	// Storage status and migration methods
	getStorageType(): 'database' | 'localStorage' {
		return this.useMCPStorage ? 'database' : 'localStorage';
	}

	async getStorageStats(): Promise<{
		storageType: 'database' | 'localStorage';
		conversationCount: number;
		messageCount: number;
		totalTokens?: number;
		storageSize: number;
	}> {
		if (this.useMCPStorage && mcpClient.isConnected()) {
			try {
				const rawResult = await mcpClient.sendRequest('chat/get_storage_stats', {});
				const result = this.extractMCPData(rawResult);
				if (result.success && result.stats) {
					return {
						storageType: 'database',
						...result.stats
					};
				}
			} catch (error) {
				console.warn('MCP storage stats failed, falling back to localStorage:', error);
			}
		}

		// Fallback to localStorage stats
		const threads = await conversationPersistence.getAllThreads();
		const storageSize = await conversationPersistence.getStorageSize();
		return {
			storageType: 'localStorage',
			conversationCount: threads.length,
			messageCount: threads.reduce((total, thread) => total + thread.messages.length, 0),
			totalTokens: threads.reduce(
				(total, thread) => total + (thread.metadata?.totalTokens || 0),
				0
			),
			storageSize
		};
	}

	async getMigrationStatus(): Promise<{
		isNeeded: boolean;
		localStorageThreads: number;
		localStorageMessages: number;
		databaseThreads: number;
		databaseMessages: number;
		lastMigrationAttempt?: string;
		migrationStatus?: string;
	}> {
		if (browser) {
			// In browser environment, get localStorage stats only
			const threads = await conversationPersistence.getAllThreads();
			return {
				isNeeded: false, // Migration not available in browser
				localStorageThreads: threads.length,
				localStorageMessages: threads.reduce((total, thread) => total + thread.messages.length, 0),
				databaseThreads: 0,
				databaseMessages: 0,
				migrationStatus: 'browser-not-supported'
			};
		}
		// Migration not available with MCP architecture
		return {
			isNeeded: false,
			localStorageThreads: 0,
			localStorageMessages: 0,
			databaseThreads: 0,
			databaseMessages: 0,
			migrationStatus: 'mcp-architecture-no-migration-needed'
		};
	}

	async performMigration(): Promise<{
		success: boolean;
		threadsTransferred: number;
		messagesTransferred: number;
		errors: string[];
		duration: number;
	}> {
		// Migration is now handled automatically when MCP storage is available
		// No manual migration needed - data will be stored in MCP bridge automatically
		return {
			success: true,
			threadsTransferred: 0,
			messagesTransferred: 0,
			errors: [],
			duration: 0
		};
	}

	// Helper to extract data from MCP tool response (copied from MCP client pattern)
	private extractMCPData(result: any): any {
		// MCP tools return data in result.content[0].text or result.content[0]
		if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
			const content = result.content[0];
			if (content.text) {
				try {
					return JSON.parse(content.text);
				} catch {
					return content.text;
				}
			}
			return content;
		}
		return result;
	}

	private async persistCurrentMessage(message: ChatMessage): Promise<void> {
		if (!this.currentThread) return;

		try {
			if (this.useMCPStorage && mcpClient.isConnected()) {
				try {
					await mcpClient.sendRequest('chat/add_message', {
						thread_id: this.currentThread.id,
						message: message
					});
					// Refresh current thread to get updated message count/tokens
					const rawResult = await mcpClient.sendRequest('chat/get_current_thread', {});
					const result = this.extractMCPData(rawResult);
					if (result.success && result.thread) {
						this.currentThread = result.thread;
					}
				} catch (mcpError) {
					console.warn('MCP message persistence failed, falling back to localStorage:', mcpError);
					await conversationPersistence.addMessageToThread(this.currentThread.id, message);
					this.currentThread = await conversationPersistence.getCurrentThread();
				}
			} else {
				await conversationPersistence.addMessageToThread(this.currentThread.id, message);
				this.currentThread = await conversationPersistence.getCurrentThread();
			}
		} catch (error) {
			console.warn('Failed to persist message:', error);
		}
	}
}

// Export singleton instance
export const chatService = new ChatServiceImpl();
