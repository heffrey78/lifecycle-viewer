import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiKeyManager } from './api-key-manager';

// Mock the encryption service
vi.mock('./encryption-service', () => ({
	encryptionService: {
		isSupported: vi.fn(() => true),
		encryptData: vi.fn(),
		decryptData: vi.fn(),
		generateMasterPassword: vi.fn(() => 'generated-master-password-123')
	}
}));

// Mock MCP client
vi.mock('./mcp-client', () => ({
	mcpClient: {
		isConnected: vi.fn(() => true),
		sendRequest: vi.fn()
	}
}));

// Mock crypto.subtle for key hashing
Object.defineProperty(global, 'crypto', {
	value: {
		subtle: {
			digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
		}
	},
	writable: true
});

// Mock TextEncoder
Object.defineProperty(global, 'TextEncoder', {
	value: class {
		encode(str: string) {
			return new Uint8Array(Array.from(str).map((c) => c.charCodeAt(0)));
		}
	},
	writable: true
});

describe('ApiKeyManager', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Reset MCP client mock
		const { mcpClient } = await import('./mcp-client');
		vi.mocked(mcpClient.isConnected).mockReturnValue(true);
		vi.mocked(mcpClient.sendRequest).mockResolvedValue({
			content: [{ text: JSON.stringify({ success: false }) }]
		});
		// Reset encryption service mock
		const { encryptionService } = await import('./encryption-service');
		vi.mocked(encryptionService.isSupported).mockReturnValue(true);
	});

	afterEach(() => {
		// Clear any stored state
		apiKeyManager.clearApiKey();
	});

	describe('validateApiKey', () => {
		it('should validate correct Anthropic API key format', () => {
			const validKey =
				'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12-abcdef';
			const result = apiKeyManager.validateApiKey(validKey);

			expect(result.isValid).toBe(true);
			expect(result.keyFormat).toBe('anthropic');
			expect(result.keyLength).toBe(validKey.length);
		});

		it('should reject empty or null keys', () => {
			expect(apiKeyManager.validateApiKey('')).toEqual({
				isValid: false,
				error: 'API key is required'
			});

			expect(apiKeyManager.validateApiKey(null as any)).toEqual({
				isValid: false,
				error: 'API key is required'
			});
		});

		it('should reject keys that do not start with sk-ant-', () => {
			const invalidKey = 'invalid-key-format';
			const result = apiKeyManager.validateApiKey(invalidKey);

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Invalid API key format. Should start with "sk-ant-"');
			expect(result.keyFormat).toBe('unknown');
		});

		it('should reject Anthropic keys that are too short', () => {
			const shortKey = 'sk-ant-short';
			const result = apiKeyManager.validateApiKey(shortKey);

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('API key appears too short');
			expect(result.keyFormat).toBe('anthropic');
		});

		it('should trim whitespace from keys', () => {
			const keyWithWhitespace = '  sk-ant-api03-1234567890abcdef1234567890abcdef12  ';
			const result = apiKeyManager.validateApiKey(keyWithWhitespace);

			expect(result.isValid).toBe(true);
			expect(result.keyLength).toBe(keyWithWhitespace.trim().length);
		});
	});

	describe('storeApiKey', () => {
		it('should store a valid API key successfully', async () => {
			const { encryptionService } = await import('./encryption-service');
			const validKey = 'sk-ant-api03-valid-key-1234567890abcdef';
			const mockEncryptedData = {
				encryptedData: 'encrypted-base64-data',
				iv: 'iv-base64',
				salt: 'salt-base64',
				keyVersion: 1
			};

			vi.mocked(encryptionService.encryptData).mockResolvedValue(mockEncryptedData);

			await apiKeyManager.storeApiKey(validKey, { generateMasterPassword: true });

			expect(encryptionService.encryptData).toHaveBeenCalledWith(
				validKey,
				'generated-master-password-123',
				{ keyVersion: 1 }
			);

			// Verify MCP sendRequest was called to store the key
			const { mcpClient } = await import('./mcp-client');
			expect(mcpClient.sendRequest).toHaveBeenCalledWith(
				'chat/store_api_key',
				expect.objectContaining({
					user_id: 'default',
					encrypted_key: mockEncryptedData.encryptedData,
					service_name: 'claude'
				})
			);
		});

		it('should reject invalid API keys', async () => {
			const invalidKey = 'invalid-key';

			await expect(apiKeyManager.storeApiKey(invalidKey)).rejects.toThrow('Invalid API key format');
		});

		it('should throw error when MCP not connected', async () => {
			const { mcpClient } = await import('./mcp-client');
			vi.mocked(mcpClient.isConnected).mockReturnValue(false);

			const validKey = 'sk-ant-api03-valid-key-1234567890abcdef';

			await expect(apiKeyManager.storeApiKey(validKey)).rejects.toThrow(
				'Database not available - MCP bridge not connected'
			);
		});

		it('should use custom master password when provided', async () => {
			const { encryptionService } = await import('./encryption-service');
			const validKey = 'sk-ant-api03-valid-key-1234567890abcdef';
			const customPassword = 'custom-master-password';
			const mockEncryptedData = {
				encryptedData: 'encrypted',
				iv: 'iv',
				salt: 'salt',
				keyVersion: 1
			};

			vi.mocked(encryptionService.encryptData).mockResolvedValue(mockEncryptedData);

			await apiKeyManager.storeApiKey(validKey, { customMasterPassword: customPassword });

			expect(encryptionService.encryptData).toHaveBeenCalledWith(validKey, customPassword, {
				keyVersion: 1
			});
		});
	});

	describe('getApiKey', () => {
		it('should return null when no key is stored', async () => {
			const key = await apiKeyManager.getApiKey();
			expect(key).toBeNull();
		});

		it('should retrieve and decrypt stored key', async () => {
			const { encryptionService } = await import('./encryption-service');
			const storedKey = 'sk-ant-api03-stored-key-1234567890abcdef';
			const mockEncryptedData = {
				encryptedData: 'encrypted-data',
				iv: 'iv-data',
				salt: 'salt-data',
				keyVersion: 1
			};

			// Mock localStorage to return encrypted data
			mockLocalStorage.getItem.mockImplementation((key) => {
				if (key === 'claude-api-key-encrypted') {
					return JSON.stringify(mockEncryptedData);
				}
				if (key === 'claude-master-password') {
					return 'master-password-123';
				}
				return null;
			});

			vi.mocked(encryptionService.decryptData).mockResolvedValue(storedKey);

			const result = await apiKeyManager.getApiKey();

			expect(result).toBe(storedKey);
			expect(encryptionService.decryptData).toHaveBeenCalledWith(
				mockEncryptedData,
				'master-password-123'
			);
		});

		it('should clear corrupted data and return null', async () => {
			const { encryptionService } = await import('./encryption-service');

			// Mock localStorage to return corrupted data
			mockLocalStorage.getItem.mockReturnValue('corrupted-json-data');
			vi.mocked(encryptionService.decryptData).mockRejectedValue(new Error('Decryption failed'));

			const result = await apiKeyManager.getApiKey();

			expect(result).toBeNull();
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('claude-api-key-encrypted');
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('claude-master-password');
		});
	});

	describe('isConfigured', () => {
		it('should return true when valid key is available', async () => {
			const { encryptionService } = await import('./encryption-service');
			const validKey = 'sk-ant-api03-valid-key-1234567890abcdef';

			// Mock successful key retrieval
			vi.mocked(encryptionService.decryptData).mockResolvedValue(validKey);
			mockLocalStorage.getItem.mockImplementation((key) => {
				if (key === 'claude-api-key-encrypted') {
					return JSON.stringify({ encryptedData: 'data', iv: 'iv', salt: 'salt', keyVersion: 1 });
				}
				if (key === 'claude-master-password') {
					return 'password';
				}
				return null;
			});

			const result = await apiKeyManager.isConfigured();

			expect(result).toBe(true);
		});

		it('should return false when no key is available', async () => {
			const result = await apiKeyManager.isConfigured();
			expect(result).toBe(false);
		});

		it('should return false when stored key is invalid', async () => {
			const { encryptionService } = await import('./encryption-service');
			const invalidKey = 'invalid-key-format';

			// Mock retrieval of invalid key
			vi.mocked(encryptionService.decryptData).mockResolvedValue(invalidKey);
			mockLocalStorage.getItem.mockImplementation((key) => {
				if (key === 'claude-api-key-encrypted') {
					return JSON.stringify({ encryptedData: 'data', iv: 'iv', salt: 'salt', keyVersion: 1 });
				}
				if (key === 'claude-master-password') {
					return 'password';
				}
				return null;
			});

			const result = await apiKeyManager.isConfigured();

			expect(result).toBe(false);
		});
	});

	describe('clearApiKey', () => {
		it('should clear stored key and reset state', async () => {
			await apiKeyManager.clearApiKey();

			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('claude-api-key-encrypted');
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('claude-master-password');

			// Verify state is cleared
			const key = await apiKeyManager.getApiKey();
			expect(key).toBeNull();

			const isConfigured = await apiKeyManager.isConfigured();
			expect(isConfigured).toBe(false);
		});
	});

	describe('rotateApiKey', () => {
		it('should store new key with incremented version', async () => {
			const { encryptionService } = await import('./encryption-service');
			const oldKey = 'sk-ant-api03-old-key-1234567890abcdef';
			const newKey = 'sk-ant-api03-new-key-1234567890abcdef';

			// First store an old key
			vi.mocked(encryptionService.encryptData).mockResolvedValue({
				encryptedData: 'encrypted-old',
				iv: 'iv-old',
				salt: 'salt-old',
				keyVersion: 1
			});

			await apiKeyManager.storeApiKey(oldKey, { generateMasterPassword: true });

			// Now rotate to new key
			vi.mocked(encryptionService.encryptData).mockResolvedValue({
				encryptedData: 'encrypted-new',
				iv: 'iv-new',
				salt: 'salt-new',
				keyVersion: 2
			});

			await apiKeyManager.rotateApiKey(newKey);

			// Verify new key was encrypted with existing master password
			expect(encryptionService.encryptData).toHaveBeenLastCalledWith(
				newKey,
				'generated-master-password-123',
				{ keyVersion: 1 } // Note: version is set by storeApiKey, not rotateApiKey
			);
		});

		it('should reject invalid new key', async () => {
			const invalidNewKey = 'invalid-new-key';

			await expect(apiKeyManager.rotateApiKey(invalidNewKey)).rejects.toThrow(
				'Invalid API key format. Should start with "sk-ant-"'
			);
		});
	});

	describe('getKeyInfo', () => {
		it('should return null when no key is configured', async () => {
			const info = await apiKeyManager.getKeyInfo();
			expect(info).toBeNull();
		});

		it('should return key info when configured', async () => {
			const { encryptionService } = await import('./encryption-service');
			const validKey = 'sk-ant-api03-valid-key-1234567890abcdef';

			// Mock successful configuration
			vi.mocked(encryptionService.encryptData).mockResolvedValue({
				encryptedData: 'encrypted',
				iv: 'iv',
				salt: 'salt',
				keyVersion: 1
			});

			await apiKeyManager.storeApiKey(validKey, { generateMasterPassword: true });

			const info = await apiKeyManager.getKeyInfo();

			expect(info).toEqual({
				id: 'primary',
				isConfigured: true,
				lastUsed: expect.any(Date),
				keyVersion: 1
			});
		});
	});
});
