import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptionService } from './encryption-service';

// Mock browser environment
Object.defineProperty(global, 'crypto', {
	value: {
		subtle: {
			encrypt: vi.fn(),
			decrypt: vi.fn(),
			importKey: vi.fn(),
			deriveKey: vi.fn()
		},
		getRandomValues: vi.fn()
	},
	writable: true
});

// Mock browser flag
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('EncryptionService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('isSupported', () => {
		it('should return true when Web Crypto API is available', () => {
			expect(encryptionService.isSupported()).toBe(true);
		});

		it('should return false when crypto.subtle is undefined', () => {
			const originalSubtle = global.crypto.subtle;
			// @ts-ignore
			global.crypto.subtle = undefined;

			expect(encryptionService.isSupported()).toBe(false);

			global.crypto.subtle = originalSubtle;
		});
	});

	describe('generateMasterPassword', () => {
		beforeEach(() => {
			// Mock getRandomValues to return predictable values for testing
			vi.mocked(global.crypto.getRandomValues).mockImplementation((array: any) => {
				for (let i = 0; i < array.length; i++) {
					array[i] = i % 256;
				}
				return array;
			});
		});

		it('should generate password of specified length', () => {
			const password = encryptionService.generateMasterPassword(16);
			expect(password).toHaveLength(16);
		});

		it('should generate password of default length (32)', () => {
			const password = encryptionService.generateMasterPassword();
			expect(password).toHaveLength(32);
		});

		it('should generate different passwords on multiple calls', () => {
			// Mock different random values
			let callCount = 0;
			vi.mocked(global.crypto.getRandomValues).mockImplementation((array: any) => {
				for (let i = 0; i < array.length; i++) {
					array[i] = (i + callCount * 10) % 256;
				}
				callCount++;
				return array;
			});

			const password1 = encryptionService.generateMasterPassword(16);
			const password2 = encryptionService.generateMasterPassword(16);
			expect(password1).not.toBe(password2);
		});
	});

	describe('encryptData', () => {
		const mockEncryptedData = new ArrayBuffer(32);
		const mockSalt = new Uint8Array(32);
		const mockIv = new Uint8Array(12);
		const mockDerivedKey = {} as CryptoKey;

		beforeEach(() => {
			// Mock crypto.getRandomValues
			vi.mocked(global.crypto.getRandomValues).mockImplementation((array: any) => {
				if (array.length === 32) {
					return mockSalt;
				} else if (array.length === 12) {
					return mockIv;
				}
				return array;
			});

			// Mock key derivation
			vi.mocked(global.crypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
			vi.mocked(global.crypto.subtle.deriveKey).mockResolvedValue(mockDerivedKey);

			// Mock encryption
			vi.mocked(global.crypto.subtle.encrypt).mockResolvedValue(mockEncryptedData);
		});

		it('should encrypt data successfully', async () => {
			const plaintext = 'sk-ant-test-api-key-123';
			const masterPassword = 'secure-master-password';

			const result = await encryptionService.encryptData(plaintext, masterPassword);

			expect(result).toHaveProperty('encryptedData');
			expect(result).toHaveProperty('iv');
			expect(result).toHaveProperty('salt');
			expect(result).toHaveProperty('keyVersion');
			expect(result.keyVersion).toBe(1);
		});

		it('should use custom key version', async () => {
			const plaintext = 'sk-ant-test-api-key-123';
			const masterPassword = 'secure-master-password';

			const result = await encryptionService.encryptData(plaintext, masterPassword, {
				keyVersion: 5
			});

			expect(result.keyVersion).toBe(5);
		});

		it('should use custom iterations', async () => {
			const plaintext = 'sk-ant-test-api-key-123';
			const masterPassword = 'secure-master-password';
			const customIterations = 50000;

			await encryptionService.encryptData(plaintext, masterPassword, {
				iterations: customIterations
			});

			// Verify deriveKey was called with custom iterations
			expect(global.crypto.subtle.deriveKey).toHaveBeenCalledWith(
				expect.objectContaining({
					iterations: customIterations
				}),
				expect.any(Object),
				expect.any(Object),
				false,
				['encrypt', 'decrypt']
			);
		});

		it('should throw error when Web Crypto is not available', async () => {
			const originalSubtle = global.crypto.subtle;
			// @ts-ignore
			global.crypto.subtle = undefined;

			await expect(encryptionService.encryptData('test', 'password')).rejects.toThrow(
				'Web Crypto API not available'
			);

			global.crypto.subtle = originalSubtle;
		});
	});

	describe('decryptData', () => {
		const mockDecryptedData = new TextEncoder().encode('sk-ant-decrypted-key').buffer;
		const mockDerivedKey = {} as CryptoKey;

		beforeEach(() => {
			vi.mocked(global.crypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
			vi.mocked(global.crypto.subtle.deriveKey).mockResolvedValue(mockDerivedKey);
			vi.mocked(global.crypto.subtle.decrypt).mockResolvedValue(mockDecryptedData);
		});

		it('should decrypt data successfully', async () => {
			const encryptedData = {
				encryptedData: btoa('encrypted'),
				iv: btoa('initialization-vector'),
				salt: btoa('random-salt-32-bytes-long-test'),
				keyVersion: 1
			};
			const masterPassword = 'secure-master-password';

			const result = await encryptionService.decryptData(encryptedData, masterPassword);

			expect(result).toBe('sk-ant-decrypted-key');
		});

		it('should use custom iterations for decryption', async () => {
			const encryptedData = {
				encryptedData: btoa('encrypted'),
				iv: btoa('iv'),
				salt: btoa('salt'),
				keyVersion: 1
			};
			const masterPassword = 'password';
			const customIterations = 75000;

			await encryptionService.decryptData(encryptedData, masterPassword, customIterations);

			expect(global.crypto.subtle.deriveKey).toHaveBeenCalledWith(
				expect.objectContaining({
					iterations: customIterations
				}),
				expect.any(Object),
				expect.any(Object),
				false,
				['encrypt', 'decrypt']
			);
		});

		it('should throw generic error on decryption failure', async () => {
			vi.mocked(global.crypto.subtle.decrypt).mockRejectedValue(new Error('Decryption failed'));

			const encryptedData = {
				encryptedData: btoa('invalid'),
				iv: btoa('iv'),
				salt: btoa('salt'),
				keyVersion: 1
			};

			await expect(encryptionService.decryptData(encryptedData, 'wrong-password')).rejects.toThrow(
				'Failed to decrypt data - invalid password or corrupted data'
			);
		});
	});

	describe('getEncryptionInfo', () => {
		it('should return encryption configuration details', () => {
			const info = encryptionService.getEncryptionInfo();

			expect(info).toEqual({
				algorithm: 'AES-GCM',
				keyLength: 256,
				keyDerivation: 'PBKDF2',
				hashAlgorithm: 'SHA-256',
				defaultIterations: 100000,
				ivLength: 12,
				saltLength: 32,
				isSupported: true
			});
		});
	});

	describe('integration test - encrypt then decrypt', () => {
		it('should successfully roundtrip data', async () => {
			// This test would require actual Web Crypto API implementation
			// For now, we'll mock the roundtrip behavior
			const plaintext = 'sk-ant-api-key-test-123456789';
			const masterPassword = 'test-master-password';

			// Mock encryption to return specific data
			const mockEncryptedBuffer = new TextEncoder().encode('mock-encrypted-data').buffer;
			vi.mocked(global.crypto.subtle.encrypt).mockResolvedValue(mockEncryptedBuffer);

			// Mock decryption to return original plaintext
			const mockDecryptedBuffer = new TextEncoder().encode(plaintext).buffer;
			vi.mocked(global.crypto.subtle.decrypt).mockResolvedValue(mockDecryptedBuffer);

			// Mock key operations
			vi.mocked(global.crypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
			vi.mocked(global.crypto.subtle.deriveKey).mockResolvedValue({} as CryptoKey);

			// Mock random generation
			vi.mocked(global.crypto.getRandomValues).mockImplementation((array: any) => {
				for (let i = 0; i < array.length; i++) {
					array[i] = i % 256;
				}
				return array;
			});

			// Encrypt
			const encrypted = await encryptionService.encryptData(plaintext, masterPassword);

			// Decrypt
			const decrypted = await encryptionService.decryptData(encrypted, masterPassword);

			expect(decrypted).toBe(plaintext);
		});
	});
});
