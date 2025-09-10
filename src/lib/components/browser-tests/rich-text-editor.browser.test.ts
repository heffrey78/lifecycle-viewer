import { test, expect } from '@playwright/test';

test.describe('RichTextEditor Cross-Browser', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test-editor'); // Navigate to test page with rich text editor
	});

	test('should render rich text editor toolbar in all browsers', async ({ page }) => {
		// Test basic rendering
		await expect(page.locator('[role="toolbar"]')).toBeVisible();
		await expect(page.locator('button[title="Bold (Ctrl+B)"]')).toBeVisible();
	});

	test('should handle text formatting across browsers', async ({ page }) => {
		const editor = page.locator('[role="textbox"]').first();

		// Type some text
		await editor.fill('Test content');

		// Apply bold formatting
		await page.locator('button[title="Bold (Ctrl+B)"]').click();
		await editor.type(' bold text');

		// Verify HTML content contains strong tags
		const content = await editor.innerHTML();
		expect(content).toContain('<strong>bold text</strong>');
	});

	test('should maintain accessibility across browsers', async ({ page }) => {
		// Test keyboard navigation
		await page.keyboard.press('Tab');
		await expect(page.locator('[role="toolbar"] button').first()).toBeFocused();

		// Test ARIA attributes
		const toolbar = page.locator('[role="toolbar"]');
		await expect(toolbar).toHaveAttribute('aria-label', 'Rich text formatting toolbar');
	});

	test('should handle fallback mode gracefully', async ({ page }) => {
		// Simulate editor failure by blocking Tiptap resources
		await page.route('**/tiptap/**', (route) => route.abort());

		// Reload page to trigger fallback
		await page.reload();

		// Should show fallback textarea
		await expect(page.locator('textarea')).toBeVisible();
		await expect(page.getByText('Rich text editor unavailable')).toBeVisible();
	});

	test('should sanitize HTML content across browsers', async ({ page }) => {
		const editor = page.locator('[role="textbox"]').first();

		// Try to inject malicious content
		await editor.fill('<script>alert("xss")</script><p>Safe content</p>');

		// Content should be sanitized
		const content = await editor.innerHTML();
		expect(content).not.toContain('<script>');
		expect(content).toContain('Safe content');
	});
});
