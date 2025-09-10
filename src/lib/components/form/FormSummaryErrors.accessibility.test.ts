import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FormSummaryErrors from './FormSummaryErrors.svelte';
import type { ValidationResult } from '$lib/validation/schemas.js';

describe('FormSummaryErrors Accessibility Features', () => {
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(async () => {
		document.body.innerHTML = '';
		user = userEvent.setup();
	});

	describe('Keyboard Navigation', () => {
		it('should focus field when clicking error link', async () => {
			// Create a mock input element
			const mockInput = document.createElement('input');
			mockInput.id = 'test-field';
			document.body.appendChild(mockInput);

			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			await user.click(errorButton);

			expect(document.activeElement).toBe(mockInput);
		});

		it('should support keyboard navigation with Enter key', async () => {
			// Create a mock input element
			const mockInput = document.createElement('input');
			mockInput.id = 'test-field';
			document.body.appendChild(mockInput);

			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			await user.type(errorButton, '{Enter}');

			expect(document.activeElement).toBe(mockInput);
		});

		it('should support keyboard navigation with Space key', async () => {
			// Create a mock input element
			const mockInput = document.createElement('input');
			mockInput.id = 'test-field';
			document.body.appendChild(mockInput);

			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			await user.type(errorButton, ' ');

			expect(document.activeElement).toBe(mockInput);
		});

		it('should have proper accessibility attributes', async () => {
			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });

			// Button should have proper ARIA attributes for accessibility
			expect(errorButton).toHaveAttribute('aria-describedby');
			expect(errorButton).toHaveAttribute('type', 'button');

			// Button should be in the document and accessible
			expect(errorButton).toBeInTheDocument();
		});
	});

	describe('Screen Reader Announcements', () => {
		it('should create screen reader announcements when focusing fields', async () => {
			// Create a mock input element
			const mockInput = document.createElement('input');
			mockInput.id = 'test-field';
			document.body.appendChild(mockInput);

			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			await user.click(errorButton);

			// Check that an announcement element was created
			const announcements = document.querySelectorAll('[aria-live="polite"].sr-only');
			expect(announcements.length).toBeGreaterThan(0);

			const announcement = announcements[0];
			expect(announcement.textContent).toContain('Focused on Test Field field with error');
		});

		it('should clean up announcement elements after timeout', async () => {
			// Create a mock input element
			const mockInput = document.createElement('input');
			mockInput.id = 'test-field';
			document.body.appendChild(mockInput);

			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			await user.click(errorButton);

			// Should have announcement initially
			let announcements = document.querySelectorAll('[aria-live="polite"].sr-only');
			expect(announcements.length).toBeGreaterThan(0);

			// Wait for cleanup timeout
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Should be cleaned up
			announcements = document.querySelectorAll('[aria-live="polite"].sr-only');
			expect(announcements).toHaveLength(0);
		});
	});

	describe('ARIA Attributes', () => {
		it('should have proper ARIA attributes on error container', () => {
			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const container = document.querySelector('[role="alert"]');
			expect(container).toBeInTheDocument();
			expect(container).toHaveAttribute('aria-live', 'polite');
		});

		it('should have proper aria-describedby on error buttons', () => {
			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			expect(errorButton).toHaveAttribute('aria-describedby', 'test-field-error-description');
		});
	});

	describe('Field Name Formatting', () => {
		it('should format field names properly for screen readers', () => {
			const validation: ValidationResult = {
				isValid: false,
				errors: {
					user_email_address: ['Invalid email format']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			// Should see formatted field name
			expect(screen.getByText('User Email Address:')).toBeInTheDocument();
		});
	});

	describe('Focus Management', () => {
		it('should scroll field into view when focused', async () => {
			// Mock scrollIntoView
			const scrollIntoView = vi.fn();

			// Create a mock input element with scrollIntoView
			const mockInput = document.createElement('input');
			mockInput.id = 'test-field';
			mockInput.scrollIntoView = scrollIntoView;
			document.body.appendChild(mockInput);

			const validation: ValidationResult = {
				isValid: false,
				errors: {
					'test-field': ['This field is required']
				}
			};

			render(FormSummaryErrors, {
				props: { validation }
			});

			const errorButton = screen.getByRole('button', { name: 'This field is required' });
			await user.click(errorButton);

			expect(scrollIntoView).toHaveBeenCalledWith({
				behavior: 'smooth',
				block: 'center'
			});
		});
	});
});
