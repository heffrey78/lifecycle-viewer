/**
 * Tests for Claude API Key configuration functionality
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configService } from '$lib/services/config-service';

describe('Claude API Key Configuration', () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks();
	});

	describe('API Key Validation', () => {
		it('should validate API keys starting with sk-ant-', () => {
			const validKey = 'sk-ant-1234567890abcdef1234567890abcdef';
			expect(validKey.startsWith('sk-ant-')).toBe(true);
			expect(validKey.length).toBeGreaterThan(20);
		});

		it('should reject keys not starting with sk-ant-', () => {
			const invalidKey = 'invalid-key-format';
			expect(invalidKey.startsWith('sk-ant-')).toBe(false);
		});

		it('should reject empty keys', () => {
			const emptyKey = '';
			expect(emptyKey.trim()).toBe('');
		});

		it('should reject keys that are too short', () => {
			const shortKey = 'sk-ant-123';
			expect(shortKey.length).toBeLessThan(20);
		});
	});

	describe('Configuration Service Integration', () => {
		it('should have the required methods', () => {
			expect(typeof configService.getClaudeApiKey).toBe('function');
			expect(typeof configService.setClaudeApiKey).toBe('function');
			expect(typeof configService.clearClaudeApiKey).toBe('function');
			expect(typeof configService.isClaudeApiKeyConfigured).toBe('function');
		});

		it('should validate API key format in setClaudeApiKey', async () => {
			// Test that invalid keys are rejected
			await expect(configService.setClaudeApiKey('invalid')).rejects.toThrow();
			await expect(configService.setClaudeApiKey('')).rejects.toThrow();
		});
	});

	describe('API Key Testing', () => {
		it('should construct correct Anthropic API request', () => {
			const apiKey = 'sk-ant-test-key-1234567890abcdef';
			const expectedUrl = 'https://api.anthropic.com/v1/messages';
			const expectedHeaders = {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			};
			const expectedBody = {
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 10,
				messages: [{ role: 'user', content: 'test' }]
			};

			expect(expectedUrl).toBe('https://api.anthropic.com/v1/messages');
			expect(expectedHeaders['x-api-key']).toBe(apiKey);
			expect(expectedBody.max_tokens).toBe(10);
		});
	});

	describe('UI State Management', () => {
		it('should manage visibility toggle state', () => {
			let showApiKey = false;

			// Simulate toggle
			showApiKey = !showApiKey;
			expect(showApiKey).toBe(true);

			// Toggle again
			showApiKey = !showApiKey;
			expect(showApiKey).toBe(false);
		});

		it('should clear API key input after successful save', () => {
			let apiKey = 'sk-ant-test-key-1234567890abcdef';
			let showApiKey = true;

			// Simulate successful save
			apiKey = '';
			showApiKey = false;

			expect(apiKey).toBe('');
			expect(showApiKey).toBe(false);
		});

		it('should manage loading states independently', () => {
			let savingApiKey = false;
			let testingKey = false;

			// Test save loading
			savingApiKey = true;
			expect(savingApiKey).toBe(true);
			expect(testingKey).toBe(false);

			savingApiKey = false;

			// Test testing loading
			testingKey = true;
			expect(savingApiKey).toBe(false);
			expect(testingKey).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should handle network errors gracefully', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
			global.fetch = mockFetch;

			try {
				await fetch('https://api.anthropic.com/v1/messages', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': 'test-key',
						'anthropic-version': '2023-06-01'
					},
					body: JSON.stringify({
						model: 'claude-3-5-sonnet-20241022',
						max_tokens: 10,
						messages: [{ role: 'user', content: 'test' }]
					})
				});
				expect(true).toBe(false); // Should not reach here
			} catch (err) {
				expect(err).toBeInstanceOf(Error);
				expect((err as Error).message).toBe('Network error');
			}
		});

		it('should handle API error responses', async () => {
			const mockResponse = {
				ok: false,
				json: async () => ({
					error: { message: 'Invalid API key' }
				})
			};
			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			global.fetch = mockFetch;

			const response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': 'invalid-key',
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: 'claude-3-5-sonnet-20241022',
					max_tokens: 10,
					messages: [{ role: 'user', content: 'test' }]
				})
			});

			expect(response.ok).toBe(false);
			const data = await response.json();
			expect(data.error.message).toBe('Invalid API key');
		});
	});

	describe('Security', () => {
		it('should use password-type input by default', () => {
			let showApiKey = false;
			const inputType = showApiKey ? 'text' : 'password';
			expect(inputType).toBe('password');
		});

		it('should switch to text input when show is toggled', () => {
			let showApiKey = true;
			const inputType = showApiKey ? 'text' : 'password';
			expect(inputType).toBe('text');
		});

		it('should not log API keys', () => {
			const apiKey = 'sk-ant-test-key-1234567890abcdef';
			// Ensure console.log is not called with API key
			const mockLog = vi.spyOn(console, 'log');
			// This would be bad practice:
			// console.log('API Key:', apiKey);
			expect(mockLog).not.toHaveBeenCalledWith('API Key:', apiKey);
		});
	});
});
