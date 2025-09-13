import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],
	kit: {
		// Use Node.js adapter for production deployment
		// Builds for Node.js servers and supports WebSocket connections
		adapter: adapter({
			// Enable production optimizations
			out: 'build',
			precompress: false,
			envPrefix: ''
		})
	},
	extensions: ['.svelte', '.svx']
};

export default config;
