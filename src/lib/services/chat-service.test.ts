import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatServiceImpl } from './chat-service';
import type { ChatMessage, ConversationThread } from '$lib/types/chat';

// Mock dependencies
vi.mock('./claude-api-service', () => ({
	claudeApiService: {
		isConfigured: vi.fn(() => false),
		getConnectionStatus: vi.fn(() => 'disconnected' as const),
		updateApiKey: vi.fn(),
		getApiKeyInfo: vi.fn(),
		clearApiKey: vi.fn()
	}
}));

vi.mock('./conversation-persistence', () => ({
	conversationPersistence: {
		createThread: vi.fn(),
		getCurrentThread: vi.fn(),
		getAllThreads: vi.fn(),
		addMessageToThread: vi.fn(),
		updateThreadTitle: vi.fn(),
		deleteThread: vi.fn(),
		switchToThread: vi.fn(),
		searchConversations: vi.fn(),
		exportThread: vi.fn()
	}
}));

vi.mock('./file-processing-service', () => ({
	fileProcessingService: {
		processFile: vi.fn()
	}
}));

// Mock MCP client with sendRequest method
vi.mock('./mcp-client', () => ({
	mcpClient: {
		sendRequest: vi.fn(),
		isConnected: vi.fn(),
		connect: vi.fn()
	}
}));

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

describe('ChatServiceImpl - MCP Integration', () => {
	let chatService: ChatServiceImpl;
	let mockSendRequest: any;
	let mockIsConnected: any;
	let mockConnect: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Get the mocked MCP client
		const { mcpClient } = await import('./mcp-client');
		mockSendRequest = vi.mocked(mcpClient.sendRequest);
		mockIsConnected = vi.mocked(mcpClient.isConnected);
		mockConnect = vi.mocked(mcpClient.connect);

		// Default MCP client mocks
		mockIsConnected.mockReturnValue(false);
		mockConnect.mockResolvedValue(undefined);

		chatService = new ChatServiceImpl();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('MCP Storage Integration', () => {
		test('should use MCP storage when connected', async () => {
			// Setup MCP connected
			mockIsConnected.mockReturnValue(true);
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, thread: null }) }]
			});

			const service = new ChatServiceImpl();

			expect(mockSendRequest).toHaveBeenCalledWith('chat/get_current_thread', {});
		});

		test('should fallback to localStorage when MCP not connected', async () => {
			// Clear previous mocks and setup fresh state
			vi.clearAllMocks();

			// MCP not connected
			mockIsConnected.mockReturnValue(false);
			mockConnect.mockRejectedValue(new Error('MCP unavailable'));

			const { conversationPersistence } = await import('./conversation-persistence');
			const mockGetCurrentThread = vi.mocked(conversationPersistence.getCurrentThread);
			mockGetCurrentThread.mockResolvedValue(null);

			// Create new service with fresh mock state
			const service = new ChatServiceImpl();

			// Wait for initialization to complete
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify localStorage was used instead of MCP
			expect(mockGetCurrentThread).toHaveBeenCalled();
		});
	});

	describe('extractMCPData method', () => {
		test('should extract JSON from MCP response format', () => {
			const testData = { success: true, thread: { id: 'test', title: 'Test Thread' } };
			const mcpResponse = {
				content: [{ text: JSON.stringify(testData) }]
			};

			// Access private method for testing
			const result = (chatService as any).extractMCPData(mcpResponse);

			expect(result).toEqual(testData);
		});

		test('should handle non-JSON text in MCP response', () => {
			const mcpResponse = {
				content: [{ text: 'plain text response' }]
			};

			const result = (chatService as any).extractMCPData(mcpResponse);

			expect(result).toBe('plain text response');
		});

		test('should handle missing content in MCP response', () => {
			const mcpResponse = { someOtherField: 'value' };

			const result = (chatService as any).extractMCPData(mcpResponse);

			expect(result).toEqual(mcpResponse);
		});

		test('should handle empty content array', () => {
			const mcpResponse = { content: [] };

			const result = (chatService as any).extractMCPData(mcpResponse);

			expect(result).toEqual(mcpResponse);
		});
	});

	describe('Thread Management via MCP', () => {
		beforeEach(() => {
			mockIsConnected.mockReturnValue(true);
		});

		test('should create new thread via MCP', async () => {
			const mockThread = {
				id: 'thread-123',
				title: 'New Thread',
				messages: [],
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-01T00:00:00Z'
			};

			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, thread: mockThread }) }]
			});

			const result = await chatService.createNewThread('New Thread');

			expect(mockSendRequest).toHaveBeenCalledWith('chat/create_thread', { title: 'New Thread' });
			expect(result).toEqual(mockThread);
		});

		test('should fallback to localStorage when MCP create_thread fails', async () => {
			mockSendRequest.mockRejectedValue(new Error('MCP error'));

			const { conversationPersistence } = await import('./conversation-persistence');
			const mockCreateThread = vi.mocked(conversationPersistence.createThread);
			const fallbackThread = {
				id: 'local-thread',
				title: 'Fallback',
				messages: [],
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-01T00:00:00Z'
			} as ConversationThread;
			mockCreateThread.mockResolvedValue(fallbackThread);

			const result = await chatService.createNewThread('New Thread');

			expect(mockCreateThread).toHaveBeenCalledWith('New Thread');
			expect(result).toEqual(fallbackThread);
		});

		test('should get all threads via MCP', async () => {
			const mockThreads = [
				{ id: 'thread-1', title: 'Thread 1', messages: [] },
				{ id: 'thread-2', title: 'Thread 2', messages: [] }
			];

			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, threads: mockThreads }) }]
			});

			const result = await chatService.getAllThreads();

			expect(mockSendRequest).toHaveBeenCalledWith('chat/get_threads', {});
			expect(result).toEqual(mockThreads);
		});

		test('should switch threads via MCP', async () => {
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true }) }]
			});

			await chatService.switchToThread('thread-123');

			expect(mockSendRequest).toHaveBeenCalledWith('chat/switch_thread', {
				thread_id: 'thread-123'
			});
		});

		test('should delete thread via MCP', async () => {
			// Mock current thread response
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, thread: null }) }]
			});

			await chatService.deleteThread('thread-123');

			expect(mockSendRequest).toHaveBeenCalledWith('chat/delete_thread', {
				thread_id: 'thread-123'
			});
		});

		test('should update thread title via MCP', async () => {
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true }) }]
			});

			await chatService.updateThreadTitle('thread-123', 'Updated Title');

			expect(mockSendRequest).toHaveBeenCalledWith('chat/update_thread_title', {
				thread_id: 'thread-123',
				title: 'Updated Title'
			});
		});

		test('should search conversations via MCP', async () => {
			const mockResults = [{ id: 'thread-1', title: 'Found Thread', messages: [] }];
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, threads: mockResults }) }]
			});

			const filter = { query: 'test search' };
			const result = await chatService.searchConversations(filter);

			expect(mockSendRequest).toHaveBeenCalledWith('chat/search_conversations', filter);
			expect(result).toEqual(mockResults);
		});

		test('should export thread via MCP', async () => {
			const mockContent = '# Thread Export\n\nContent here...';
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, content: mockContent }) }]
			});

			const result = await chatService.exportThread('thread-123', 'markdown');

			expect(mockSendRequest).toHaveBeenCalledWith('chat/export_thread', {
				thread_id: 'thread-123',
				format: 'markdown'
			});
			expect(result).toBe(mockContent);
		});

		test('should get storage stats via MCP', async () => {
			const mockStats = { threadCount: 5, messageCount: 25, storageSize: 1024 };
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ success: true, stats: mockStats }) }]
			});

			const result = await chatService.getStorageStats();

			expect(mockSendRequest).toHaveBeenCalledWith('chat/get_storage_stats', {});
			expect(result).toEqual({
				storageType: 'database',
				...mockStats
			});
		});
	});

	describe('Message Persistence via MCP', () => {
		beforeEach(() => {
			mockIsConnected.mockReturnValue(true);

			// Setup current thread
			const mockThread = {
				id: 'thread-123',
				title: 'Test Thread',
				messages: [],
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-01T00:00:00Z'
			};
			(chatService as any).currentThread = mockThread;
		});

		test('should persist messages to MCP bridge', async () => {
			const testMessage: ChatMessage = {
				id: 'msg-123',
				role: 'user',
				content: 'Test message',
				timestamp: new Date().toISOString()
			};

			// Mock successful MCP responses
			mockSendRequest
				.mockResolvedValueOnce({ content: [{ text: 'success' }] }) // add_message
				.mockResolvedValueOnce({
					// get_current_thread
					content: [
						{
							text: JSON.stringify({
								success: true,
								thread: {
									id: 'thread-123',
									title: 'Test Thread',
									messages: [testMessage],
									createdAt: '2025-01-01T00:00:00Z',
									updatedAt: '2025-01-01T00:00:00Z'
								}
							})
						}
					]
				});

			// Access private method for testing
			await (chatService as any).persistCurrentMessage(testMessage);

			expect(mockSendRequest).toHaveBeenCalledWith('chat/add_message', {
				thread_id: 'thread-123',
				message: testMessage
			});
			expect(mockSendRequest).toHaveBeenCalledWith('chat/get_current_thread', {});
		});

		test('should fallback to localStorage when MCP message persistence fails', async () => {
			const testMessage: ChatMessage = {
				id: 'msg-123',
				role: 'user',
				content: 'Test message',
				timestamp: new Date().toISOString()
			};

			mockSendRequest.mockRejectedValue(new Error('MCP error'));

			const { conversationPersistence } = await import('./conversation-persistence');
			const mockAddMessage = vi.mocked(conversationPersistence.addMessageToThread);
			const mockGetCurrentThread = vi.mocked(conversationPersistence.getCurrentThread);
			mockGetCurrentThread.mockResolvedValue({
				id: 'thread-123',
				title: 'Test Thread',
				messages: [testMessage],
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-01T00:00:00Z'
			});

			// Access private method for testing
			await (chatService as any).persistCurrentMessage(testMessage);

			expect(mockAddMessage).toHaveBeenCalledWith('thread-123', testMessage);
		});
	});

	describe('Connection Status and Error Handling', () => {
		test('should handle MCP connection failures gracefully', async () => {
			mockIsConnected.mockReturnValue(false);
			mockConnect.mockRejectedValue(new Error('Connection failed'));

			const { conversationPersistence } = await import('./conversation-persistence');
			const mockCreateThread = vi.mocked(conversationPersistence.createThread);
			mockCreateThread.mockResolvedValue({
				id: 'local-thread',
				title: 'Local Thread',
				messages: [],
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-01T00:00:00Z'
			});

			const service = new ChatServiceImpl();

			// Should not crash and should use localStorage fallback
			expect(mockConnect).toHaveBeenCalled();
			expect(mockCreateThread).toHaveBeenCalled();
		});

		test('should handle malformed MCP responses', async () => {
			mockIsConnected.mockReturnValue(true);
			mockSendRequest.mockResolvedValue({
				content: [{ text: 'invalid json {' }]
			});

			const result = await chatService.getAllThreads();

			// Should fallback to localStorage when MCP returns invalid data
			const { conversationPersistence } = await import('./conversation-persistence');
			expect(vi.mocked(conversationPersistence.getAllThreads)).toHaveBeenCalled();
		});

		test('should handle missing success field in MCP response', async () => {
			mockIsConnected.mockReturnValue(true);
			mockSendRequest.mockResolvedValue({
				content: [{ text: JSON.stringify({ threads: [] }) }] // missing success field
			});

			const result = await chatService.getAllThreads();

			// Should fallback to localStorage when response doesn't indicate success
			const { conversationPersistence } = await import('./conversation-persistence');
			expect(vi.mocked(conversationPersistence.getAllThreads)).toHaveBeenCalled();
		});
	});

	describe('Reactive Stores', () => {
		test('should expose reactive message store', () => {
			const messageStore = chatService.messagesStore;
			expect(messageStore).toBeDefined();
			expect(typeof messageStore.subscribe).toBe('function');
		});

		test('should expose reactive connection status store', () => {
			const statusStore = chatService.connectionStatusStore;
			expect(statusStore).toBeDefined();
			expect(typeof statusStore.subscribe).toBe('function');
		});

		test('should return current connection status', () => {
			const status = chatService.getConnectionStatus();
			expect(['connected', 'disconnected', 'checking']).toContain(status);
		});
	});

	describe('Migration Status', () => {
		test('should return no migration needed for MCP architecture', async () => {
			// Mock conversation persistence for migration status
			const { conversationPersistence } = await import('./conversation-persistence');
			const mockGetAllThreads = vi.mocked(conversationPersistence.getAllThreads);
			mockGetAllThreads.mockResolvedValue([]);

			const status = await chatService.getMigrationStatus();

			expect(status).toEqual({
				isNeeded: false,
				localStorageThreads: 0,
				localStorageMessages: 0,
				databaseThreads: 0,
				databaseMessages: 0,
				migrationStatus: 'browser-not-supported'
			});
		});
	});
});
