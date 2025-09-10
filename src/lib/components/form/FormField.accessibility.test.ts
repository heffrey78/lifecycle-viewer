import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FormField from './FormField.svelte';
import type { FieldValidationResult } from '$lib/validation/validator.js';

// Mock the theme provider
vi.mock('$lib/theme', () => ({
	currentTheme: {
		subscribe: vi.fn((fn) => {
			fn({
				base: {
					background: '#ffffff',
					foreground: '#000000',
					muted: '#6b7280'
				}
			});
			return { unsubscribe: vi.fn() };
		})
	}
}));

describe('FormField Accessibility Features', () => {
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(async () => {
		document.body.innerHTML = '';
		user = userEvent.setup();
	});

	describe('ARIA Live Regions', () => {
		it('should announce validation errors to screen readers', async () => {
			const validation: FieldValidationResult = {
				isValid: false,
				errors: ['This field is required', 'Must be at least 3 characters']
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = document.getElementById('test-field');
			expect(input).toBeInTheDocument();

			// Trigger interaction to show validation
			await user.click(input!);
			await user.tab();

			// Check for ARIA live region with assertive priority
			const liveRegion = document.querySelector('[aria-live="assertive"]');
			expect(liveRegion).toBeInTheDocument();
			expect(liveRegion).toHaveTextContent(
				'Validation error in Test Field: This field is required, Must be at least 3 characters'
			);
		});

		it('should have proper ARIA attributes on error container', async () => {
			const validation: FieldValidationResult = {
				isValid: false,
				errors: ['Invalid value']
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = document.getElementById('test-field');
			await user.click(input!);
			await user.tab();

			// Check error container has proper ARIA attributes
			const errorContainer = document.getElementById('test-field-error');
			expect(errorContainer).toBeInTheDocument();
			expect(errorContainer).toHaveAttribute('role', 'alert');
			expect(errorContainer).toHaveAttribute('aria-live', 'polite');
			expect(errorContainer).toHaveAttribute('aria-atomic', 'true');
		});

		it('should not show live regions when no errors', async () => {
			const validation: FieldValidationResult = {
				isValid: true,
				errors: []
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			// No live regions should be present when no errors
			const liveRegions = document.querySelectorAll('[aria-live="assertive"]');
			expect(liveRegions).toHaveLength(0);
		});
	});

	describe('Screen Reader Classes', () => {
		it('should have screen reader only elements for accessibility', async () => {
			const validation: FieldValidationResult = {
				isValid: false,
				errors: ['Error message']
			};

			const { container } = render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = document.getElementById('test-field');
			await user.click(input!);
			await user.tab();

			// Check that sr-only class is applied to screen reader elements
			const srOnlyElements = container.querySelectorAll('.sr-only');
			expect(srOnlyElements.length).toBeGreaterThan(0);

			// Verify the element has content for screen readers
			const srOnlyElement = srOnlyElements[0];
			expect(srOnlyElement.textContent).toBeTruthy();
		});
	});

	describe('ARIA Invalid States', () => {
		it('should set aria-invalid to true when field has errors', async () => {
			const validation: FieldValidationResult = {
				isValid: false,
				errors: ['Invalid value']
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = document.getElementById('test-field');
			await user.click(input!);
			await user.tab();

			expect(input).toHaveAttribute('aria-invalid', 'true');
		});

		it('should not have aria-invalid when field is valid', async () => {
			const validation: FieldValidationResult = {
				isValid: true,
				errors: []
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = document.getElementById('test-field');
			await user.click(input!);
			await user.tab();

			expect(input).not.toHaveAttribute('aria-invalid');
		});
	});

	describe('Field Associations', () => {
		it('should properly associate error messages with input', async () => {
			const validation: FieldValidationResult = {
				isValid: false,
				errors: ['Required field']
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation,
					helpText: 'Help text'
				}
			});

			const input = document.getElementById('test-field');
			await user.click(input!);
			await user.tab();

			// Input should be associated with both error and help text
			expect(input).toHaveAttribute('aria-describedby');
			const describedBy = input!.getAttribute('aria-describedby');
			expect(describedBy).toContain('test-field-error');
			expect(describedBy).toContain('test-field-help');
		});
	});

	describe('Dynamic Announcements', () => {
		it('should announce validation changes dynamically', async () => {
			const validationWithErrors: FieldValidationResult = {
				isValid: false,
				errors: ['New error']
			};

			// Start with a component that has validation errors
			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation: validationWithErrors
				}
			});

			const input = document.getElementById('test-field');
			await user.click(input!);
			await user.tab(); // Trigger blur to show validation

			// Should have live region with errors
			const liveRegions = document.querySelectorAll('[aria-live="assertive"]');
			expect(liveRegions.length).toBeGreaterThan(0);

			const liveRegion = liveRegions[0];
			expect(liveRegion.textContent).toContain('Validation error in Test Field: New error');
		});
	});
});
