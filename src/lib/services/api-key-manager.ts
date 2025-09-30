// API Key Management Service
// Handles secure storage, retrieval, and management of Claude API keys
// Uses MCP bridge database for persistent secure storage with master password

import { encryptionService, type EncryptedData } from './encryption-service';
import { mcpClient } from './mcp-client';
import { masterPasswordService } from './master-password-service';
import { writable, type Writable } from 'svelte/store';

export interface ApiKeyInfo {
	id: string;
	isConfigured: boolean;
	lastUsed?: Date;
	keyVersion: number;
	expiresAt?: Date;
}

export interface ApiKeyValidationResult {
	isValid: boolean;
	error?: string;
	keyFormat?: 'anthropic' | 'unknown';
	keyLength?: number;
}

class ApiKeyManager {
	private currentKey: string | null = null;
	private masterPassword: string | null = null;
	private keyInfo: Writable<ApiKeyInfo | null> = writable(null);

	constructor() {
		this.initializeFromDatabase();
	}

	/**
	 * Store an API key securely in database using master password
	 * @param apiKey The Claude API key to store
	 */
	async storeApiKey(apiKey: string): Promise<void> {
		// Validate API key format
		const validation = this.validateApiKey(apiKey);
		if (!validation.isValid) {
			throw new Error(validation.error || 'Invalid API key format');
		}

		if (!mcpClient.isConnected()) {
			throw new Error('Database not available - MCP bridge not connected');
		}

		// Get master password from session
		const masterPasswordHash = await masterPasswordService.getCurrentPasswordHash();
		if (!masterPasswordHash) {
			throw new Error('Master password required - please unlock first');
		}

		try {
			// Encrypt the API key with master password
			const encryptedData = await encryptionService.encryptData(apiKey, masterPasswordHash, {
				keyVersion: 1
			});

			// Store encrypted data in database via MCP bridge
			const keyHash = await this.generateKeyHash(apiKey);
			await mcpClient.sendRequest('chat/store_api_key', {
				user_id: 'default-user',
				encrypted_key: encryptedData.encryptedData,
				key_hash: keyHash,
				service_name: 'claude',
				metadata: {
					keyVersion: encryptedData.keyVersion,
					iv: encryptedData.iv,
					salt: encryptedData.salt
					// NO master password stored - it's in the session
				}
			});

			// Update internal state
			this.currentKey = apiKey;
			this.masterPassword = masterPasswordHash;

			// Update key info store
			this.keyInfo.set({
				id: 'primary',
				isConfigured: true,
				lastUsed: new Date(),
				keyVersion: encryptedData.keyVersion
			});

			console.log('API key stored securely in database');
		} catch (error) {
			console.error('Failed to store API key:', error);
			throw new Error('Failed to store API key securely');
		}
	}

	/**
	 * Retrieve the current API key from database
	 * @returns The decrypted API key or null if not available
	 */
	async getApiKey(): Promise<string | null> {
		if (this.currentKey) {
			await this.updateLastUsed();
			return this.currentKey;
		}

		try {
			// Try to load from database
			const success = await this.loadFromDatabase();
			if (success && this.currentKey) {
				await this.updateLastUsed();
				return this.currentKey;
			}
		} catch (error) {
			console.error('Failed to retrieve API key:', error);
		}

		return null;
	}

	/**
	 * Check if an API key is configured and accessible
	 * @returns True if a valid API key is available
	 */
	async isConfigured(): Promise<boolean> {
		const key = await this.getApiKey();
		return key !== null && this.validateApiKey(key).isValid;
	}

	/**
	 * Clear the stored API key from database
	 */
	async clearApiKey(): Promise<void> {
		try {
			// Clear from database
			if (mcpClient.isConnected()) {
				await mcpClient.sendRequest('chat/clear_api_key', {
					user_id: 'default',
					service_name: 'claude'
				});
			}

			// Clear from memory
			this.currentKey = null;
			this.masterPassword = null;

			// Update store
			this.keyInfo.set(null);

			console.log('API key cleared');
		} catch (error) {
			console.error('Failed to clear API key:', error);
			throw new Error('Failed to clear API key');
		}
	}

	/**
	 * Rotate the API key (store a new one, invalidate the old)
	 * @param newApiKey The new API key
	 */
	async rotateApiKey(newApiKey: string): Promise<void> {
		// Validate new key first
		const validation = this.validateApiKey(newApiKey);
		if (!validation.isValid) {
			throw new Error(validation.error || 'Invalid new API key format');
		}

		// Store the new key with incremented version
		const currentInfo = await this.getKeyInfo();
		const newVersion = currentInfo ? currentInfo.keyVersion + 1 : 1;

		await this.storeApiKey(newApiKey);

		console.log(`API key rotated to version ${newVersion}`);
	}

	/**
	 * Validate API key format and structure
	 * @param apiKey The API key to validate
	 * @returns Validation result
	 */
	validateApiKey(apiKey: string): ApiKeyValidationResult {
		if (!apiKey || typeof apiKey !== 'string') {
			return {
				isValid: false,
				error: 'API key is required'
			};
		}

		const trimmedKey = apiKey.trim();

		// Check Anthropic format
		if (trimmedKey.startsWith('sk-ant-')) {
			if (trimmedKey.length < 20) {
				return {
					isValid: false,
					error: 'API key appears too short',
					keyFormat: 'anthropic',
					keyLength: trimmedKey.length
				};
			}

			return {
				isValid: true,
				keyFormat: 'anthropic',
				keyLength: trimmedKey.length
			};
		}

		return {
			isValid: false,
			error: 'Invalid API key format. Should start with "sk-ant-"',
			keyFormat: 'unknown',
			keyLength: trimmedKey.length
		};
	}

	/**
	 * Get current API key information
	 */
	async getKeyInfo(): Promise<ApiKeyInfo | null> {
		let currentInfo: ApiKeyInfo | null = null;
		this.keyInfo.subscribe((info) => (currentInfo = info))();

		if (!currentInfo && (await this.isConfigured())) {
			// Reconstruct info if missing
			currentInfo = {
				id: 'primary',
				isConfigured: true,
				lastUsed: new Date(),
				keyVersion: 1
			};
			this.keyInfo.set(currentInfo);
		}

		return currentInfo;
	}

	/**
	 * Get reactive store for key information
	 */
	getKeyInfoStore(): Writable<ApiKeyInfo | null> {
		return this.keyInfo;
	}

	/**
	 * Initialize from database
	 */
	private async initializeFromDatabase(): Promise<void> {
		try {
			await this.loadFromDatabase();
		} catch (error) {
			console.warn('Failed to initialize from database:', error);
		}
	}

	/**
	 * Load encrypted key from database and decrypt
	 */
	private async loadFromDatabase(): Promise<boolean> {
		if (!mcpClient.isConnected()) {
			return false;
		}

		try {
			// Get API key from database via MCP bridge
			const result = await mcpClient.sendRequest('chat/get_api_key', {
				user_id: 'default-user',
				service_name: 'claude'
			});

			const data = this.extractMCPData(result);
			if (!data.success || !data.api_key) {
				return false;
			}

			// Reconstruct encrypted data from stored metadata
			const encryptedData: EncryptedData = {
				encryptedData: data.api_key.encrypted_key,
				iv: data.api_key.metadata.iv,
				salt: data.api_key.metadata.salt,
				keyVersion: data.api_key.metadata.keyVersion || 1
			};

			// Get master password from session
			const masterPasswordHash = await masterPasswordService.getCurrentPasswordHash();
			if (!masterPasswordHash) {
				console.warn('Master password not available in session');
				return false;
			}

			const decryptedKey = await encryptionService.decryptData(encryptedData, masterPasswordHash);

			// Validate decrypted key
			const validation = this.validateApiKey(decryptedKey);
			if (!validation.isValid) {
				console.warn('Stored API key is invalid');
				await this.clearApiKey();
				return false;
			}

			this.currentKey = decryptedKey;
			this.masterPassword = masterPasswordHash;

			this.keyInfo.set({
				id: 'primary',
				isConfigured: true,
				lastUsed: new Date(data.api_key.last_used || Date.now()),
				keyVersion: encryptedData.keyVersion
			});

			return true;
		} catch (error) {
			console.error('Failed to load from database:', error);
			// Clear corrupted data
			await this.clearApiKey();
			return false;
		}
	}

	/**
	 * Extract data from MCP response
	 */
	private extractMCPData(result: any): any {
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

	/**
	 * Generate hash for API key
	 */
	private async generateKeyHash(apiKey: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(apiKey);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Update last used timestamp
	 */
	private async updateLastUsed(): Promise<void> {
		this.keyInfo.update((info) => {
			if (info) {
				return { ...info, lastUsed: new Date() };
			}
			return info;
		});
	}
}

// Export singleton instance
export const apiKeyManager = new ApiKeyManager();
