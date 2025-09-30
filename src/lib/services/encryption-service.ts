// API Key Encryption Service
// Provides secure encryption/decryption for sensitive data using Web Crypto API
// Uses AES-256-GCM with PBKDF2 key derivation for maximum security

import { browser } from '$app/environment';

export interface EncryptedData {
	encryptedData: string; // Base64 encoded
	iv: string; // Base64 encoded initialization vector
	salt: string; // Base64 encoded salt for key derivation
	keyVersion: number;
}

export interface EncryptionOptions {
	iterations?: number; // PBKDF2 iterations (default: 100000)
	keyVersion?: number; // Key version for rotation support
}

class EncryptionService {
	private readonly algorithm = 'AES-GCM';
	private readonly keyDerivationAlgorithm = 'PBKDF2';
	private readonly hashAlgorithm = 'SHA-256';
	private readonly keyLength = 256; // AES-256
	private readonly ivLength = 12; // 96 bits for GCM
	private readonly saltLength = 32; // 256 bits
	private readonly defaultIterations = 100000;

	/**
	 * Encrypt sensitive data (like API keys) using AES-256-GCM
	 * @param plaintext The data to encrypt
	 * @param masterPassword A master password for key derivation
	 * @param options Encryption options
	 * @returns Encrypted data with metadata
	 */
	async encryptData(
		plaintext: string,
		masterPassword: string,
		options: EncryptionOptions = {}
	): Promise<EncryptedData> {
		if (!browser) {
			throw new Error('Encryption service only available in browser environment');
		}

		if (!crypto?.subtle) {
			throw new Error('Web Crypto API not available - HTTPS required');
		}

		try {
			const iterations = options.iterations || this.defaultIterations;
			const keyVersion = options.keyVersion || 1;

			// Generate random salt and IV
			const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
			const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

			// Derive encryption key from master password
			const derivedKey = await this.deriveKey(masterPassword, salt, iterations);

			// Encrypt the plaintext
			const encoder = new TextEncoder();
			const plaintextBytes = encoder.encode(plaintext);

			const encryptedBytes = await crypto.subtle.encrypt(
				{
					name: this.algorithm,
					iv: iv
				},
				derivedKey,
				plaintextBytes
			);

			// Convert to base64 for storage
			const encryptedData = this.arrayBufferToBase64(encryptedBytes);
			const ivBase64 = this.arrayBufferToBase64(iv);
			const saltBase64 = this.arrayBufferToBase64(salt);

			return {
				encryptedData,
				iv: ivBase64,
				salt: saltBase64,
				keyVersion
			};
		} catch (error) {
			console.error('Encryption failed:', error);
			throw new Error(
				'Failed to encrypt data: ' + (error instanceof Error ? error.message : 'Unknown error')
			);
		}
	}

	/**
	 * Decrypt data encrypted with encryptData
	 * @param encryptedData The encrypted data object
	 * @param masterPassword The master password used for encryption
	 * @param iterations PBKDF2 iterations (should match encryption)
	 * @returns Decrypted plaintext
	 */
	async decryptData(
		encryptedData: EncryptedData,
		masterPassword: string,
		iterations?: number
	): Promise<string> {
		if (!browser) {
			throw new Error('Decryption service only available in browser environment');
		}

		if (!crypto?.subtle) {
			throw new Error('Web Crypto API not available - HTTPS required');
		}

		try {
			const actualIterations = iterations || this.defaultIterations;

			// Convert base64 back to arrays
			const salt = this.base64ToArrayBuffer(encryptedData.salt);
			const iv = this.base64ToArrayBuffer(encryptedData.iv);
			const ciphertext = this.base64ToArrayBuffer(encryptedData.encryptedData);

			// Derive the same key used for encryption
			const derivedKey = await this.deriveKey(
				masterPassword,
				new Uint8Array(salt),
				actualIterations
			);

			// Decrypt the data
			const decryptedBytes = await crypto.subtle.decrypt(
				{
					name: this.algorithm,
					iv: new Uint8Array(iv)
				},
				derivedKey,
				ciphertext
			);

			// Convert back to string
			const decoder = new TextDecoder();
			return decoder.decode(decryptedBytes);
		} catch (error) {
			console.error('Decryption failed:', error);
			// Don't expose detailed error information for security
			throw new Error('Failed to decrypt data - invalid password or corrupted data');
		}
	}

	/**
	 * Derive a cryptographic key from a password using PBKDF2
	 * @param password The master password
	 * @param salt Random salt for key derivation
	 * @param iterations Number of PBKDF2 iterations
	 * @returns Derived CryptoKey for AES
	 */
	private async deriveKey(
		password: string,
		salt: Uint8Array,
		iterations: number
	): Promise<CryptoKey> {
		// Import the password as key material
		const encoder = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			encoder.encode(password),
			this.keyDerivationAlgorithm,
			false,
			['deriveKey']
		);

		// Derive the actual encryption key
		return crypto.subtle.deriveKey(
			{
				name: this.keyDerivationAlgorithm,
				salt: salt,
				iterations: iterations,
				hash: this.hashAlgorithm
			},
			keyMaterial,
			{
				name: this.algorithm,
				length: this.keyLength
			},
			false,
			['encrypt', 'decrypt']
		);
	}

	/**
	 * Generate a secure random master password
	 * @param length Password length (default: 32 characters)
	 * @returns Cryptographically secure random password
	 */
	generateMasterPassword(length: number = 32): string {
		if (!browser || !crypto?.getRandomValues) {
			throw new Error('Secure random generation not available');
		}

		const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
		const randomBytes = crypto.getRandomValues(new Uint8Array(length));

		return Array.from(randomBytes)
			.map((byte) => charset[byte % charset.length])
			.join('');
	}

	/**
	 * Validate that Web Crypto API is available and functional
	 * @returns True if encryption is supported
	 */
	isSupported(): boolean {
		return (
			browser &&
			typeof crypto !== 'undefined' &&
			typeof crypto.subtle !== 'undefined' &&
			typeof crypto.getRandomValues !== 'undefined'
		);
	}

	/**
	 * Get encryption strength information
	 * @returns Details about the encryption implementation
	 */
	getEncryptionInfo() {
		return {
			algorithm: this.algorithm,
			keyLength: this.keyLength,
			keyDerivation: this.keyDerivationAlgorithm,
			hashAlgorithm: this.hashAlgorithm,
			defaultIterations: this.defaultIterations,
			ivLength: this.ivLength,
			saltLength: this.saltLength,
			isSupported: this.isSupported()
		};
	}

	// Utility methods for base64 conversion
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}
}

// Export singleton instance
export const encryptionService = new EncryptionService();
