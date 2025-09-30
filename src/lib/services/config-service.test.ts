import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	ConfigService,
	ConfigValidationError,
	ConfigMigrationError,
	ConfigFileError,
	type AppConfiguration,
	type EncryptedValue
} from './config-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: false
}));

// Mock filesystem for testing
vi.mock('fs', async () => {
	const actual = await vi.importActual('fs');
	return {
		...actual,
		promises: {
			readFile: vi.fn(),
			writeFile: vi.fn(),
			mkdir: vi.fn(),
			access: vi.fn(),
			unlink: vi.fn()
		}
	};
});

// Mock os module
vi.mock('os', async () => {
	const actual = await vi.importActual('os');
	return {
		...actual,
		homedir: vi.fn(() => '/home/testuser'),
		hostname: vi.fn(() => 'test-machine'),
		platform: vi.fn(() => 'linux'),
		arch: vi.fn(() => 'x64')
	};
});

describe('ConfigService', () => {
	let configService: ConfigService;
	let mockReadFile: any;
	let mockWriteFile: any;
	let mockMkdir: any;
	let mockAccess: any;
	let mockUnlink: any;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		mockReadFile = vi.mocked(fs.promises.readFile);
		mockWriteFile = vi.mocked(fs.promises.writeFile);
		mockMkdir = vi.mocked(fs.promises.mkdir);
		mockAccess = vi.mocked(fs.promises.access);
		mockUnlink = vi.mocked(fs.promises.unlink);

		// Default: directory exists
		mockAccess.mockResolvedValue(undefined);

		// Create fresh instance
		configService = new ConfigService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor and path resolution', () => {
		it('should create service and resolve config path for Linux', () => {
			const configPath = configService.getConfigPath();
			expect(configPath).toBe('/home/testuser/.config/lifecycle-viewer/config.json');
		});

		it('should resolve config directory for Linux', () => {
			const configDir = configService.getConfigDirectory();
			expect(configDir).toBe('/home/testuser/.config/lifecycle-viewer');
		});

		it('should resolve config path for macOS', () => {
			// Mock needs to be set before creating the service instance
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'darwin' });

			const service = new ConfigService();
			const configPath = service.getConfigPath();
			expect(configPath).toBe(
				'/home/testuser/Library/Application Support/lifecycle-viewer/config.json'
			);

			// Restore
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should resolve config path for Windows', () => {
			const originalPlatform = process.platform;
			const originalAppData = process.env.APPDATA;

			Object.defineProperty(process, 'platform', { value: 'win32' });
			process.env.APPDATA = 'C:\\Users\\TestUser\\AppData\\Roaming';

			const service = new ConfigService();
			const configPath = service.getConfigPath();

			// Normalize path for comparison (path.join uses platform separator but we're testing on Linux)
			const expected = path.join(
				'C:\\Users\\TestUser\\AppData\\Roaming',
				'lifecycle-viewer',
				'config.json'
			);
			expect(configPath).toBe(expected);

			// Restore
			Object.defineProperty(process, 'platform', { value: originalPlatform });
			if (originalAppData) {
				process.env.APPDATA = originalAppData;
			} else {
				delete process.env.APPDATA;
			}
		});

		it('should throw error on unsupported platform', () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'freebsd' });

			expect(() => new ConfigService()).toThrow('Unsupported platform: freebsd');

			// Restore
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should throw error when APPDATA not set on Windows', () => {
			const originalPlatform = process.platform;
			const originalAppData = process.env.APPDATA;

			Object.defineProperty(process, 'platform', { value: 'win32' });
			delete process.env.APPDATA;

			expect(() => new ConfigService()).toThrow('APPDATA environment variable not set');

			// Restore
			Object.defineProperty(process, 'platform', { value: originalPlatform });
			if (originalAppData) {
				process.env.APPDATA = originalAppData;
			}
		});
	});

	describe('loadConfig', () => {
		it('should load valid configuration from file', async () => {
			const mockConfig: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

			const config = await configService.loadConfig();

			expect(config).toEqual(mockConfig);
			expect(mockReadFile).toHaveBeenCalledWith(configService.getConfigPath(), 'utf-8');
		});

		it('should create default config when file does not exist', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);

			const config = await configService.loadConfig();

			expect(config.version).toBe(1);
			expect(config.lastModified).toBeDefined();
			expect(config.createdAt).toBeDefined();
			expect(mockWriteFile).toHaveBeenCalled();
		});

		it('should create config directory if it does not exist', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockAccess.mockRejectedValue(new Error('Directory does not exist'));
			mockMkdir.mockResolvedValue(undefined);
			mockWriteFile.mockResolvedValue(undefined);

			await configService.loadConfig();

			expect(mockMkdir).toHaveBeenCalledWith(
				configService.getConfigDirectory(),
				expect.objectContaining({ recursive: true, mode: 0o700 })
			);
		});

		it('should throw ConfigFileError on read failure', async () => {
			mockReadFile.mockRejectedValue(new Error('Permission denied'));

			await expect(configService.loadConfig()).rejects.toThrow(ConfigFileError);
		});

		it('should throw ConfigFileError on invalid JSON', async () => {
			mockReadFile.mockResolvedValue('{ invalid json }');

			await expect(configService.loadConfig()).rejects.toThrow(ConfigFileError);
		});

		it('should migrate old config version', async () => {
			const oldConfig = {
				version: 0,
				claudeApiKey: { encrypted: 'test', iv: 'test-iv' },
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockReadFile.mockResolvedValue(JSON.stringify(oldConfig));
			mockWriteFile.mockResolvedValue(undefined);

			const config = await configService.loadConfig();

			expect(config.version).toBe(1);
			expect(config.claudeApiKey).toEqual(oldConfig.claudeApiKey);
			expect(mockWriteFile).toHaveBeenCalled(); // Should save migrated config
		});
	});

	describe('saveConfig', () => {
		it('should save valid configuration to file', async () => {
			const config: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockWriteFile.mockResolvedValue(undefined);

			await configService.saveConfig(config);

			expect(mockWriteFile).toHaveBeenCalledWith(
				configService.getConfigPath(),
				expect.stringContaining('"version": 1'),
				expect.objectContaining({ encoding: 'utf-8', mode: 0o600 })
			);
		});

		it('should update lastModified timestamp when saving', async () => {
			const config: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockWriteFile.mockResolvedValue(undefined);

			await configService.saveConfig(config);

			// lastModified should be updated
			expect(config.lastModified).not.toBe('2024-01-01T00:00:00.000Z');
		});

		it('should throw ConfigValidationError on invalid config', async () => {
			const invalidConfig = { version: 'invalid' } as any;

			await expect(configService.saveConfig(invalidConfig)).rejects.toThrow(ConfigValidationError);
		});

		it('should throw ConfigFileError on write failure', async () => {
			const config: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockWriteFile.mockRejectedValue(new Error('Disk full'));

			await expect(configService.saveConfig(config)).rejects.toThrow(ConfigFileError);
		});
	});

	describe('validateConfig', () => {
		it('should validate correct configuration', () => {
			const validConfig: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			expect(() => configService.validateConfig(validConfig)).not.toThrow();
		});

		it('should validate configuration with API key', () => {
			const validConfig: AppConfiguration = {
				version: 1,
				claudeApiKey: { encrypted: 'test-encrypted', iv: 'test-iv' },
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			expect(() => configService.validateConfig(validConfig)).not.toThrow();
		});

		it('should throw ConfigValidationError for non-object', () => {
			expect(() => configService.validateConfig('not an object')).toThrow(ConfigValidationError);
		});

		it('should throw ConfigValidationError for null', () => {
			expect(() => configService.validateConfig(null)).toThrow(ConfigValidationError);
		});

		it('should throw ConfigValidationError for missing version', () => {
			const invalidConfig = {
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			expect(() => configService.validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		});

		it('should throw ConfigValidationError for invalid version type', () => {
			const invalidConfig = {
				version: '1',
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			expect(() => configService.validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		});

		it('should throw ConfigValidationError for invalid claudeApiKey structure', () => {
			const invalidConfig = {
				version: 1,
				claudeApiKey: 'invalid',
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			expect(() => configService.validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		});

		it('should throw ConfigValidationError for missing timestamps', () => {
			const invalidConfig = {
				version: 1
			};

			expect(() => configService.validateConfig(invalidConfig)).toThrow(ConfigValidationError);
		});
	});

	describe('migrateConfig', () => {
		it('should not migrate config with current version', () => {
			const config: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			const migrated = configService.migrateConfig(config);
			expect(migrated).toEqual(config);
		});

		it('should migrate from version 0 to version 1', () => {
			const oldConfig = {
				version: 0,
				claudeApiKey: { encrypted: 'test', iv: 'test-iv' },
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			const migrated = configService.migrateConfig(oldConfig);

			expect(migrated.version).toBe(1);
			expect(migrated.claudeApiKey).toEqual(oldConfig.claudeApiKey);
			expect(migrated.lastModified).toBeDefined();
		});

		it('should migrate from undefined version to version 1', () => {
			const oldConfig = {
				claudeApiKey: { encrypted: 'test', iv: 'test-iv' },
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			const migrated = configService.migrateConfig(oldConfig);

			expect(migrated.version).toBe(1);
		});

		it('should throw ConfigMigrationError for invalid input', () => {
			expect(() => configService.migrateConfig(null)).toThrow(ConfigMigrationError);
			expect(() => configService.migrateConfig('invalid')).toThrow(ConfigMigrationError);
		});

		it('should throw ConfigMigrationError for future version', () => {
			const futureConfig = {
				version: 999,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			expect(() => configService.migrateConfig(futureConfig)).toThrow(ConfigMigrationError);
		});
	});

	describe('Claude API Key management', () => {
		beforeEach(async () => {
			// Setup: load default config
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);
			await configService.loadConfig();
		});

		it('should set Claude API key', async () => {
			const apiKey = 'sk-ant-test-api-key-123456789';
			mockWriteFile.mockResolvedValue(undefined);

			await configService.setClaudeApiKey(apiKey);

			expect(mockWriteFile).toHaveBeenCalled();
			// Get the most recent write call (after initial config creation)
			const writeCall = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1];
			const savedConfig = JSON.parse(writeCall[1]);
			expect(savedConfig.claudeApiKey).toBeDefined();
			expect(savedConfig.claudeApiKey.encrypted).toBeDefined();
			expect(savedConfig.claudeApiKey.iv).toBeDefined();
		});

		it('should get Claude API key (decrypt)', async () => {
			const apiKey = 'sk-ant-test-api-key-123456789';
			mockWriteFile.mockResolvedValue(undefined);

			await configService.setClaudeApiKey(apiKey);
			const retrievedKey = await configService.getClaudeApiKey();

			expect(retrievedKey).toBe(apiKey);
		});

		it('should return null when no API key configured', async () => {
			const key = await configService.getClaudeApiKey();
			expect(key).toBeNull();
		});

		it('should clear Claude API key', async () => {
			const apiKey = 'sk-ant-test-api-key-123456789';
			mockWriteFile.mockResolvedValue(undefined);

			await configService.setClaudeApiKey(apiKey);
			await configService.clearClaudeApiKey();

			const key = await configService.getClaudeApiKey();
			expect(key).toBeNull();
		});

		it('should check if API key is configured', async () => {
			expect(await configService.isClaudeApiKeyConfigured()).toBe(false);

			const apiKey = 'sk-ant-test-api-key-123456789';
			mockWriteFile.mockResolvedValue(undefined);
			await configService.setClaudeApiKey(apiKey);

			expect(await configService.isClaudeApiKeyConfigured()).toBe(true);
		});

		it('should throw error for empty API key', async () => {
			await expect(configService.setClaudeApiKey('')).rejects.toThrow(
				'API key must be a non-empty string'
			);
		});

		it('should throw error for invalid API key format', async () => {
			await expect(configService.setClaudeApiKey('invalid-key')).rejects.toThrow(
				'Invalid Claude API key format'
			);
		});

		it('should trim API key before storing', async () => {
			const apiKey = '  sk-ant-test-api-key-123456789  ';
			mockWriteFile.mockResolvedValue(undefined);

			await configService.setClaudeApiKey(apiKey);
			const retrievedKey = await configService.getClaudeApiKey();

			expect(retrievedKey).toBe(apiKey.trim());
		});
	});

	describe('encryption and decryption', () => {
		it('should encrypt and decrypt values', async () => {
			const originalValue = 'sk-ant-test-secret-value';
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);

			await configService.loadConfig();
			await configService.setClaudeApiKey(originalValue);
			const decryptedValue = await configService.getClaudeApiKey();

			expect(decryptedValue).toBe(originalValue);
		});

		it('should use different IVs for multiple encryptions', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);
			await configService.loadConfig();

			const value = 'sk-ant-test-value';

			await configService.setClaudeApiKey(value);
			// Get the write call after setting the key (loadConfig also writes)
			const firstWriteIndex = mockWriteFile.mock.calls.length - 1;
			const firstEncrypted = JSON.parse(mockWriteFile.mock.calls[firstWriteIndex][1]).claudeApiKey;

			await configService.setClaudeApiKey(value);
			const secondWriteIndex = mockWriteFile.mock.calls.length - 1;
			const secondEncrypted = JSON.parse(
				mockWriteFile.mock.calls[secondWriteIndex][1]
			).claudeApiKey;

			// Same value should produce different encrypted results due to different IVs
			expect(firstEncrypted.iv).not.toBe(secondEncrypted.iv);
			expect(firstEncrypted.encrypted).not.toBe(secondEncrypted.encrypted);
		});
	});

	describe('getConfigMetadata', () => {
		it('should return configuration metadata', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);

			const metadata = await configService.getConfigMetadata();

			expect(metadata.path).toBe(configService.getConfigPath());
			expect(metadata.directory).toBe(configService.getConfigDirectory());
			expect(metadata.version).toBe(1);
			expect(metadata.createdAt).toBeDefined();
			expect(metadata.lastModified).toBeDefined();
			expect(metadata.hasClaudeApiKey).toBe(false);
		});

		it('should indicate when API key is present', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);
			await configService.loadConfig();

			await configService.setClaudeApiKey('sk-ant-test-key');
			const metadata = await configService.getConfigMetadata();

			expect(metadata.hasClaudeApiKey).toBe(true);
		});
	});

	describe('deleteConfig', () => {
		it('should delete configuration file', async () => {
			mockUnlink.mockResolvedValue(undefined);

			await configService.deleteConfig();

			expect(mockUnlink).toHaveBeenCalledWith(configService.getConfigPath());
		});

		it('should not throw error if file does not exist', async () => {
			mockUnlink.mockRejectedValue({ code: 'ENOENT' });

			await expect(configService.deleteConfig()).resolves.not.toThrow();
		});

		it('should throw ConfigFileError on delete failure', async () => {
			mockUnlink.mockRejectedValue(new Error('Permission denied'));

			await expect(configService.deleteConfig()).rejects.toThrow(ConfigFileError);
		});
	});

	describe('error handling', () => {
		it('should handle directory creation failure', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockAccess.mockRejectedValue(new Error('Directory does not exist'));
			mockMkdir.mockRejectedValue(new Error('Permission denied'));

			await expect(configService.loadConfig()).rejects.toThrow(ConfigFileError);
		});

		it('should handle write permission errors', async () => {
			const config: AppConfiguration = {
				version: 1,
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockWriteFile.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });

			await expect(configService.saveConfig(config)).rejects.toThrow(ConfigFileError);
		});

		it('should handle corrupted encrypted data gracefully', async () => {
			const mockConfig: AppConfiguration = {
				version: 1,
				claudeApiKey: { encrypted: 'corrupted', iv: 'invalid-iv' },
				lastModified: '2024-01-01T00:00:00.000Z',
				createdAt: '2024-01-01T00:00:00.000Z'
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
			await configService.loadConfig();

			// Should return null instead of throwing
			const key = await configService.getClaudeApiKey();
			expect(key).toBeNull();
		});
	});

	describe('integration scenarios', () => {
		it('should handle complete lifecycle: create, update, read, delete', async () => {
			// Create
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);
			await configService.loadConfig();

			// Update
			await configService.setClaudeApiKey('sk-ant-test-key-12345');
			expect(await configService.isClaudeApiKeyConfigured()).toBe(true);

			// Read
			const key = await configService.getClaudeApiKey();
			expect(key).toBe('sk-ant-test-key-12345');

			// Delete
			mockUnlink.mockResolvedValue(undefined);
			await configService.deleteConfig();
		});

		it('should handle concurrent operations', async () => {
			mockReadFile.mockRejectedValue({ code: 'ENOENT' });
			mockWriteFile.mockResolvedValue(undefined);

			await configService.loadConfig();

			// Perform concurrent operations
			const operations = [
				configService.setClaudeApiKey('sk-ant-key-1'),
				configService.getConfigMetadata(),
				configService.isClaudeApiKeyConfigured()
			];

			await expect(Promise.all(operations)).resolves.toBeDefined();
		});
	});
});
