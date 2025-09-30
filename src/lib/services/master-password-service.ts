// Master Password Management Service
// Handles user master password for API key encryption with backup codes recovery

import { mcpClient } from './mcp-client';
import { writable } from 'svelte/store';

export interface MasterPasswordState {
	isUnlocked: boolean;
	expiresAt: number | null;
	hasBackupCodes: boolean;
	backupCodesRemaining: number;
}

export interface BackupCode {
	code: string;
	isUsed: boolean;
}

class MasterPasswordService {
	private currentPasswordHash: string | null = null;
	private sessionTimer: NodeJS.Timeout | null = null;

	// Reactive store for UI
	public state = writable<MasterPasswordState>({
		isUnlocked: false,
		expiresAt: null,
		hasBackupCodes: false,
		backupCodesRemaining: 0
	});

	/**
	 * Check if master password is currently available
	 */
	async isUnlocked(): Promise<boolean> {
		// Check memory first
		if (this.currentPasswordHash) {
			return true;
		}

		// Check session storage
		const sessionData = sessionStorage.getItem('mp_session');
		if (sessionData) {
			try {
				const { hash, expires } = JSON.parse(sessionData);
				if (Date.now() < expires) {
					this.currentPasswordHash = hash;
					this.startSessionTimer(expires);
					return true;
				}
			} catch (error) {
				console.warn('Invalid session data:', error);
			}
		}

		// Check remember token
		const rememberData = localStorage.getItem('mp_remember');
		if (rememberData) {
			try {
				const { hash, expires } = JSON.parse(rememberData);
				if (Date.now() < expires) {
					this.currentPasswordHash = hash;
					await this.startSession(24, false); // Start new 24h session
					return true;
				}
			} catch (error) {
				console.warn('Invalid remember data:', error);
				localStorage.removeItem('mp_remember');
			}
		}

		return false;
	}

	/**
	 * Prompt user for master password (first time or unlock)
	 */
	async promptForMasterPassword(isFirstTime: boolean = false): Promise<string> {
		// This would show a modal/prompt - for now return a placeholder
		// In real implementation, this would be handled by a Svelte component
		return new Promise((resolve, reject) => {
			// Modal would call resolve(password) or reject()
			setTimeout(() => resolve('user-entered-password'), 100);
		});
	}

	/**
	 * Set up master password for first time
	 */
	async setupMasterPassword(
		password: string,
		rememberMe: boolean = false
	): Promise<{ backupCodes: string[] }> {
		const passwordHash = await this.hashPassword(password);
		const salt = crypto.getRandomValues(new Uint8Array(32));

		// Generate backup codes
		const backupCodes = this.generateBackupCodes();

		// Store master password settings
		await mcpClient.sendRequest('store_master_password_settings', {
			user_id: 'default-user',
			password_hash: passwordHash,
			salt: Array.from(salt),
			backup_codes_remaining: backupCodes.length
		});

		// Store backup codes (hashed)
		await this.storeBackupCodes(backupCodes);

		// Start session
		await this.startSession(24, rememberMe);
		this.currentPasswordHash = passwordHash;

		this.updateState();

		return { backupCodes };
	}

	/**
	 * Unlock with master password
	 */
	async unlock(password: string, rememberMe: boolean = false): Promise<boolean> {
		const passwordHash = await this.hashPassword(password);

		// Verify password
		const isValid = await mcpClient.sendRequest('verify_master_password', {
			user_id: 'default-user',
			password_hash: passwordHash
		});

		if (!isValid.success) {
			return false;
		}

		// Start session
		await this.startSession(24, rememberMe);
		this.currentPasswordHash = passwordHash;

		// Attempt to decrypt and load stored API key while password is available
		try {
			await this.decryptStoredApiKey(password);
		} catch (error) {
			console.warn('Failed to decrypt stored API key during unlock:', error);
			// Don't fail the unlock if API key decryption fails
		}

		this.updateState();
		return true;
	}

	/**
	 * Decrypt stored API key using the plaintext master password
	 * This should only be called when the plaintext password is available (during unlock)
	 */
	private async decryptStoredApiKey(password: string): Promise<void> {
		try {
			// Get stored API key from database
			const result = await mcpClient.sendRequest('chat/get_api_key', {
				user_id: 'default-user',
				service_name: 'claude'
			});

			if (!result.success || !result.api_key) {
				console.log('No stored API key found to decrypt');
				return;
			}

			// Import encryption service
			const { encryptionService } = await import('./encryption-service');
			const storedMetadata = JSON.parse(result.api_key.metadata || '{}');

			if (!storedMetadata.iv || !storedMetadata.salt) {
				console.warn('Stored API key missing required metadata for decryption');
				return;
			}

			// Decrypt the API key
			const decryptedKey = await encryptionService.decryptData(
				{
					encryptedData: result.api_key.encrypted_key,
					iv: storedMetadata.iv,
					salt: storedMetadata.salt,
					keyVersion: storedMetadata.keyVersion || 1
				},
				password
			);

			console.log('Successfully decrypted stored API key during master password unlock');

			// Load the API key into the Claude API service
			const { claudeApiService } = await import('./claude-api-service');
			claudeApiService.configure({ apiKey: decryptedKey });
		} catch (error) {
			console.error('Failed to decrypt stored API key:', error);
			throw error;
		}
	}

	/**
	 * Unlock with backup code
	 */
	async unlockWithBackupCode(code: string): Promise<boolean> {
		const isValid = await mcpClient.sendRequest('validate_backup_code', {
			user_id: 'default-user',
			code: code.toUpperCase().trim()
		});

		if (!isValid.success) {
			return false;
		}

		// Get master password hash from settings
		const settings = await mcpClient.sendRequest('get_master_password_settings', {
			user_id: 'default-user'
		});

		if (!settings.success) {
			return false;
		}

		// Start session (no remember option with backup codes)
		await this.startSession(24, false);
		this.currentPasswordHash = settings.password_hash;

		this.updateState();
		return true;
	}

	/**
	 * Get current master password hash for encryption
	 */
	async getCurrentPasswordHash(): Promise<string | null> {
		if (await this.isUnlocked()) {
			return this.currentPasswordHash;
		}
		return null;
	}

	/**
	 * Check if master password settings exist (for first-time detection)
	 */
	async hasSettingsConfigured(): Promise<boolean> {
		try {
			const result = await mcpClient.sendRequest('get_master_password_settings', {
				user_id: 'default-user'
			});
			console.log('🔐 Master password settings check result:', result);

			// Extract the actual response from MCP wrapper
			if (result && result.content && Array.isArray(result.content) && result.content.length > 0) {
				const content = result.content[0];
				if (content.text) {
					try {
						const data = JSON.parse(content.text);
						console.log('🔐 Parsed master password settings data:', data);
						return data.success === true;
					} catch (parseError) {
						console.warn('Failed to parse master password settings response:', parseError);
						return false;
					}
				}
			}

			return false;
		} catch (error) {
			console.warn('Failed to check master password settings:', error);
			return false;
		}
	}

	/**
	 * Lock session and clear password
	 */
	async lock(): Promise<void> {
		this.currentPasswordHash = null;
		sessionStorage.removeItem('mp_session');

		if (this.sessionTimer) {
			clearTimeout(this.sessionTimer);
			this.sessionTimer = null;
		}

		this.updateState();
	}

	/**
	 * Generate 10 backup codes
	 */
	private generateBackupCodes(): string[] {
		return Array.from({ length: 10 }, () => {
			const bytes = crypto.getRandomValues(new Uint8Array(4));
			return Array.from(bytes)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('')
				.toUpperCase()
				.match(/.{2}/g)!
				.join('-');
		});
		// Format: "A7-B2-C9-D4"
	}

	/**
	 * Store backup codes in database (hashed)
	 */
	private async storeBackupCodes(codes: string[]): Promise<void> {
		const hashedCodes = await Promise.all(
			codes.map(async (code) => ({
				id: crypto.randomUUID(),
				code_hash: await this.hashBackupCode(code)
			}))
		);

		await mcpClient.sendRequest('store_backup_codes', {
			user_id: 'default-user',
			backup_codes: hashedCodes
		});
	}

	/**
	 * Hash password with salt
	 */
	private async hashPassword(password: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(password);
		const hash = await crypto.subtle.digest('SHA-256', data);
		return Array.from(new Uint8Array(hash))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Hash backup code
	 */
	private async hashBackupCode(code: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(`backup-code-${code}`);
		const hash = await crypto.subtle.digest('SHA-256', data);
		return Array.from(new Uint8Array(hash))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Start session with timer
	 */
	private async startSession(hours: number, rememberMe: boolean): Promise<void> {
		const expires = Date.now() + hours * 60 * 60 * 1000;

		// Store in session storage
		sessionStorage.setItem(
			'mp_session',
			JSON.stringify({
				hash: this.currentPasswordHash,
				expires
			})
		);

		// Store remember token if requested
		if (rememberMe) {
			const rememberExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
			localStorage.setItem(
				'mp_remember',
				JSON.stringify({
					hash: this.currentPasswordHash,
					expires: rememberExpires
				})
			);
		}

		this.startSessionTimer(expires);
	}

	/**
	 * Start session expiry timer
	 */
	private startSessionTimer(expires: number): void {
		if (this.sessionTimer) {
			clearTimeout(this.sessionTimer);
		}

		const timeout = expires - Date.now();
		if (timeout > 0) {
			this.sessionTimer = setTimeout(() => {
				this.lock();
			}, timeout);
		}
	}

	/**
	 * Update reactive state
	 */
	private updateState(): void {
		this.state.set({
			isUnlocked: this.currentPasswordHash !== null,
			expiresAt: this.sessionTimer ? Date.now() + 24 * 60 * 60 * 1000 : null,
			hasBackupCodes: true, // TODO: Get from database
			backupCodesRemaining: 0 // TODO: Get from database
		});
	}
}

// Export singleton
export const masterPasswordService = new MasterPasswordService();
