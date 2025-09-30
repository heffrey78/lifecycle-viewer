import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ClaudeApiService } from './claude-api-service';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			messages: {
				create: vi.fn().mockResolvedValue({
					// Mock simple streaming response
					[Symbol.asyncIterator]: async function* () {
						yield { type: 'content_block_start', content_block: { type: 'text' } };
						yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello! ' } };
						yield {
							type: 'content_block_delta',
							delta: { type: 'text_delta', text: 'How can I help?' }
						};
						yield { type: 'content_block_stop' };
					}
				})
			}
		}))
	};
});

// Mock MCP client
vi.mock('./mcp-client', () => ({
	mcpClient: {
		getRequirements: vi.fn().mockResolvedValue({ success: true, data: [] }),
		isConnected: vi.fn().mockReturnValue(false),
		sendRequest: vi.fn().mockResolvedValue({ success: true })
	}
}));

// Mock api-key-manager
vi.mock('./api-key-manager', () => ({
	apiKeyManager: {
		validateApiKey: vi.fn().mockReturnValue({ isValid: true }),
		storeApiKey: vi.fn().mockResolvedValue(undefined),
		getApiKey: vi.fn().mockResolvedValue('sk-ant-api03-test-key'),
		clearApiKey: vi.fn().mockResolvedValue(undefined)
	}
}));

// Mock encryption service
vi.mock('./encryption-service', () => ({
	encryptionService: {
		isSupported: vi.fn().mockReturnValue(true),
		generateMasterPassword: vi.fn().mockReturnValue('test-master-password'),
		encryptData: vi.fn().mockResolvedValue({
			encryptedData: 'encrypted-data',
			keyHash: 'key-hash'
		})
	}
}));

// Mock tool discovery
vi.mock('./mcp-tool-discovery', () => ({
	mcpToolDiscoveryService: {
		getDiscoverer: vi.fn().mockReturnValue({
			discoverTools: vi.fn().mockResolvedValue([
				{
					name: 'query_requirements',
					description: 'Query requirements',
					inputSchema: { type: 'object', properties: {} }
				}
			])
		})
	}
}));

describe('ClaudeApiService', () => {
	let service: ClaudeApiService;

	beforeEach(() => {
		service = new ClaudeApiService();
	});

	test('should initialize without configuration', () => {
		expect(service.isConfigured()).toBe(false);
		expect(service.getConnectionStatus()).toBe('disconnected');
	});

	test('should configure with API key', () => {
		service.configure({ apiKey: 'sk-ant-api03-test-key-1234567890abcdef1234567890abcdef' });

		expect(service.isConfigured()).toBe(true);
		expect(service.getConnectionStatus()).toBe('connected');
	});

	test('should update API key', async () => {
		service.configure({ apiKey: 'sk-ant-api03-test-key-1234567890abcdef1234567890abcdef' });
		await service.updateApiKey('sk-ant-api03-test-key-2-1234567890abcdef1234567890abcdef');

		expect(service.isConfigured()).toBe(true);
	});

	test('should return configuration without API key', () => {
		service.configure({
			apiKey: 'sk-ant-api03-secret-key-1234567890abcdef1234567890abcdef',
			model: 'claude-3-sonnet-20240229',
			temperature: 0.5
		});

		const config = service.getConfig();
		expect(config).toEqual({
			model: 'claude-3-sonnet-20240229',
			maxTokens: 4000,
			temperature: 0.5,
			systemPrompt: expect.any(String)
		});
		expect(config).not.toHaveProperty('apiKey');
	});

	test('should throw error when sending message without configuration', async () => {
		await expect(service.sendMessage('Hello')).rejects.toThrow('Claude API not configured');
	});

	test('should send message when configured', async () => {
		service.configure({ apiKey: 'sk-ant-api03-test-key-1234567890abcdef1234567890abcdef' });

		const response = await service.sendMessage('Hello', [], {
			onStart: vi.fn(),
			onToken: vi.fn(),
			onComplete: vi.fn()
		});

		expect(response).toMatchObject({
			id: expect.any(String),
			role: 'assistant',
			content: 'Hello! How can I help?',
			timestamp: expect.any(String)
		});
	});
});
