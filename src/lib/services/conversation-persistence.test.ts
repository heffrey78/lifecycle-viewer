import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ConversationPersistenceService } from './conversation-persistence';
import type { ChatMessage } from '$lib/types/chat';

// Mock browser environment and localStorage
const mockLocalStorage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		}
	};
})();

Object.defineProperty(globalThis, 'localStorage', {
	value: mockLocalStorage
});

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2)
	}
});

describe('ConversationPersistenceService', () => {
	let service: ConversationPersistenceService;

	beforeEach(() => {
		mockLocalStorage.clear();
		service = new ConversationPersistenceService();
	});

	test('should create a new thread', async () => {
		const thread = await service.createThread('Test Thread');

		expect(thread).toMatchObject({
			id: expect.any(String),
			title: 'Test Thread',
			messages: [],
			createdAt: expect.any(String),
			updatedAt: expect.any(String)
		});

		expect(thread.metadata).toMatchObject({
			totalTokens: 0,
			averageResponseTime: 0,
			tags: []
		});
	});

	test('should get current thread after creation', async () => {
		const thread = await service.createThread('Test Thread');
		const currentThread = await service.getCurrentThread();

		expect(currentThread).toEqual(thread);
	});

	test('should switch between threads', async () => {
		const thread1 = await service.createThread('Thread 1');
		const thread2 = await service.createThread('Thread 2');

		// Should be on thread2 initially (last created)
		expect((await service.getCurrentThread())?.id).toBe(thread2.id);

		// Switch to thread1
		await service.switchToThread(thread1.id);
		expect((await service.getCurrentThread())?.id).toBe(thread1.id);
	});

	test('should get all threads sorted by update time', async () => {
		const thread1 = await service.createThread('Thread 1');

		// Add small delay to ensure different timestamps
		await new Promise((resolve) => setTimeout(resolve, 10));

		const thread2 = await service.createThread('Thread 2');

		const allThreads = await service.getAllThreads();

		expect(allThreads).toHaveLength(2);
		expect(allThreads[0].id).toBe(thread2.id); // Most recent first
		expect(allThreads[1].id).toBe(thread1.id);
	});

	test('should add message to thread', async () => {
		const thread = await service.createThread('Test Thread');

		const message: ChatMessage = {
			id: 'msg-1',
			role: 'user',
			content: 'Hello, world!',
			timestamp: new Date().toISOString()
		};

		await service.addMessageToThread(thread.id, message);

		const updatedThread = await service.getCurrentThread();
		expect(updatedThread?.messages).toHaveLength(1);
		expect(updatedThread?.messages[0]).toEqual(message);
	});

	test('should update thread title', async () => {
		const thread = await service.createThread('Original Title');

		await service.updateThreadTitle(thread.id, 'Updated Title');

		const updatedThread = await service.getCurrentThread();
		expect(updatedThread?.title).toBe('Updated Title');
	});

	test('should delete thread and switch to remaining thread', async () => {
		const thread1 = await service.createThread('Thread 1');
		const thread2 = await service.createThread('Thread 2');

		await service.deleteThread(thread2.id);

		const remainingThreads = await service.getAllThreads();
		expect(remainingThreads).toHaveLength(1);
		expect(remainingThreads[0].id).toBe(thread1.id);

		// Should switch to remaining thread
		const currentThread = await service.getCurrentThread();
		expect(currentThread?.id).toBe(thread1.id);
	});

	test('should search conversations by query', async () => {
		const thread1 = await service.createThread('Project Planning');
		const thread2 = await service.createThread('Bug Fixes');

		// Add messages to make search more interesting
		await service.addMessageToThread(thread1.id, {
			id: 'msg-1',
			role: 'user',
			content: "Let's plan the architecture",
			timestamp: new Date().toISOString()
		});

		await service.addMessageToThread(thread2.id, {
			id: 'msg-2',
			role: 'user',
			content: 'Fix the login bug',
			timestamp: new Date().toISOString()
		});

		// Search by title
		const projectResults = await service.searchConversations({ query: 'project' });
		expect(projectResults).toHaveLength(1);
		expect(projectResults[0].id).toBe(thread1.id);

		// Search by message content
		const archResults = await service.searchConversations({ query: 'architecture' });
		expect(archResults).toHaveLength(1);
		expect(archResults[0].id).toBe(thread1.id);

		// Search with no matches
		const noResults = await service.searchConversations({ query: 'nonexistent' });
		expect(noResults).toHaveLength(0);
	});

	test('should export thread as markdown', async () => {
		const thread = await service.createThread('Test Export');

		await service.addMessageToThread(thread.id, {
			id: 'msg-1',
			role: 'user',
			content: 'Hello',
			timestamp: new Date().toISOString()
		});

		await service.addMessageToThread(thread.id, {
			id: 'msg-2',
			role: 'assistant',
			content: 'Hi there!',
			timestamp: new Date().toISOString()
		});

		const markdown = await service.exportThread(thread.id, 'markdown');

		expect(markdown).toContain('# Test Export');
		expect(markdown).toContain('## 👤 User');
		expect(markdown).toContain('## 🤖 Assistant');
		expect(markdown).toContain('Hello');
		expect(markdown).toContain('Hi there!');
	});

	test('should export thread as JSON', async () => {
		const thread = await service.createThread('Test Export');

		const json = await service.exportThread(thread.id, 'json');
		const parsedData = JSON.parse(json);

		expect(parsedData).toMatchObject({
			id: thread.id,
			title: 'Test Export',
			messages: [],
			createdAt: expect.any(String),
			updatedAt: expect.any(String)
		});
	});

	test('should create branch from thread', async () => {
		const thread = await service.createThread('Main Thread');

		const message: ChatMessage = {
			id: 'msg-1',
			role: 'user',
			content: 'Original message',
			timestamp: new Date().toISOString()
		};

		await service.addMessageToThread(thread.id, message);

		const branch = await service.createBranch(thread.id, message.id, 'Alternative Approach');

		expect(branch).toMatchObject({
			id: expect.any(String),
			parentMessageId: message.id,
			threadId: thread.id,
			title: 'Alternative Approach',
			messages: [message],
			createdAt: expect.any(String)
		});
	});

	test('should persist data to localStorage', async () => {
		const thread = await service.createThread('Persistent Thread');

		// Create new service instance to test loading from storage
		const newService = new ConversationPersistenceService();
		const loadedThreads = await newService.getAllThreads();

		expect(loadedThreads).toHaveLength(1);
		expect(loadedThreads[0].title).toBe('Persistent Thread');
	});
});
