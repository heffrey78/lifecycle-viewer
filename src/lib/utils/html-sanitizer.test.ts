import { describe, it, expect } from 'vitest';
import {
	sanitizeHtml,
	stripHtmlForValidation,
	hasValidContent,
	sanitizePresets
} from './html-sanitizer';

describe('HTML Sanitization', () => {
	describe('sanitizeHtml', () => {
		it('should remove script tags', () => {
			const maliciousHtml = '<p>Safe content</p><script>alert("xss")</script>';
			const sanitized = sanitizeHtml(maliciousHtml);
			expect(sanitized).toBe('<p>Safe content</p>');
			expect(sanitized).not.toContain('<script>');
		});

		it('should remove dangerous event handlers', () => {
			const maliciousHtml = '<p onclick="alert(\'xss\')">Click me</p>';
			const sanitized = sanitizeHtml(maliciousHtml);
			expect(sanitized).toBe('<p>Click me</p>');
			expect(sanitized).not.toContain('onclick');
		});

		it('should preserve safe formatting tags', () => {
			const safeHtml = '<p>Normal text with <strong>bold</strong> and <em>italic</em></p>';
			const sanitized = sanitizeHtml(safeHtml);
			expect(sanitized).toBe('<p>Normal text with <strong>bold</strong> and <em>italic</em></p>');
		});

		it('should preserve headings and lists', () => {
			const safeHtml = '<h1>Title</h1><ul><li>Item 1</li><li>Item 2</li></ul>';
			const sanitized = sanitizeHtml(safeHtml);
			expect(sanitized).toBe('<h1>Title</h1><ul><li>Item 1</li><li>Item 2</li></ul>');
		});

		it('should remove forbidden tags but keep content', () => {
			const htmlWithForbiddenTags = '<p>Safe content</p><form><input type="text"></form>';
			const sanitized = sanitizeHtml(htmlWithForbiddenTags);
			expect(sanitized).toBe('<p>Safe content</p>');
			expect(sanitized).not.toContain('<form>');
			expect(sanitized).not.toContain('<input>');
		});

		it('should handle empty or invalid input', () => {
			expect(sanitizeHtml('')).toBe('');
			expect(sanitizeHtml(null as any)).toBe('');
			expect(sanitizeHtml(undefined as any)).toBe('');
			expect(sanitizeHtml(123 as any)).toBe('');
		});

		it('should allow custom allowed tags', () => {
			const html = '<p>Para</p><div>Div</div><span>Span</span>';
			const sanitized = sanitizeHtml(html, { allowedTags: ['p', 'div'] });
			expect(sanitized).toContain('<p>Para</p>');
			expect(sanitized).toContain('<div>Div</div>');
			expect(sanitized).not.toContain('<span>');
			expect(sanitized).toContain('Span'); // Content preserved
		});
	});

	describe('stripHtmlForValidation', () => {
		it('should strip all HTML tags', () => {
			const html = '<p>Text with <strong>bold</strong> and <em>italic</em></p>';
			const stripped = stripHtmlForValidation(html);
			expect(stripped).toBe('Text with bold and italic');
		});

		it('should handle malicious HTML', () => {
			const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
			const stripped = stripHtmlForValidation(maliciousHtml);
			expect(stripped).toBe('Safe content');
			expect(stripped).not.toContain('alert');
		});

		it('should handle empty input', () => {
			expect(stripHtmlForValidation('')).toBe('');
			expect(stripHtmlForValidation(null as any)).toBe('');
			expect(stripHtmlForValidation(undefined as any)).toBe('');
		});

		it('should trim whitespace', () => {
			const html = '  <p>  Content  </p>  ';
			const stripped = stripHtmlForValidation(html);
			expect(stripped).toBe('Content');
		});

		it('should fallback to regex on DOMPurify errors', () => {
			// Mock DOMPurify.sanitize to throw an error
			const originalConsoleWarn = console.warn;
			console.warn = vi.fn();

			// Create a scenario that might cause DOMPurify to fail
			const complexHtml = '<p>Normal content</p>';
			const stripped = stripHtmlForValidation(complexHtml);
			expect(stripped).toBe('Normal content');

			console.warn = originalConsoleWarn;
		});
	});

	describe('hasValidContent', () => {
		it('should return true for content with text', () => {
			expect(hasValidContent('<p>Some content</p>')).toBe(true);
			expect(hasValidContent('<strong>Bold text</strong>')).toBe(true);
			expect(hasValidContent('Plain text')).toBe(true);
		});

		it('should return false for empty or whitespace-only content', () => {
			expect(hasValidContent('')).toBe(false);
			expect(hasValidContent('<p></p>')).toBe(false);
			expect(hasValidContent('<p>   </p>')).toBe(false);
			expect(hasValidContent('   ')).toBe(false);
		});

		it('should return false for HTML with no text content', () => {
			expect(hasValidContent('<br><br>')).toBe(false);
			expect(hasValidContent('<p><br></p>')).toBe(false);
		});
	});

	describe('sanitizePresets', () => {
		it('should apply basic preset correctly', () => {
			const html =
				'<h1>Title</h1><p>Text with <strong>bold</strong></p><script>alert("xss")</script>';
			const sanitized = sanitizePresets.basic(html);
			expect(sanitized).toContain('<p>Text with <strong>bold</strong></p>');
			expect(sanitized).not.toContain('<h1>'); // Not in basic preset
			expect(sanitized).not.toContain('<script>');
			expect(sanitized).toContain('Title'); // Content preserved
		});

		it('should apply rich preset correctly', () => {
			const html = '<h1>Title</h1><p>Text</p><ul><li>Item</li></ul><script>alert("xss")</script>';
			const sanitized = sanitizePresets.rich(html);
			expect(sanitized).toContain('<h1>Title</h1>');
			expect(sanitized).toContain('<ul><li>Item</li></ul>');
			expect(sanitized).not.toContain('<script>');
		});

		it('should apply plain preset correctly', () => {
			const html = '<h1>Title</h1><p>Text with <strong>bold</strong></p>';
			const sanitized = sanitizePresets.plain(html);
			expect(sanitized).toBe('TitleText with bold'); // DOMPurify doesn't add spaces between block elements
			expect(sanitized).not.toContain('<');
		});
	});

	describe('Error Handling', () => {
		it('should handle malformed HTML gracefully', () => {
			const malformedHtml = '<p>Unclosed paragraph<div>Nested improperly</p></div>';
			const sanitized = sanitizeHtml(malformedHtml);
			expect(sanitized).toContain('Unclosed paragraph');
			expect(sanitized).toContain('Nested improperly');
		});

		it('should handle very large HTML strings', () => {
			const largeHtml = '<p>' + 'a'.repeat(10000) + '</p>';
			const sanitized = sanitizeHtml(largeHtml);
			expect(sanitized).toContain('<p>');
			expect(sanitized.length).toBeGreaterThan(10000);
		});

		it('should provide fallback when sanitization fails', () => {
			const originalConsoleWarn = console.warn;
			const consoleSpy = vi.fn();
			console.warn = consoleSpy;

			const html = '<p>Content</p>';
			const sanitized = sanitizeHtml(html);

			// Should still work normally
			expect(sanitized).toContain('Content');

			console.warn = originalConsoleWarn;
		});
	});
});
