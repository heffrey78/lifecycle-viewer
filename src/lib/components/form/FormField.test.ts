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

describe('FormField Component', () => {
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(async () => {
		// Clear any previous DOM state
		document.body.innerHTML = '';
		// Setup user event after DOM is ready
		user = userEvent.setup();
	});

	describe('Basic Rendering', () => {
		it('should render text input with label', () => {
			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					type: 'text'
				}
			});

			expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
			expect(screen.getByRole('textbox')).toBeInTheDocument();
		});

		it('should render required indicator when required', () => {
			render(FormField, {
				props: {
					label: 'Required Field',
					fieldId: 'required-field',
					required: true
				}
			});

			expect(screen.getByTitle('This field is required')).toBeInTheDocument();
		});

		it('should render textarea when type is textarea', () => {
			render(FormField, {
				props: {
					label: 'Description',
					fieldId: 'description',
					type: 'textarea',
					rows: 5
				}
			});

			const textarea = screen.getByLabelText('Description');
			expect(textarea.tagName).toBe('TEXTAREA');
			expect(textarea).toHaveAttribute('rows', '5');
		});

		it('should render select with options', () => {
			const options = [
				{ value: 'option1', label: 'Option 1' },
				{ value: 'option2', label: 'Option 2' }
			];

			render(FormField, {
				props: {
					label: 'Select Field',
					fieldId: 'select-field',
					type: 'select',
					options
				}
			});

			const select = screen.getByLabelText('Select Field');
			expect(select.tagName).toBe('SELECT');
			expect(screen.getByText('Option 1')).toBeInTheDocument();
			expect(screen.getByText('Option 2')).toBeInTheDocument();
		});

		it('should render multi-select', () => {
			const options = [
				{ value: 'option1', label: 'Option 1' },
				{ value: 'option2', label: 'Option 2' }
			];

			render(FormField, {
				props: {
					label: 'Multi Select',
					fieldId: 'multi-select',
					type: 'multi-select',
					options,
					value: ['option1']
				}
			});

			const select = screen.getByLabelText('Multi Select');
			expect(select).toHaveAttribute('multiple');
		});
	});

	describe('Validation Display', () => {
		it('should display validation errors after interaction', async () => {
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

			const input = screen.getByLabelText('Test Field');

			// Initially no errors shown (no interaction yet)
			expect(screen.queryByText('This field is required')).not.toBeInTheDocument();

			// Trigger interaction
			await user.click(input);
			await user.tab();

			// Now errors should be shown
			expect(screen.getByText('This field is required')).toBeInTheDocument();
			expect(screen.getByText('Must be at least 3 characters')).toBeInTheDocument();
		});

		it('should display validation warnings', async () => {
			const validation: FieldValidationResult = {
				isValid: true,
				errors: [],
				warnings: ['This value might cause issues']
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = screen.getByLabelText('Test Field');
			await user.click(input);
			await user.tab();

			expect(screen.getByText('This value might cause issues')).toBeInTheDocument();
		});

		it('should apply error styling when validation fails', async () => {
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

			const input = screen.getByLabelText('Test Field');
			await user.click(input);
			await user.tab();

			expect(input).toHaveClass('border-red-500');
			expect(input).toHaveAttribute('aria-invalid', 'true');
		});
	});

	describe('Event Handling', () => {
		it('should dispatch input events', async () => {
			const events: any[] = [];

			const { component } = render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					value: ''
				},
				events: {
					input: (event) => events.push(event.detail)
				}
			});

			const input = screen.getByLabelText('Test Field');
			await user.type(input, 'hello');

			expect(events).toHaveLength(5); // One for each character
			expect(events[events.length - 1].value).toBe('hello');
		});

		it('should dispatch focus and blur events', async () => {
			const focusEvents: any[] = [];
			const blurEvents: any[] = [];

			const { component } = render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					value: 'test'
				},
				events: {
					focus: (event) => focusEvents.push(event.detail),
					blur: (event) => blurEvents.push(event.detail)
				}
			});

			const input = screen.getByLabelText('Test Field');
			await user.click(input);
			await user.tab();

			expect(focusEvents).toHaveLength(1);
			expect(focusEvents[0].value).toBe('test');
			expect(blurEvents).toHaveLength(1);
			expect(blurEvents[0].value).toBe('test');
		});
	});

	describe('Accessibility', () => {
		it('should set proper aria attributes', () => {
			render(FormField, {
				props: {
					label: 'Accessible Field',
					fieldId: 'accessible-field',
					required: true
				}
			});

			const input = document.getElementById('accessible-field');
			expect(input).toBeInTheDocument();
			expect(input).toHaveAttribute('aria-describedby');
			expect(input).toHaveAttribute('id', 'accessible-field');
		});

		it('should associate label with input', () => {
			render(FormField, {
				props: {
					label: 'Associated Field',
					fieldId: 'associated-field'
				}
			});

			const label = screen.getByText('Associated Field');
			const input = screen.getByLabelText('Associated Field');

			expect(label).toHaveAttribute('for', 'associated-field');
			expect(input).toHaveAttribute('id', 'associated-field');
		});

		it('should set aria-invalid when validation fails', async () => {
			const validation: FieldValidationResult = {
				isValid: false,
				errors: ['Invalid']
			};

			render(FormField, {
				props: {
					label: 'Test Field',
					fieldId: 'test-field',
					validation
				}
			});

			const input = screen.getByLabelText('Test Field');
			await user.click(input);
			await user.tab();

			expect(input).toHaveAttribute('aria-invalid', 'true');
		});
	});

	describe('Help Text and Character Count', () => {
		it('should display help text', () => {
			render(FormField, {
				props: {
					label: 'Field with Help',
					fieldId: 'help-field',
					helpText: 'This is helpful information'
				}
			});

			expect(screen.getByText('This is helpful information')).toBeInTheDocument();
		});

		it('should display character count for textarea with maxLength', () => {
			render(FormField, {
				props: {
					label: 'Limited Text',
					fieldId: 'limited-text',
					type: 'textarea',
					maxLength: 100,
					value: 'Hello world'
				}
			});

			expect(screen.getByText('11/100 characters')).toBeInTheDocument();
		});
	});

	describe('Disabled State', () => {
		it('should disable input when disabled prop is true', () => {
			render(FormField, {
				props: {
					label: 'Disabled Field',
					fieldId: 'disabled-field',
					disabled: true
				}
			});

			const input = screen.getByLabelText('Disabled Field');
			expect(input).toBeDisabled();
			expect(input).toHaveClass('cursor-not-allowed');
		});
	});

	describe('Select Handling', () => {
		it('should handle single select value changes', async () => {
			const events: any[] = [];
			const options = [
				{ value: 'a', label: 'Option A' },
				{ value: 'b', label: 'Option B' }
			];

			const { component } = render(FormField, {
				props: {
					label: 'Select Field',
					fieldId: 'select-field',
					type: 'select',
					options,
					value: ''
				},
				events: {
					input: (event) => events.push(event.detail)
				}
			});

			const select = screen.getByLabelText('Select Field');
			await user.selectOptions(select, 'a');

			expect(events).toHaveLength(1);
			expect(events[0].value).toBe('a');
		});

		it('should handle multi-select value changes', async () => {
			const events: any[] = [];
			const options = [
				{ value: 'a', label: 'Option A' },
				{ value: 'b', label: 'Option B' },
				{ value: 'c', label: 'Option C' }
			];

			const { component } = render(FormField, {
				props: {
					label: 'Multi Select',
					fieldId: 'multi-select',
					type: 'multi-select',
					options,
					value: []
				},
				events: {
					input: (event) => events.push(event.detail)
				}
			});

			const select = screen.getByLabelText('Multi Select');
			await user.selectOptions(select, ['a', 'c']);

			// Multi-select may trigger multiple events as options are selected
			expect(events.length).toBeGreaterThan(0);
			expect(events[events.length - 1].value).toEqual(['a', 'c']);
		});
	});
});
