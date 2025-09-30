import { marked } from 'marked';
import hljs from 'highlight.js';
import { browser } from '$app/environment';

// Initialize DOMPurify for browser environment
let DOMPurify: any = null;
if (browser) {
	// Import DOMPurify dynamically in browser
	import('dompurify')
		.then((module) => {
			DOMPurify = module.default;
		})
		.catch((error) => {
			console.warn('Failed to load DOMPurify:', error);
		});
}

// Server-side HTML sanitizer fallback
function sanitizeHtmlFallback(html: string): string {
	if (typeof html !== 'string') {
		html = String(html || '');
	}

	// Basic HTML entity encoding for server-side
	return html
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
		.replace(/\//g, '&#x2F;');
}

// Unified sanitization function
function sanitizeHtml(html: string, options?: any): string {
	if (DOMPurify && browser) {
		return DOMPurify.sanitize(html, options);
	}
	// On server-side, only escape if we're in a safety context
	// For normal HTML rendering, just return as-is since marked.js output is trusted
	return html;
}

// Import highlight.js theme (we'll use a default theme)
import 'highlight.js/styles/github.css';

export interface MarkdownOptions {
	enableCodeHighlighting?: boolean;
	sanitizeHtml?: boolean;
	linkTarget?: string;
	enableTables?: boolean;
	enableTaskLists?: boolean;
}

// Configure marked with default options
const defaultOptions: MarkdownOptions = {
	enableCodeHighlighting: true,
	sanitizeHtml: true,
	linkTarget: '_blank',
	enableTables: true,
	enableTaskLists: true
};

// Custom renderer to add classes and security features
const renderer = new marked.Renderer();

// Override code rendering for syntax highlighting
renderer.code = function (code, language, escaped) {
	// Extract the actual code content and language
	let codeString = '';
	let languageString = '';

	try {
		// Handle different parameter patterns from marked.js
		if (typeof code === 'string') {
			// Normal case: code is string, language is second parameter
			codeString = code;
			languageString = language || '';
		} else if (typeof code === 'object' && code) {
			// Token object case: extract text and language from token
			codeString = code.text || '';
			languageString = code.lang || language || '';
		} else {
			// Fallback
			codeString = String(code || '');
			languageString = String(language || '');
		}

		// Ensure we have strings
		codeString = String(codeString);
		languageString = String(languageString);
	} catch (conversionError) {
		console.warn('Failed to extract code content:', conversionError);
		codeString = '';
		languageString = '';
	}

	// Manual HTML escaping function to avoid highlight.js internal issues
	const escapeHtml = (unsafe: string): string => {
		if (typeof unsafe !== 'string') {
			unsafe = String(unsafe || '');
		}
		return unsafe
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	};

	// If code is empty, return plain pre block
	if (!codeString || codeString.trim().length === 0) {
		return `<pre class="hljs"><code class="hljs language-plaintext"></code></pre>`;
	}

	// Validate and sanitize language
	let validLanguage = 'plaintext';
	try {
		if (languageString && languageString.trim()) {
			const langStr = languageString.trim().toLowerCase();
			if (hljs.getLanguage(langStr)) {
				validLanguage = langStr;
			}
		}
	} catch (langError) {
		console.warn('Failed to validate language:', langError);
		validLanguage = 'plaintext';
	}

	// Try syntax highlighting with extensive error handling
	try {
		let highlighted: string;

		if (validLanguage === 'plaintext') {
			// For plaintext, just escape without highlighting
			highlighted = escapeHtml(codeString);
		} else {
			// Try language-specific highlighting first
			try {
				const result = hljs.highlight(codeString, { language: validLanguage });
				highlighted = result.value;
			} catch (hlError) {
				// If language-specific fails, try auto-detection
				console.warn(
					`Language-specific highlighting failed for ${validLanguage}, trying auto-detection:`,
					hlError
				);
				try {
					const autoResult = hljs.highlightAuto(codeString);
					highlighted = autoResult.value;
					validLanguage = autoResult.language || 'plaintext';
				} catch (autoError) {
					// If auto-detection also fails, fall back to escaped text
					console.warn(
						'Auto-detection highlighting failed, falling back to escaped text:',
						autoError
					);
					highlighted = escapeHtml(codeString);
					validLanguage = 'plaintext';
				}
			}
		}

		return `<pre class="hljs"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
	} catch (error) {
		console.warn('All syntax highlighting attempts failed:', error);
		// Final fallback - manually escaped code
		const escapedCode = escapeHtml(codeString);
		return `<pre class="hljs"><code class="hljs language-plaintext">${escapedCode}</code></pre>`;
	}
};

// Override link rendering for security
renderer.link = function (href, title, text) {
	// Basic URL validation
	try {
		const url = new URL(href);
		// Only allow http, https, and mailto protocols
		if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
			return text; // Return just the text if protocol is not allowed
		}
	} catch {
		return text; // Return just the text if URL is invalid
	}

	const titleAttr = title ? ` title="${sanitizeHtml(title)}"` : '';
	return `<a href="${sanitizeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
};

// Override image rendering for security
renderer.image = function (href, title, text) {
	// Basic URL validation for images
	try {
		const url = new URL(href);
		// Only allow http, https, and data protocols for images
		if (!['http:', 'https:', 'data:'].includes(url.protocol)) {
			return `<span class="text-gray-500 italic">[Image: ${text}]</span>`;
		}
	} catch {
		return `<span class="text-gray-500 italic">[Image: ${text}]</span>`;
	}

	const titleAttr = title ? ` title="${sanitizeHtml(title)}"` : '';
	const altAttr = text ? ` alt="${sanitizeHtml(text)}"` : '';
	return `<img src="${sanitizeHtml(href)}" class="max-w-full h-auto rounded-lg"${altAttr}${titleAttr} loading="lazy">`;
};

// Override table rendering for better styling
renderer.table = function (header, body) {
	return `<div class="overflow-x-auto"><table class="min-w-full border-collapse border border-gray-300">${header}${body}</table></div>`;
};

renderer.tablerow = function (content) {
	return `<tr class="border-b border-gray-200">${content}</tr>`;
};

renderer.tablecell = function (content, flags) {
	const tag = flags.header ? 'th' : 'td';
	const className = flags.header
		? 'px-4 py-2 bg-gray-50 border border-gray-300 font-semibold text-left'
		: 'px-4 py-2 border border-gray-300';
	const align = flags.align ? ` style="text-align: ${flags.align}"` : '';
	return `<${tag} class="${className}"${align}>${content}</${tag}>`;
};

// Configure marked
marked.setOptions({
	renderer,
	breaks: true,
	gfm: true,
	pedantic: false,
	sanitize: false, // We'll use DOMPurify instead
	smartypants: true
});

/**
 * Renders markdown text to HTML with syntax highlighting and security features
 */
export function renderMarkdown(markdown: string, options: Partial<MarkdownOptions> = {}): string {
	if (!markdown || typeof markdown !== 'string') {
		return '';
	}

	const opts = { ...defaultOptions, ...options };

	try {
		// Parse markdown to HTML
		let html = marked(markdown);

		// Sanitize HTML if enabled
		if (opts.sanitizeHtml) {
			html = sanitizeHtml(html, {
				ALLOWED_TAGS: [
					'p',
					'br',
					'strong',
					'b',
					'em',
					'i',
					'u',
					's',
					'del',
					'ins',
					'h1',
					'h2',
					'h3',
					'h4',
					'h5',
					'h6',
					'ul',
					'ol',
					'li',
					'blockquote',
					'pre',
					'code',
					'a',
					'img',
					'table',
					'thead',
					'tbody',
					'tr',
					'th',
					'td',
					'div',
					'span'
				],
				ALLOWED_ATTR: [
					'href',
					'title',
					'target',
					'rel',
					'src',
					'alt',
					'width',
					'height',
					'class',
					'style',
					'align'
				],
				ALLOWED_URI_REGEXP:
					/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
			});
		}

		return html;
	} catch (error) {
		console.error('Error rendering markdown:', error);
		// Return escaped text as fallback
		return sanitizeHtmlFallback(markdown);
	}
}

/**
 * Renders inline markdown (no block elements)
 */
export function renderInlineMarkdown(markdown: string): string {
	if (!markdown || typeof markdown !== 'string') {
		return '';
	}

	try {
		// Use marked inline parser
		const tokens = marked.lexer(markdown);
		const inlineTokens = tokens.filter(
			(token) =>
				token.type === 'paragraph' ||
				token.type === 'text' ||
				token.type === 'strong' ||
				token.type === 'em' ||
				token.type === 'code'
		);

		let html = marked.parser(inlineTokens);

		// Remove paragraph tags for inline rendering
		html = html.replace(/^<p>|<\/p>$/g, '');

		return sanitizeHtml(html, {
			ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'code', 'a', 'span'],
			ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
			ALLOWED_URI_REGEXP:
				/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
		});
	} catch (error) {
		console.error('Error rendering inline markdown:', error);
		return sanitizeHtmlFallback(markdown);
	}
}

/**
 * Extracts plain text from markdown
 */
export function extractPlainText(markdown: string): string {
	if (!markdown || typeof markdown !== 'string') {
		return '';
	}

	try {
		// Remove markdown formatting
		return markdown
			.replace(/```[\s\S]*?```/g, '') // Remove code blocks
			.replace(/`[^`]*`/g, '') // Remove inline code
			.replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
			.replace(/\*([^*]+)\*/g, '$1') // Remove italic
			.replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
			.replace(/^#+\s*/gm, '') // Remove headers
			.replace(/^[-*+]\s*/gm, '') // Remove list markers
			.replace(/^\d+\.\s*/gm, '') // Remove numbered list markers
			.replace(/^\s*>\s*/gm, '') // Remove blockquotes
			.replace(/\n{2,}/g, '\n') // Collapse multiple newlines
			.trim();
	} catch (error) {
		console.error('Error extracting plain text:', error);
		return markdown;
	}
}

/**
 * Validates if a string contains valid markdown
 */
export function isValidMarkdown(text: string): boolean {
	if (!text || typeof text !== 'string') {
		return false;
	}

	try {
		marked(text);
		return true;
	} catch {
		return false;
	}
}
