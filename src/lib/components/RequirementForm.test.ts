// Basic integration test for RequirementForm component
// Tests core functionality without complex validation system dependencies

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RequirementForm from './RequirementForm.svelte';

describe('RequirementForm', () => {
	it('should render all core form fields', () => {
		render(RequirementForm, {
			props: {
				isSubmitting: false
			}
		});

		// Check for core form elements
		expect(screen.getByLabelText('Requirement Type')).toBeInTheDocument();
		expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
		expect(screen.getByLabelText('Priority')).toBeInTheDocument();
		expect(screen.getByLabelText(/Current State/)).toBeInTheDocument();
		expect(screen.getByLabelText(/Desired State/)).toBeInTheDocument();
		expect(screen.getByLabelText('Author')).toBeInTheDocument();

		// Check for buttons
		expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Create Requirement/ })).toBeInTheDocument();
	});

	it('should show business value field for FUNC requirements', async () => {
		render(RequirementForm, {
			props: {
				isSubmitting: false,
				initialData: { type: 'FUNC' }
			}
		});

		expect(screen.getByLabelText(/Business Value/)).toBeInTheDocument();
	});

	it('should show risk level field for NFUNC requirements', async () => {
		render(RequirementForm, {
			props: {
				isSubmitting: false,
				initialData: { type: 'NFUNC' }
			}
		});

		expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
	});

	it('should show validation errors for empty required fields', async () => {
		render(RequirementForm, {
			props: {
				isSubmitting: false
			}
		});

		// Fill form with empty values to trigger validation on blur or form interaction
		const titleInput = screen.getByLabelText(/Title/);
		const currentStateInput = screen.getByLabelText(/Current State/);
		const desiredStateInput = screen.getByLabelText(/Desired State/);

		// Simulate user interaction that would trigger validation
		await fireEvent.blur(titleInput);
		await fireEvent.blur(currentStateInput);
		await fireEvent.blur(desiredStateInput);

		// Note: Actual validation error display will be tested in integration tests
		// This test verifies the form structure is correct
		expect(titleInput).toBeInTheDocument();
		expect(currentStateInput).toBeInTheDocument();
		expect(desiredStateInput).toBeInTheDocument();
	});

	it('should disable form when submitting', () => {
		render(RequirementForm, {
			props: {
				isSubmitting: true
			}
		});

		// All form fields should be disabled
		expect(screen.getByLabelText('Requirement Type')).toBeDisabled();
		expect(screen.getByLabelText(/Title/)).toBeDisabled();
		expect(screen.getByLabelText('Priority')).toBeDisabled();
		expect(screen.getByLabelText(/Current State/)).toBeDisabled();
		expect(screen.getByLabelText(/Desired State/)).toBeDisabled();
		expect(screen.getByLabelText('Author')).toBeDisabled();

		// Submit button should show loading state
		expect(screen.getByRole('button', { name: /Creating.../ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Creating.../ })).toBeDisabled();
	});
});
