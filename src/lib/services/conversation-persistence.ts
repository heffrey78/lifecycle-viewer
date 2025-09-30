import type {
	ConversationThread,
	ConversationSearchFilter,
	ConversationBranch,
	ChatMessage
} from '$lib/types/chat';
import { browser } from '$app/environment';

const STORAGE_KEYS = {
	THREADS: 'lifecycle-chat-threads',
	BRANCHES: 'lifecycle-chat-branches',
	CURRENT_THREAD: 'lifecycle-chat-current-thread',
	SETTINGS: 'lifecycle-chat-settings'
} as const;

interface ConversationSettings {
	maxThreads: number;
	maxMessagesPerThread: number;
	autoSaveInterval: number;
}

export class ConversationPersistenceService {
	private threads: Map<string, ConversationThread> = new Map();
	private branches: Map<string, ConversationBranch> = new Map();
	private currentThreadId: string | null = null;
	private autoSaveIntervalId: number | null = null;
	private settings: ConversationSettings = {
		maxThreads: 100,
		maxMessagesPerThread: 1000,
		autoSaveInterval: 10000 // 10 seconds - reduced frequency
	};

	constructor() {
		if (browser) {
			this.loadFromStorage();
			this.setupAutoSave();
		}
	}

	// Thread management
	async createThread(title?: string): Promise<ConversationThread> {
		const now = new Date().toISOString();
		const thread: ConversationThread = {
			id: crypto.randomUUID(),
			title: title || `Conversation ${new Date().toLocaleDateString()}`,
			messages: [],
			createdAt: now,
			updatedAt: now,
			metadata: {
				totalTokens: 0,
				averageResponseTime: 0,
				tags: []
			}
		};

		this.threads.set(thread.id, thread);
		this.currentThreadId = thread.id;
		await this.saveToStorage();
		return thread;
	}

	async getCurrentThread(): Promise<ConversationThread | null> {
		if (!this.currentThreadId) return null;
		return this.threads.get(this.currentThreadId) || null;
	}

	async switchToThread(threadId: string): Promise<void> {
		if (!this.threads.has(threadId)) {
			throw new Error(`Thread ${threadId} not found`);
		}
		this.currentThreadId = threadId;
		await this.saveCurrentThread();
	}

	async getAllThreads(): Promise<ConversationThread[]> {
		return Array.from(this.threads.values()).sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	}

	async deleteThread(threadId: string): Promise<void> {
		this.threads.delete(threadId);

		// Delete associated branches
		for (const [branchId, branch] of this.branches) {
			if (branch.threadId === threadId) {
				this.branches.delete(branchId);
			}
		}

		// Switch to another thread if current was deleted
		if (this.currentThreadId === threadId) {
			const remaining = await this.getAllThreads();
			this.currentThreadId = remaining.length > 0 ? remaining[0].id : null;
		}

		await this.saveToStorage();
	}

	async updateThreadTitle(threadId: string, title: string): Promise<void> {
		const thread = this.threads.get(threadId);
		if (!thread) throw new Error(`Thread ${threadId} not found`);

		thread.title = title;
		thread.updatedAt = new Date().toISOString();
		await this.saveToStorage();
	}

	// Message management
	async addMessageToThread(threadId: string, message: ChatMessage): Promise<void> {
		const thread = this.threads.get(threadId);
		if (!thread) throw new Error(`Thread ${threadId} not found`);

		thread.messages.push(message);
		thread.updatedAt = new Date().toISOString();

		// Update metadata
		if (thread.metadata) {
			if (message.metadata?.tokens) {
				thread.metadata.totalTokens =
					(thread.metadata.totalTokens || 0) +
					message.metadata.tokens.input +
					message.metadata.tokens.output;
			}
		}

		// Trim old messages if over limit
		if (thread.messages.length > this.settings.maxMessagesPerThread) {
			thread.messages = thread.messages.slice(-this.settings.maxMessagesPerThread);
		}

		await this.saveToStorage();
	}

	async updateMessageInThread(
		threadId: string,
		messageId: string,
		updates: Partial<ChatMessage>
	): Promise<void> {
		const thread = this.threads.get(threadId);
		if (!thread) throw new Error(`Thread ${threadId} not found`);

		const messageIndex = thread.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) throw new Error(`Message ${messageId} not found`);

		thread.messages[messageIndex] = { ...thread.messages[messageIndex], ...updates };
		thread.updatedAt = new Date().toISOString();
		await this.saveToStorage();
	}

	// Search functionality
	async searchConversations(filter: ConversationSearchFilter): Promise<ConversationThread[]> {
		let results = Array.from(this.threads.values());

		// Text search
		if (filter.query) {
			const query = filter.query.toLowerCase();
			results = results.filter(
				(thread) =>
					thread.title.toLowerCase().includes(query) ||
					thread.messages.some((msg) => msg.content.toLowerCase().includes(query))
			);
		}

		// Date filtering
		if (filter.dateFrom) {
			const fromDate = new Date(filter.dateFrom);
			results = results.filter((thread) => new Date(thread.createdAt) >= fromDate);
		}

		if (filter.dateTo) {
			const toDate = new Date(filter.dateTo);
			results = results.filter((thread) => new Date(thread.createdAt) <= toDate);
		}

		// Tag filtering
		if (filter.tags && filter.tags.length > 0) {
			results = results.filter((thread) =>
				thread.metadata?.tags?.some((tag) => filter.tags!.includes(tag))
			);
		}

		// Participant filtering
		if (filter.participantType && filter.participantType !== 'both') {
			results = results.filter((thread) =>
				thread.messages.some((msg) => msg.role === filter.participantType)
			);
		}

		return results.sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	}

	// Export functionality
	async exportThread(threadId: string, format: 'markdown' | 'json'): Promise<string> {
		const thread = this.threads.get(threadId);
		if (!thread) throw new Error(`Thread ${threadId} not found`);

		if (format === 'json') {
			return JSON.stringify(thread, null, 2);
		}

		// Markdown export
		let markdown = `# ${thread.title}\n\n`;
		markdown += `**Created**: ${new Date(thread.createdAt).toLocaleString()}\n`;
		markdown += `**Updated**: ${new Date(thread.updatedAt).toLocaleString()}\n`;
		markdown += `**Messages**: ${thread.messages.length}\n\n`;

		if (thread.metadata?.totalTokens) {
			markdown += `**Total Tokens**: ${thread.metadata.totalTokens}\n\n`;
		}

		markdown += '---\n\n';

		for (const message of thread.messages) {
			const timestamp = new Date(message.timestamp).toLocaleString();
			const role = message.role === 'user' ? '👤 User' : '🤖 Assistant';

			markdown += `## ${role} - ${timestamp}\n\n`;
			markdown += `${message.content}\n\n`;

			if (message.metadata?.toolCalls && message.metadata.toolCalls.length > 0) {
				markdown += '### Tool Calls\n\n';
				for (const tool of message.metadata.toolCalls) {
					markdown += `- **${tool.name}**: ${JSON.stringify(tool.arguments, null, 2)}\n`;
					if (tool.result) {
						markdown += `  - Result: ${JSON.stringify(tool.result, null, 2)}\n`;
					}
					if (tool.error) {
						markdown += `  - Error: ${tool.error}\n`;
					}
				}
				markdown += '\n';
			}

			if (message.error) {
				markdown += `**Error**: ${message.error}\n\n`;
			}

			markdown += '---\n\n';
		}

		return markdown;
	}

	// Branch management
	async createBranch(
		threadId: string,
		parentMessageId: string,
		title?: string
	): Promise<ConversationBranch> {
		const thread = this.threads.get(threadId);
		if (!thread) throw new Error(`Thread ${threadId} not found`);

		const parentIndex = thread.messages.findIndex((m) => m.id === parentMessageId);
		if (parentIndex === -1) throw new Error(`Parent message ${parentMessageId} not found`);

		const branch: ConversationBranch = {
			id: crypto.randomUUID(),
			parentMessageId,
			threadId,
			title: title || `Branch from ${new Date().toLocaleString()}`,
			messages: thread.messages.slice(0, parentIndex + 1), // Include parent message
			createdAt: new Date().toISOString()
		};

		this.branches.set(branch.id, branch);
		await this.saveToStorage();
		return branch;
	}

	async getBranches(threadId: string): Promise<ConversationBranch[]> {
		return Array.from(this.branches.values())
			.filter((branch) => branch.threadId === threadId)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}

	// Storage management
	private loadFromStorage(): void {
		try {
			// Load threads
			const threadsData = localStorage.getItem(STORAGE_KEYS.THREADS);
			if (threadsData) {
				const threadArray: ConversationThread[] = JSON.parse(threadsData);
				this.threads = new Map(threadArray.map((t) => [t.id, t]));
			}

			// Load branches
			const branchesData = localStorage.getItem(STORAGE_KEYS.BRANCHES);
			if (branchesData) {
				const branchArray: ConversationBranch[] = JSON.parse(branchesData);
				this.branches = new Map(branchArray.map((b) => [b.id, b]));
			}

			// Load current thread
			this.currentThreadId = localStorage.getItem(STORAGE_KEYS.CURRENT_THREAD);

			// Load settings
			const settingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
			if (settingsData) {
				this.settings = { ...this.settings, ...JSON.parse(settingsData) };
			}
		} catch (error) {
			console.warn('Failed to load conversation data from storage:', error);
		}
	}

	private async saveToStorage(): Promise<void> {
		if (!browser) return;

		try {
			// Save threads
			const threadArray = Array.from(this.threads.values());
			localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(threadArray));

			// Save branches
			const branchArray = Array.from(this.branches.values());
			localStorage.setItem(STORAGE_KEYS.BRANCHES, JSON.stringify(branchArray));

			// Save current thread
			if (this.currentThreadId) {
				localStorage.setItem(STORAGE_KEYS.CURRENT_THREAD, this.currentThreadId);
			}

			// Cleanup old threads if over limit
			if (threadArray.length > this.settings.maxThreads) {
				const sorted = threadArray.sort(
					(a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
				);
				const toDelete = sorted.slice(0, threadArray.length - this.settings.maxThreads);
				for (const thread of toDelete) {
					this.threads.delete(thread.id);
				}
				// Re-save after cleanup
				localStorage.setItem(
					STORAGE_KEYS.THREADS,
					JSON.stringify(Array.from(this.threads.values()))
				);
			}
		} catch (error) {
			console.warn('Failed to save conversation data to storage:', error);
		}
	}

	private async saveCurrentThread(): Promise<void> {
		if (!browser) return;
		if (this.currentThreadId) {
			localStorage.setItem(STORAGE_KEYS.CURRENT_THREAD, this.currentThreadId);
		}
	}

	private setupAutoSave(): void {
		if (this.autoSaveIntervalId) {
			clearInterval(this.autoSaveIntervalId);
		}
		this.autoSaveIntervalId = setInterval(() => {
			this.saveToStorage();
		}, this.settings.autoSaveInterval) as unknown as number;
	}

	// Cleanup method to prevent memory leaks
	destroy(): void {
		if (this.autoSaveIntervalId) {
			clearInterval(this.autoSaveIntervalId);
			this.autoSaveIntervalId = null;
		}
	}

	// Utility methods
	async getStorageSize(): Promise<number> {
		if (!browser) return 0;

		try {
			const data = [
				localStorage.getItem(STORAGE_KEYS.THREADS) || '',
				localStorage.getItem(STORAGE_KEYS.BRANCHES) || '',
				localStorage.getItem(STORAGE_KEYS.CURRENT_THREAD) || '',
				localStorage.getItem(STORAGE_KEYS.SETTINGS) || ''
			].join('');
			return new Blob([data]).size;
		} catch (error) {
			console.warn('Failed to calculate storage size:', error);
			return 0;
		}
	}

	async clearAllData(): Promise<void> {
		this.threads.clear();
		this.branches.clear();
		this.currentThreadId = null;

		if (browser) {
			try {
				Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
			} catch (error) {
				console.warn('Failed to clear storage:', error);
			}
		}
	}
}

// Export singleton instance
export const conversationPersistence = new ConversationPersistenceService();

// Cleanup function for memory leak prevention
if (browser && typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		conversationPersistence.destroy();
	});
}
