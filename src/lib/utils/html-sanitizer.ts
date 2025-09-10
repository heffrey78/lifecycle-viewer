import DOMPurify from 'dompurify';

// Create DOMPurify instance for server-side usage with dynamic JSDOM import
const createServerPurify = async () => {
	const { JSDOM } = await import('jsdom');
	const window = new JSDOM('').window;
	return DOMPurify(window as any);
};

// Server-side DOMPurify instance cache
let serverPurify: any = null;

// Get appropriate DOMPurify instance based on environment
const getPurify = () => {
	if (typeof window !== 'undefined') {
		// Browser environment - use native DOMPurify
		return DOMPurify;
	} else {
		// Server environment - use cached instance or create synchronously for tests
		if (!serverPurify) {
			try {
				const { JSDOM } = require('jsdom');
				const window = new JSDOM('').window;
				serverPurify = DOMPurify(window as any);
			} catch (error) {
				throw new Error('Server-side sanitization requires jsdom: ' + error.message);
			}
		}
		return serverPurify;
	}
};

interface SanitizeOptions {
	allowedTags?: string[];
	allowedAttributes?: string[];
	stripTags?: boolean;
}

/**
 * Sanitizes HTML content to prevent XSS attacks while preserving safe formatting
 * @param html - Raw HTML content to sanitize
 * @param options - Configuration options for sanitization
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
	if (!html || typeof html !== 'string') {
		return '';
	}

	const defaultConfig = {
		ALLOWED_TAGS: [
			'p',
			'br',
			'strong',
			'em',
			's',
			'h1',
			'h2',
			'h3',
			'ul',
			'ol',
			'li',
			'blockquote'
		],
		ALLOWED_ATTR: [], // No attributes allowed for security by default
		KEEP_CONTENT: true,
		RETURN_DOM: false,
		RETURN_DOM_FRAGMENT: false,
		RETURN_DOM_IMPORT: false,
		// Remove any potentially dangerous elements
		FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
		FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload', 'onmouseover']
	};

	const config = {
		...defaultConfig,
		...(options.allowedTags && { ALLOWED_TAGS: options.allowedTags }),
		...(options.allowedAttributes && { ALLOWED_ATTR: options.allowedAttributes })
	};

	try {
		const purify = getPurify();
		return purify.sanitize(html, config);
	} catch (error) {
		console.warn('HTML sanitization failed:', error);
		// Fallback: strip all HTML if sanitization fails
		try {
			const purify = getPurify();
			return purify
				.sanitize(html, {
					ALLOWED_TAGS: [],
					KEEP_CONTENT: true
				})
				.trim();
		} catch (fallbackError) {
			// Ultimate fallback: regex strip
			return html.replace(/<[^>]*>/g, '').trim();
		}
	}
}

/**
 * Strips all HTML tags for validation purposes
 * @param html - HTML content to strip
 * @returns Plain text content without HTML tags
 */
export function stripHtmlForValidation(html: string): string {
	if (!html || typeof html !== 'string') {
		return '';
	}

	try {
		// Strip all HTML for validation purposes
		const purify = getPurify();
		return purify
			.sanitize(html, {
				ALLOWED_TAGS: [],
				KEEP_CONTENT: true
			})
			.trim();
	} catch (error) {
		console.warn('HTML stripping failed:', error);
		// Fallback: basic regex strip (less secure but functional)
		return html.replace(/<[^>]*>/g, '').trim();
	}
}

/**
 * Validates if HTML content contains meaningful text after sanitization
 * @param html - HTML content to validate
 * @returns true if content has meaningful text, false if empty
 */
export function hasValidContent(html: string): boolean {
	const stripped = stripHtmlForValidation(html);
	return stripped.length > 0;
}

/**
 * Sanitizes HTML with custom options for specific use cases
 */
export const sanitizePresets = {
	/**
	 * Basic formatting only - for user-generated content
	 */
	basic: (html: string) =>
		sanitizeHtml(html, {
			allowedTags: ['p', 'br', 'strong', 'em'],
			allowedAttributes: []
		}),

	/**
	 * Rich formatting - for trusted content with full formatting
	 */
	rich: (html: string) =>
		sanitizeHtml(html, {
			allowedTags: [
				'p',
				'br',
				'strong',
				'em',
				's',
				'h1',
				'h2',
				'h3',
				'ul',
				'ol',
				'li',
				'blockquote'
			],
			allowedAttributes: []
		}),

	/**
	 * Plain text only - strips all formatting
	 */
	plain: (html: string) => stripHtmlForValidation(html)
};
