<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import FieldError from './FieldError.svelte';
	import RequiredIndicator from './RequiredIndicator.svelte';
	import type { FieldValidationResult } from '$lib/validation/validator.js';
	import { currentTheme } from '$lib/theme';

	// Props
	export let label: string;
	export let fieldId: string;
	export let value: any = '';
	export let type: 'text' | 'email' | 'textarea' | 'select' | 'multi-select' = 'text';
	export let placeholder: string = '';
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let options: Array<{ value: any; label: string }> = [];
	export let rows: number = 3;
	export let maxLength: number | undefined = undefined;
	export let validation: FieldValidationResult | null = null;
	export let helpText: string = '';
	export let autocomplete: string = '';

	// Internal state
	let fieldElement: HTMLElement;
	let isFocused = false;
	let hasInteracted = false;
	let announceValidation = false;

	// Computed properties
	$: hasErrors = validation?.errors && validation.errors.length > 0;
	$: hasWarnings = validation?.warnings && validation.warnings.length > 0;
	$: showValidation = hasInteracted && validation;
	$: fieldClasses = getFieldClasses(hasErrors, isFocused, disabled);
	$: labelClasses = getLabelClasses(required, hasErrors);

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		input: { value: any };
		blur: { value: any };
		focus: { value: any };
	}>();

	function getFieldClasses(hasErrors: boolean, focused: boolean, disabled: boolean): string {
		const baseClasses =
			'block w-full px-3 py-2 border rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

		let classes = baseClasses;

		if (disabled) {
			classes += ' bg-gray-50 text-gray-500 cursor-not-allowed';
		} else if (hasErrors) {
			classes += ' border-red-500 focus:border-red-500 focus:ring-red-500';
		} else if (focused) {
			classes += ' border-blue-500 focus:border-blue-500 focus:ring-blue-500';
		} else {
			classes += ' border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500';
		}

		return classes;
	}

	function getLabelClasses(required: boolean, hasErrors: boolean): string {
		let classes = 'block text-sm font-medium mb-1';

		if (hasErrors) {
			classes += ' text-red-700';
		} else {
			classes += ' text-gray-700';
		}

		return classes;
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
		let newValue = target.value;

		// Handle multi-select
		if (type === 'multi-select' && target instanceof HTMLSelectElement) {
			newValue = Array.from(target.selectedOptions, (option) => option.value);
		}

		value = newValue;
		hasInteracted = true;
		dispatch('input', { value: newValue });
	}

	function handleFocus(event: FocusEvent) {
		isFocused = true;
		dispatch('focus', { value });
	}

	function handleBlur(event: FocusEvent) {
		isFocused = false;
		hasInteracted = true;
		dispatch('blur', { value });
	}

	onMount(() => {
		if (fieldElement) {
			// Set up accessibility attributes
			fieldElement.setAttribute('aria-describedby', `${fieldId}-error ${fieldId}-help`);
			if (hasErrors) {
				fieldElement.setAttribute('aria-invalid', 'true');
			}
		}
	});

	// Update aria-invalid when validation changes
	$: if (fieldElement && showValidation) {
		if (hasErrors) {
			fieldElement.setAttribute('aria-invalid', 'true');
			// Trigger screen reader announcement
			announceValidation = true;
			setTimeout(() => {
				announceValidation = false;
			}, 100);
		} else {
			fieldElement.removeAttribute('aria-invalid');
		}
	}
</script>

<div class="form-field">
	<label for={fieldId} class={labelClasses}>
		{label}
		{#if required}
			<RequiredIndicator />
		{/if}
	</label>

	{#if type === 'textarea'}
		<textarea
			bind:this={fieldElement}
			id={fieldId}
			class={fieldClasses}
			{placeholder}
			{disabled}
			{rows}
			{maxLength}
			{autocomplete}
			{value}
			on:input={handleInput}
			on:focus={handleFocus}
			on:blur={handleBlur}
		></textarea>
	{:else if type === 'select'}
		<select
			bind:this={fieldElement}
			id={fieldId}
			class={fieldClasses}
			{disabled}
			{value}
			on:input={handleInput}
			on:focus={handleFocus}
			on:blur={handleBlur}
		>
			<option value="" disabled>Select {label.toLowerCase()}...</option>
			{#each options as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{:else if type === 'multi-select'}
		<select
			bind:this={fieldElement}
			id={fieldId}
			class={fieldClasses}
			{disabled}
			multiple
			on:input={handleInput}
			on:focus={handleFocus}
			on:blur={handleBlur}
		>
			{#each options as option}
				<option
					value={option.value}
					selected={Array.isArray(value) && value.includes(option.value)}
				>
					{option.label}
				</option>
			{/each}
		</select>
	{:else}
		<input
			bind:this={fieldElement}
			id={fieldId}
			{type}
			class={fieldClasses}
			{placeholder}
			{disabled}
			{maxLength}
			{autocomplete}
			{value}
			on:input={handleInput}
			on:focus={handleFocus}
			on:blur={handleBlur}
		/>
	{/if}

	<!-- ARIA live region for screen reader announcements -->
	{#if announceValidation && showValidation && hasErrors}
		<div class="sr-only" aria-live="assertive" aria-atomic="true">
			Validation error in {label}: {validation?.errors?.join(', ')}
		</div>
	{/if}

	{#if showValidation}
		<div id="{fieldId}-error" role="alert" aria-live="polite" aria-atomic="true">
			<FieldError
				errors={validation?.errors || []}
				warnings={validation?.warnings || []}
				{fieldId}
			/>
		</div>
	{/if}

	{#if helpText}
		<div id="{fieldId}-help" class="mt-1 text-xs text-gray-500">
			{helpText}
		</div>
	{/if}

	{#if maxLength && type === 'textarea'}
		<div class="mt-1 text-xs text-gray-400 text-right">
			{value?.length || 0}/{maxLength} characters
		</div>
	{/if}
</div>

<style>
	/* Screen reader only utility class */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	:global(.theme-dark) .text-gray-700 {
		color: #d1d5db;
	}

	:global(.theme-dark) .text-gray-500 {
		color: #9ca3af;
	}

	:global(.theme-dark) .text-gray-400 {
		color: #9ca3af;
	}

	:global(.theme-dark) .border-gray-300 {
		border-color: #4b5563;
	}

	:global(.theme-dark) .bg-gray-50 {
		background-color: #374151;
	}

	:global(.theme-high-contrast) .text-red-700 {
		color: #b91c1c;
		font-weight: 700;
	}

	:global(.theme-high-contrast) label {
		font-weight: 600;
	}
</style>
