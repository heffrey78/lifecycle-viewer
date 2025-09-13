import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Add Content Security Policy headers
	const cspDirectives = [
		// Default source - restrict everything by default
		"default-src 'self'",

		// Script sources - allow self, inline scripts (for Svelte), and Tailwind CDN
		// In dev mode, also allow Vite dev server
		`script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com${dev ? " 'unsafe-eval'" : ''}`,

		// Style sources - allow self, inline styles (for dynamic theming), and Tailwind CDN
		"style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",

		// Image sources - allow self and data URLs
		"img-src 'self' data:",

		// Font sources - allow self and data URLs
		"font-src 'self' data:",

		// Connect sources - allow self and WebSocket connections
		// In dev mode, also allow Vite dev server WebSocket
		`connect-src 'self' ws://localhost:3000 wss://localhost:3000${dev ? ' ws://localhost:5173 ws://127.0.0.1:5173' : ''}`,

		// Object and embed sources - disallow for security
		"object-src 'none'",
		"embed-src 'none'",

		// Frame sources - disallow for security
		"frame-src 'none'",

		// Base URI - restrict to self
		"base-uri 'self'",

		// Form action - restrict to self
		"form-action 'self'"
	].join('; ');

	response.headers.set('Content-Security-Policy', cspDirectives);

	// Additional security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

	return response;
};
