import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			external: (id) => {
				// Externalize JSDOM for client builds
				return id === 'jsdom';
			}
		}
	},
	optimizeDeps: {
		exclude: ['jsdom']
	},
	test: {
		globals: true,
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
			exclude: ['node_modules/', 'src/lib/test-utils/', '**/*.d.ts', '**/*.config.*'],
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
					name: 'component',
					environment: 'jsdom',
					globals: true,
					include: [
						'src/lib/components/**/*.{test,spec}.{js,ts}',
						'src/routes/**/*.{test,spec}.{js,ts}'
					],
					exclude: [
						'src/lib/server/**',
						'src/lib/components/browser-tests/**'
					],
					setupFiles: ['./src/lib/test-utils/setup.ts']
				},
				define: {
					// Ensure Svelte runs in browser mode
					'process.env.NODE_ENV': '"test"',
					global: 'globalThis'
				},
				resolve: {
					conditions: ['browser']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					globals: true,
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: [
						'src/lib/components/**/*.{test,spec}.{js,ts}',
						'src/routes/**/*.{test,spec}.{js,ts}'
					],
					setupFiles: ['./src/lib/test-utils/setup-server.ts'],
					coverage: {
						provider: 'v8',
						reporter: ['text', 'html', 'json'],
						reportsDirectory: './coverage/server',
						include: [
							'src/lib/services/**/*.{js,ts}',
							'src/lib/types/**/*.{js,ts}',
							'src/lib/validation/**/*.{js,ts}',
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
	},
	define: {
		// Enable DOM APIs in test environment
		global: 'globalThis'
	}
});
