/**
 * Configuration File Service
 *
 * Manages app-level configuration stored in user data directory.
 * Provides platform-specific configuration file paths and handles
 * reading/writing configuration with optional simple encryption.
 *
 * Platform paths:
 * - Linux: ~/.config/lifecycle-viewer/config.json
 * - Windows: %APPDATA%/lifecycle-viewer/config.json
 * - macOS: ~/Library/Application Support/lifecycle-viewer/config.json
 */

import { browser } from '$app/environment';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Main application configuration structure
 */
export interface AppConfiguration {
	version: number;
	claudeApiKey?: EncryptedValue;
	lastModified: string;
	createdAt: string;
}

/**
 * Encrypted value structure for sensitive data
 */
export interface EncryptedValue {
	encrypted: string;
	iv: string;
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
	constructor(
		message: string,
		public validationErrors: string[]
	) {
		super(message);
		this.name = 'ConfigValidationError';
	}
}

/**
 * Configuration migration error
 */
export class ConfigMigrationError extends Error {
	constructor(
		message: string,
		public fromVersion: number,
		public toVersion: number
	) {
		super(message);
		this.name = 'ConfigMigrationError';
	}
}

/**
 * Configuration file I/O error
 */
export class ConfigFileError extends Error {
	constructor(
		message: string,
		public operation: 'read' | 'write' | 'create' | 'delete',
		public cause?: Error
	) {
		super(message);
		this.name = 'ConfigFileError';
	}
}

/**
 * Platform path resolver utility
 */
class PlatformPathResolver {
	/**
	 * Get the configuration directory based on platform
	 */
	static getConfigDirectory(): string {
		if (browser) {
			throw new Error('Configuration service is not available in browser environment');
		}

		const platform = process.platform;
		const homedir = os.homedir();

		switch (platform) {
			case 'linux':
				return path.join(homedir, '.config', 'lifecycle-viewer');
			case 'darwin': // macOS
				return path.join(homedir, 'Library', 'Application Support', 'lifecycle-viewer');
			case 'win32':
				const appData = process.env.APPDATA;
				if (!appData) {
					throw new Error('APPDATA environment variable not set');
				}
				return path.join(appData, 'lifecycle-viewer');
			default:
				throw new Error(`Unsupported platform: ${platform}`);
		}
	}

	/**
	 * Resolve full path for a configuration file
	 */
	static resolveConfigPath(filename: string): string {
		return path.join(this.getConfigDirectory(), filename);
	}
}

/**
 * Configuration Service
 *
 * Manages app-level configuration with file-based storage
 */
export class ConfigService {
	private configPath: string;
	private config: AppConfiguration | null = null;
	private readonly CONFIG_VERSION = 1;
	private readonly CONFIG_FILENAME = 'config.json';

	// Simple encryption key derived from machine ID
	// This provides basic obfuscation without requiring password prompts
	private readonly ENCRYPTION_ALGORITHM = 'aes-256-cbc';
	private encryptionKey: Buffer | null = null;

	constructor() {
		if (browser) {
			throw new Error('ConfigService can only be used in Node.js environment');
		}
		this.configPath = PlatformPathResolver.resolveConfigPath(this.CONFIG_FILENAME);
		this.initializeEncryptionKey();
	}

	/**
	 * Initialize encryption key from machine-specific data
	 * This provides simple encryption without requiring user passwords
	 */
	private initializeEncryptionKey(): void {
		try {
			// Use hostname and platform as basis for encryption key
			// This is intentionally simple - no password prompts
			const machineId = `${os.hostname()}-${os.platform()}-${os.arch()}`;
			this.encryptionKey = crypto.scryptSync(machineId, 'lifecycle-viewer-salt', 32);
		} catch (error) {
			console.error('Failed to initialize encryption key:', error);
			// Continue without encryption if key derivation fails
			this.encryptionKey = null;
		}
	}

	/**
	 * Get the configuration file path
	 */
	getConfigPath(): string {
		return this.configPath;
	}

	/**
	 * Get the configuration directory
	 */
	getConfigDirectory(): string {
		return PlatformPathResolver.getConfigDirectory();
	}

	/**
	 * Ensure configuration directory exists
	 */
	private async ensureConfigDirectory(): Promise<void> {
		const configDir = this.getConfigDirectory();

		try {
			await fs.promises.access(configDir);
		} catch {
			// Directory doesn't exist, create it
			try {
				await fs.promises.mkdir(configDir, { recursive: true, mode: 0o700 });
			} catch (error) {
				throw new ConfigFileError(
					`Failed to create configuration directory: ${configDir}`,
					'create',
					error instanceof Error ? error : undefined
				);
			}
		}
	}

	/**
	 * Read configuration file from disk
	 */
	private async readConfigFile(): Promise<string> {
		try {
			return await fs.promises.readFile(this.configPath, 'utf-8');
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// File doesn't exist - this is OK, will create default
				return '';
			}
			throw new ConfigFileError(
				`Failed to read configuration file: ${this.configPath}`,
				'read',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Write configuration file to disk
	 */
	private async writeConfigFile(content: string): Promise<void> {
		await this.ensureConfigDirectory();

		try {
			await fs.promises.writeFile(this.configPath, content, {
				encoding: 'utf-8',
				mode: 0o600 // Read/write for owner only
			});
		} catch (error) {
			throw new ConfigFileError(
				`Failed to write configuration file: ${this.configPath}`,
				'write',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Encrypt a sensitive value
	 */
	private encryptValue(value: string): EncryptedValue {
		if (!this.encryptionKey) {
			// Fallback to base64 if encryption unavailable
			return {
				encrypted: Buffer.from(value).toString('base64'),
				iv: ''
			};
		}

		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

		let encrypted = cipher.update(value, 'utf-8', 'hex');
		encrypted += cipher.final('hex');

		return {
			encrypted,
			iv: iv.toString('hex')
		};
	}

	/**
	 * Decrypt a sensitive value
	 */
	private decryptValue(encryptedValue: EncryptedValue): string {
		if (!this.encryptionKey || !encryptedValue.iv) {
			// Fallback from base64 if no encryption
			return Buffer.from(encryptedValue.encrypted, 'base64').toString('utf-8');
		}

		const iv = Buffer.from(encryptedValue.iv, 'hex');
		const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

		let decrypted = decipher.update(encryptedValue.encrypted, 'hex', 'utf-8');
		decrypted += decipher.final('utf-8');

		return decrypted;
	}

	/**
	 * Validate configuration structure
	 */
	validateConfig(config: unknown): AppConfiguration {
		const errors: string[] = [];

		if (typeof config !== 'object' || config === null) {
			throw new ConfigValidationError('Configuration must be an object', ['Not an object']);
		}

		const cfg = config as any;

		// Validate version
		if (typeof cfg.version !== 'number') {
			errors.push('version must be a number');
		}

		// Validate claudeApiKey if present
		if (cfg.claudeApiKey !== undefined) {
			if (typeof cfg.claudeApiKey !== 'object' || cfg.claudeApiKey === null) {
				errors.push('claudeApiKey must be an object');
			} else {
				if (typeof cfg.claudeApiKey.encrypted !== 'string') {
					errors.push('claudeApiKey.encrypted must be a string');
				}
				if (typeof cfg.claudeApiKey.iv !== 'string') {
					errors.push('claudeApiKey.iv must be a string');
				}
			}
		}

		// Validate timestamps
		if (typeof cfg.lastModified !== 'string') {
			errors.push('lastModified must be a string');
		}
		if (typeof cfg.createdAt !== 'string') {
			errors.push('createdAt must be a string');
		}

		if (errors.length > 0) {
			throw new ConfigValidationError('Configuration validation failed', errors);
		}

		return cfg as AppConfiguration;
	}

	/**
	 * Migrate configuration from older version
	 */
	migrateConfig(oldConfig: unknown): AppConfiguration {
		if (typeof oldConfig !== 'object' || oldConfig === null) {
			throw new ConfigMigrationError(
				'Cannot migrate: invalid configuration format',
				0,
				this.CONFIG_VERSION
			);
		}

		const cfg = oldConfig as any;
		const oldVersion = cfg.version || 0;

		if (oldVersion === this.CONFIG_VERSION) {
			return cfg as AppConfiguration;
		}

		// Migration logic for future versions
		// For now, we only have version 1
		if (oldVersion < this.CONFIG_VERSION) {
			// Migrate from version 0 (or undefined) to version 1
			return {
				version: this.CONFIG_VERSION,
				claudeApiKey: cfg.claudeApiKey,
				lastModified: new Date().toISOString(),
				createdAt: cfg.createdAt || new Date().toISOString()
			};
		}

		throw new ConfigMigrationError(
			`Cannot migrate from version ${oldVersion} to ${this.CONFIG_VERSION}`,
			oldVersion,
			this.CONFIG_VERSION
		);
	}

	/**
	 * Create default configuration
	 */
	private createDefaultConfig(): AppConfiguration {
		const now = new Date().toISOString();
		return {
			version: this.CONFIG_VERSION,
			lastModified: now,
			createdAt: now
		};
	}

	/**
	 * Load configuration from file
	 */
	async loadConfig(): Promise<AppConfiguration> {
		const content = await this.readConfigFile();

		if (!content) {
			// No config file exists, create default
			this.config = this.createDefaultConfig();
			await this.saveConfig(this.config);
			return this.config;
		}

		try {
			const parsed = JSON.parse(content);

			// Try to validate first
			try {
				this.config = this.validateConfig(parsed);
			} catch (validationError) {
				// Validation failed, try migration
				console.warn('Configuration validation failed, attempting migration:', validationError);
				this.config = this.migrateConfig(parsed);
				// Save migrated config
				await this.saveConfig(this.config);
			}

			return this.config;
		} catch (error) {
			throw new ConfigFileError(
				'Failed to parse configuration file',
				'read',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Save configuration to file
	 */
	async saveConfig(config: AppConfiguration): Promise<void> {
		// Validate before saving
		this.validateConfig(config);

		// Update lastModified
		config.lastModified = new Date().toISOString();

		const content = JSON.stringify(config, null, 2);
		await this.writeConfigFile(content);

		this.config = config;
	}

	/**
	 * Get Claude API key (decrypted)
	 */
	async getClaudeApiKey(): Promise<string | null> {
		if (!this.config) {
			await this.loadConfig();
		}

		if (!this.config?.claudeApiKey) {
			return null;
		}

		try {
			return this.decryptValue(this.config.claudeApiKey);
		} catch (error) {
			console.error('Failed to decrypt Claude API key:', error);
			return null;
		}
	}

	/**
	 * Set Claude API key (encrypted)
	 */
	async setClaudeApiKey(apiKey: string): Promise<void> {
		if (!this.config) {
			await this.loadConfig();
		}

		// Validate API key format
		if (!apiKey || typeof apiKey !== 'string') {
			throw new Error('API key must be a non-empty string');
		}

		const trimmedKey = apiKey.trim();
		if (!trimmedKey.startsWith('sk-ant-')) {
			throw new Error('Invalid Claude API key format. Should start with "sk-ant-"');
		}

		// Encrypt and save
		const encryptedKey = this.encryptValue(trimmedKey);

		const updatedConfig: AppConfiguration = {
			...this.config!,
			claudeApiKey: encryptedKey
		};

		await this.saveConfig(updatedConfig);
	}

	/**
	 * Clear Claude API key from configuration
	 */
	async clearClaudeApiKey(): Promise<void> {
		if (!this.config) {
			await this.loadConfig();
		}

		const updatedConfig: AppConfiguration = {
			...this.config!,
			claudeApiKey: undefined
		};

		await this.saveConfig(updatedConfig);
	}

	/**
	 * Check if Claude API key is configured
	 */
	async isClaudeApiKeyConfigured(): Promise<boolean> {
		if (!this.config) {
			await this.loadConfig();
		}

		return this.config?.claudeApiKey !== undefined;
	}

	/**
	 * Get configuration metadata (without sensitive values)
	 */
	async getConfigMetadata(): Promise<{
		path: string;
		directory: string;
		version: number;
		createdAt: string;
		lastModified: string;
		hasClaudeApiKey: boolean;
	}> {
		if (!this.config) {
			await this.loadConfig();
		}

		return {
			path: this.configPath,
			directory: this.getConfigDirectory(),
			version: this.config!.version,
			createdAt: this.config!.createdAt,
			lastModified: this.config!.lastModified,
			hasClaudeApiKey: this.config!.claudeApiKey !== undefined
		};
	}

	/**
	 * Delete configuration file (dangerous operation)
	 */
	async deleteConfig(): Promise<void> {
		try {
			await fs.promises.unlink(this.configPath);
			this.config = null;
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// File doesn't exist, that's OK
				return;
			}
			throw new ConfigFileError(
				'Failed to delete configuration file',
				'delete',
				error instanceof Error ? error : undefined
			);
		}
	}
}

// Export singleton instance
export const configService = new ConfigService();
