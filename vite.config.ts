import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json'],
			reportsDirectory: './coverage',
			include: [
				'src/lib/**/*.{js,ts}',
				'!src/lib/**/*.{test,spec}.{js,ts}',
				'!src/lib/test-utils/**'
			],
			exclude: [
				'node_modules/',
				'src/lib/test-utils/',
				'**/*.d.ts',
				'**/*.config.*'
			],
			thresholds: {
				global: {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80
				},
				// Specific thresholds for core services
				'src/lib/services/mcp-client.ts': {
					branches: 85,
					functions: 85,
					lines: 85,
					statements: 85
				}
			}
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					coverage: {
						provider: 'v8',
						reporter: ['text', 'html', 'json'],
						reportsDirectory: './coverage/server',
						include: [
							'src/lib/services/**/*.{js,ts}',
							'src/lib/types/**/*.{js,ts}',
							'!src/lib/**/*.{test,spec}.{js,ts}',
							'!src/lib/test-utils/**'
						],
						thresholds: {
							global: {
								branches: 80,
								functions: 80,
								lines: 80,
								statements: 80
							}
						}
					}
				}
			}
		]
	}
});
