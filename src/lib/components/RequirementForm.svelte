<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import RichTextEditor from './RichTextEditor.svelte';
	import FormField from './form/FormField.svelte';
	import FormSummaryErrors from './form/FormSummaryErrors.svelte';
	import { stripHtmlForValidation } from '$lib/utils/html-sanitizer.js';
	import { requirementCreationService } from '$lib/services/requirement-creation.js';
	import {
		validationUtils,
		FormValidator,
		DebouncedValidator,
		type FieldValidationResult,
		type ValidationResult
	} from '$lib/validation/index.js';
	import type {
		RequirementFormData,
		RequirementType,
		Priority,
		RiskLevel,
		Requirement
	} from '$lib/types/lifecycle';

	interface Props {
		initialData?: Partial<RequirementFormData>;
		enableMcpIntegration?: boolean;
		isSubmitting?: boolean;
	}

	let {
		initialData = {},
		enableMcpIntegration = false,
		isSubmitting: isSubmittingProp = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		submit: RequirementFormData;
		cancel: void;
		success: { requirement: Requirement; message: string };
		error: { error: string; isRetryable: boolean };
	}>();

	// Submission state
	let internalIsSubmitting = $state(false);
	let submitError = $state<string>('');
	let successMessage = $state<string>('');
	let connectionStatus = $state<'connected' | 'disconnected' | 'checking'>('checking');
	let isRetryable = $state(false);
	let submissionId = $state<string>('');
	let optimisticRequirement = $state<Requirement | null>(null);

	// Combined submission state (external prop takes precedence)
	let isSubmitting = $derived(isSubmittingProp || internalIsSubmitting);

	// Request debouncing
	let submissionDebounce: NodeJS.Timeout | undefined;

	// Form validation state
	let validator: FormValidator | null = $state(null);
	let debouncedValidator: DebouncedValidator | null = $state(null);
	let fieldValidationResults = $state<Record<string, FieldValidationResult>>({});
	let formValidationResult = $state<ValidationResult | null>(null);
	let isValidating = $state(false);

	let formData = $state<RequirementFormData>({
		type: initialData.type || 'FUNC',
		title: initialData.title || '',
		priority: initialData.priority || 'P1',
		current_state: initialData.current_state || '',
		desired_state: initialData.desired_state || '',
		business_value: initialData.business_value || '',
		risk_level: initialData.risk_level || 'Medium',
		functional_requirements: initialData.functional_requirements?.length
			? initialData.functional_requirements
			: [''],
		acceptance_criteria: initialData.acceptance_criteria?.length
			? initialData.acceptance_criteria
			: [''],
		author: initialData.author || ''
	});

	// Extended form data for type-specific fields
	let extendedFormData = $state({
		// FUNC fields
		user_stories: '',
		// NFUNC fields
		performance_criteria: '',
		quality_attributes: [] as string[],
		// TECH fields
		technical_constraints: '',
		architecture_dependencies: [] as string[],
		technical_stack: [] as string[],
		// BUS fields
		stakeholder_impact: '',
		success_metrics: [] as string[],
		roi_justification: '',
		// INTF fields
		interface_specifications: '',
		integration_points: [''], // Initialize with one empty item
		data_formats: 'JSON' as 'JSON' | 'XML' | 'CSV' | 'Custom',
		protocol_requirements: ''
	});

	const requirementTypes: { value: RequirementType; label: string; description: string }[] = [
		{ value: 'FUNC', label: 'Functional', description: 'System behavior and functionality' },
		{ value: 'NFUNC', label: 'Non-Functional', description: 'Quality attributes and constraints' },
		{ value: 'TECH', label: 'Technical', description: 'Technical constraints and architecture' },
		{ value: 'BUS', label: 'Business', description: 'Business processes and rules' },
		{ value: 'INTF', label: 'Interface', description: 'System interfaces and integration' }
	];

	const priorities: { value: Priority; label: string; description: string }[] = [
		{ value: 'P0', label: 'Critical', description: 'Must have - blocking' },
		{ value: 'P1', label: 'High', description: 'Must have - important' },
		{ value: 'P2', label: 'Medium', description: 'Should have - valuable' },
		{ value: 'P3', label: 'Low', description: 'Could have - nice to have' }
	];

	const riskLevels: { value: RiskLevel; label: string }[] = [
		{ value: 'High', label: 'High Risk' },
		{ value: 'Medium', label: 'Medium Risk' },
		{ value: 'Low', label: 'Low Risk' }
	];

	const qualityAttributeOptions = [
		{ value: 'Performance', label: 'Performance' },
		{ value: 'Security', label: 'Security' },
		{ value: 'Usability', label: 'Usability' },
		{ value: 'Reliability', label: 'Reliability' }
	];

	const dataFormatOptions = [
		{ value: 'JSON', label: 'JSON' },
		{ value: 'XML', label: 'XML' },
		{ value: 'CSV', label: 'CSV' },
		{ value: 'Custom', label: 'Custom' }
	];

	let errors = $state<Record<string, string>>({});

	// Real-time field validation
	async function validateFieldRealTime(fieldName: string, value: any) {
		if (!validator || !debouncedValidator) return;

		debouncedValidator.validateFieldDebounced(
			fieldName,
			value,
			formData,
			(result: FieldValidationResult) => {
				fieldValidationResults[fieldName] = result;
				// Update legacy errors object for backwards compatibility
				if (result.errors.length > 0) {
					errors[fieldName] = result.errors[0];
				} else {
					delete errors[fieldName];
				}
			}
		);
	}

	// Get validation error for a field
	function getFieldError(fieldName: string): string | undefined {
		const result = fieldValidationResults[fieldName];
		if (result && !result.isValid && result.errors.length > 0) {
			return result.errors[0];
		}
		return undefined;
	}

	// Check if field is currently validating
	function isFieldValidating(fieldName: string): boolean {
		const result = fieldValidationResults[fieldName];
		return result?.isValidating || false;
	}

	// Get field warnings
	function getFieldWarnings(fieldName: string): string[] {
		const result = fieldValidationResults[fieldName];
		return result?.warnings || [];
	}

	async function validateForm(): Promise<boolean> {
		if (validator) {
			// Use the new validation system
			try {
				formValidationResult = await validator.validateForm(formData);

				// Update legacy errors object for backwards compatibility
				errors = {};
				if (formValidationResult.errors) {
					for (const [fieldName, fieldErrors] of Object.entries(formValidationResult.errors)) {
						errors[fieldName] = fieldErrors[0]; // Take first error
					}
				}

				return formValidationResult.isValid;
			} catch (error) {
				console.warn('Validation system error, falling back to legacy validation:', error);
			}
		}

		// Fallback to legacy validation
		errors = {};

		if (!formData.title.trim()) {
			errors.title = 'Title is required';
		} else if (formData.title.length > 100) {
			errors.title = 'Title must be 100 characters or less';
		}

		if (!stripHtmlForValidation(formData.current_state)) {
			errors.current_state = 'Current state is required';
		}

		if (!stripHtmlForValidation(formData.desired_state)) {
			errors.desired_state = 'Desired state is required';
		}

		// Type-specific validation
		if (formData.type === 'FUNC') {
			if (!stripHtmlForValidation(formData.business_value || '')) {
				errors.business_value = 'Business value is required for functional requirements';
			}
			if (
				!formData.functional_requirements?.length ||
				!formData.functional_requirements.some((req) => req.trim())
			) {
				errors.functional_requirements = 'At least one functional requirement is required';
			}
		}

		if (formData.type === 'BUS') {
			if (!stripHtmlForValidation(formData.business_value || '')) {
				errors.business_value = 'Business value is required for business requirements';
			}
			if (!extendedFormData.stakeholder_impact.trim()) {
				errors.stakeholder_impact = 'Stakeholder impact is required for business requirements';
			}
		}

		if (formData.type === 'INTF') {
			if (!extendedFormData.interface_specifications.trim()) {
				errors.interface_specifications =
					'Interface specifications are required for interface requirements';
			}
			if (
				!extendedFormData.integration_points.length ||
				!extendedFormData.integration_points.some((point) => point.trim())
			) {
				errors.integration_points = 'At least one integration point is required';
			}
		}

		// Acceptance criteria validation for all types
		if (
			!formData.acceptance_criteria?.length ||
			!formData.acceptance_criteria.some((criteria) => criteria.trim())
		) {
			errors.acceptance_criteria = 'At least one acceptance criterion is required';
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const isValid = await validateForm();
		if (!isValid || isSubmitting) return;

		// Clear any existing debounce timer
		if (submissionDebounce) {
			clearTimeout(submissionDebounce);
		}

		// Debounce rapid submissions
		submissionDebounce = setTimeout(async () => {
			await performSubmission();
		}, 300);
	}

	async function performSubmission() {
		// Generate unique submission ID to handle concurrent submissions
		const currentSubmissionId = crypto.randomUUID();
		submissionId = currentSubmissionId;

		// Clear previous state
		submitError = '';
		successMessage = '';
		isRetryable = false;
		optimisticRequirement = null;

		if (enableMcpIntegration) {
			// Handle MCP integration
			internalIsSubmitting = true;

			// Create optimistic requirement for immediate UI feedback
			const optimisticReq: Requirement = {
				id: 'temp-' + currentSubmissionId,
				requirement_number: 0,
				type: formData.type,
				version: 1,
				title: formData.title,
				status: 'Draft',
				priority: formData.priority,
				risk_level: formData.risk_level,
				business_value: formData.business_value,
				current_state: formData.current_state,
				desired_state: formData.desired_state,
				acceptance_criteria: formData.acceptance_criteria?.filter((c) => c.trim()) || [],
				functional_requirements: formData.functional_requirements?.filter((r) => r.trim()) || [],
				author: formData.author || 'System',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				task_count: 0,
				tasks_completed: 0
			};

			optimisticRequirement = optimisticReq;

			try {
				const result = await requirementCreationService.createRequirement(formData);

				// Check if this submission is still current (prevent race conditions)
				if (submissionId !== currentSubmissionId) {
					// Another submission has started, ignore this result
					return;
				}

				if (result.success && result.data) {
					successMessage = `Requirement "${result.data.title}" created successfully with ID ${result.data.id}`;
					optimisticRequirement = null; // Clear optimistic state
					dispatch('success', {
						requirement: result.data,
						message: successMessage
					});

					// Reset form after successful creation
					resetForm();
				} else {
					optimisticRequirement = null; // Clear optimistic state
					submitError = result.error || 'Failed to create requirement';
					isRetryable = result.isRetryable || false;
					dispatch('error', {
						error: submitError,
						isRetryable
					});
				}
			} catch (error) {
				// Check if this submission is still current
				if (submissionId !== currentSubmissionId) return;

				optimisticRequirement = null; // Clear optimistic state
				submitError = 'An unexpected error occurred. Please try again.';
				isRetryable = true;
				dispatch('error', {
					error: submitError,
					isRetryable
				});
			} finally {
				// Only update submission state if this is still the current submission
				if (submissionId === currentSubmissionId) {
					internalIsSubmitting = false;
				}
			}
		} else {
			// Fallback to event dispatch for backward compatibility
			dispatch('submit', formData);
		}
	}

	function resetForm() {
		formData = {
			type: 'FUNC',
			title: '',
			priority: 'P1',
			current_state: '',
			desired_state: '',
			business_value: '',
			risk_level: 'Medium',
			functional_requirements: [''],
			acceptance_criteria: [''],
			author: ''
		};

		extendedFormData = {
			user_stories: '',
			performance_criteria: '',
			quality_attributes: [],
			technical_constraints: '',
			architecture_decisions: [],
			stakeholder_impact: '',
			interface_specifications: '',
			integration_points: []
		};

		// Clear submission state
		submitError = '';
		successMessage = '';
		submissionId = '';
		optimisticRequirement = null;
		isRetryable = false;
	}

	async function retrySubmission() {
		// Clear any previous state and retry submission
		await performSubmission();
	}

	// Check connection status on mount if MCP integration is enabled

	onMount(async () => {
		// Initialize form validation
		try {
			validator = await validationUtils.createRequirementValidator({
				isEdit: false,
				entityType: 'requirement'
			});
			if (validator) {
				debouncedValidator = new DebouncedValidator(validator, 300);
			}
		} catch (error) {
			console.warn('Failed to initialize form validation:', error);
		}

		if (enableMcpIntegration) {
			connectionStatus = 'checking';
			const isConnected = await requirementCreationService.checkConnection();
			connectionStatus = isConnected ? 'connected' : 'disconnected';
		}
	});

	onDestroy(() => {
		// Clean up any pending debounce timer
		if (submissionDebounce) {
			clearTimeout(submissionDebounce);
		}
		// Clean up validation debouncer
		if (debouncedValidator) {
			debouncedValidator.cancel();
		}
	});

	function handleCancel() {
		dispatch('cancel');
	}

	// Dynamic list management functions
	function addListItem(listName: keyof typeof extendedFormData) {
		if (Array.isArray(extendedFormData[listName])) {
			(extendedFormData[listName] as string[]).push('');
		}
	}

	function removeListItem(listName: keyof typeof extendedFormData, index: number) {
		if (Array.isArray(extendedFormData[listName])) {
			(extendedFormData[listName] as string[]).splice(index, 1);
		}
	}

	function updateListItem(listName: keyof typeof extendedFormData, index: number, value: string) {
		if (Array.isArray(extendedFormData[listName])) {
			(extendedFormData[listName] as string[])[index] = value;
		}
	}

	// Enhanced acceptance criteria management functions
	function addAcceptanceCriteria() {
		if (!formData.acceptance_criteria) {
			formData.acceptance_criteria = [];
		}
		formData.acceptance_criteria = [...formData.acceptance_criteria, ''];

		// Focus on the new textarea after DOM updates
		setTimeout(() => {
			const textareas = document.querySelectorAll('fieldset textarea[placeholder*="Given"]');
			const lastTextarea = textareas[textareas.length - 1] as HTMLTextAreaElement;
			if (lastTextarea) {
				lastTextarea.focus();
			}
		}, 0);
	}

	function removeAcceptanceCriteria(index: number) {
		if (!formData.acceptance_criteria) return;
		if (formData.acceptance_criteria.length > 1) {
			const newArray = [...formData.acceptance_criteria];
			newArray.splice(index, 1);
			formData.acceptance_criteria = newArray;
		}
	}

	function moveAcceptanceCriteria(fromIndex: number, toIndex: number) {
		if (!formData.acceptance_criteria) return;
		if (toIndex >= 0 && toIndex < formData.acceptance_criteria.length) {
			const newArray = [...formData.acceptance_criteria];
			const item = newArray[fromIndex];
			newArray.splice(fromIndex, 1);
			newArray.splice(toIndex, 0, item);
			formData.acceptance_criteria = newArray;
		}
	}

	function handleAcceptanceCriteriaKeydown(event: KeyboardEvent, index: number) {
		if (!formData.acceptance_criteria) return;

		const target = event.target as HTMLTextAreaElement;

		if (event.key === 'Enter' && event.ctrlKey) {
			// Ctrl+Enter: Add new criterion
			event.preventDefault();
			addAcceptanceCriteria();
			// Focus the new criterion after a brief delay
			setTimeout(() => {
				const nextTextarea = target.closest('fieldset')?.querySelectorAll('textarea')[index + 1];
				if (nextTextarea) {
					(nextTextarea as HTMLTextAreaElement).focus();
				}
			}, 10);
		} else if (event.key === 'Delete' && event.ctrlKey && formData.acceptance_criteria.length > 1) {
			// Ctrl+Delete: Remove current criterion
			event.preventDefault();
			removeAcceptanceCriteria(index);
			// Focus previous or next criterion
			setTimeout(() => {
				const textareas = target.closest('fieldset')?.querySelectorAll('textarea');
				if (textareas) {
					const focusIndex = Math.min(index, textareas.length - 1);
					(textareas[focusIndex] as HTMLTextAreaElement).focus();
				}
			}, 10);
		} else if (event.key === 'ArrowUp' && event.ctrlKey && index > 0) {
			// Ctrl+Up: Move criterion up
			event.preventDefault();
			moveAcceptanceCriteria(index, index - 1);
			// Maintain focus on moved criterion
			setTimeout(() => {
				const textareas = target.closest('fieldset')?.querySelectorAll('textarea');
				if (textareas) {
					(textareas[index - 1] as HTMLTextAreaElement).focus();
				}
			}, 10);
		} else if (
			event.key === 'ArrowDown' &&
			event.ctrlKey &&
			formData.acceptance_criteria &&
			index < formData.acceptance_criteria.length - 1
		) {
			// Ctrl+Down: Move criterion down
			event.preventDefault();
			moveAcceptanceCriteria(index, index + 1);
			// Maintain focus on moved criterion
			setTimeout(() => {
				const textareas = target.closest('fieldset')?.querySelectorAll('textarea');
				if (textareas) {
					(textareas[index + 1] as HTMLTextAreaElement).focus();
				}
			}, 10);
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- MCP Connection Status (when enabled) -->
	{#if enableMcpIntegration}
		<div class="mb-4">
			<div class="flex items-center space-x-2 text-sm">
				<div class="flex items-center space-x-1">
					{#if connectionStatus === 'checking'}
						<div
							class="animate-spin h-3 w-3 border border-gray-300 border-t-blue-600 rounded-full"
						></div>
						<span class="text-gray-600">Checking connection...</span>
					{:else if connectionStatus === 'connected'}
						<div class="h-3 w-3 bg-green-500 rounded-full"></div>
						<span class="text-green-600">Connected to MCP Server</span>
					{:else}
						<div class="h-3 w-3 bg-red-500 rounded-full"></div>
						<span class="text-red-600">Disconnected from MCP Server</span>
						<button
							onclick={async () => {
								connectionStatus = 'checking';
								try {
									const isConnected = await requirementCreationService.checkConnection();
									connectionStatus = isConnected ? 'connected' : 'disconnected';
								} catch (error) {
									connectionStatus = 'disconnected';
								}
							}}
							class="ml-2 text-blue-600 hover:text-blue-800 underline"
						>
							Retry
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Requirement Type Selection -->
	<div class="space-y-2">
		<label
			for="type"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Requirement Type
		</label>
		<select
			id="type"
			bind:value={formData.type}
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {$currentTheme.base.border};"
			disabled={isSubmitting}
		>
			{#each requirementTypes as type}
				<option value={type.value}>{type.label} - {type.description}</option>
			{/each}
		</select>
	</div>

	<!-- Title -->
	<div class="space-y-2">
		<label
			for="title"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Title *
		</label>
		<input
			id="title"
			type="text"
			bind:value={formData.title}
			oninput={() => validateFieldRealTime('title', formData.title)}
			placeholder="Enter requirement title (max 100 characters)"
			maxlength="100"
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {getFieldError(
				'title'
			)
				? 'border-red-500'
				: ''}"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {getFieldError('title') ? '#ef4444' : $currentTheme.base.border};"
			disabled={isSubmitting}
		/>
		<div class="flex justify-between items-center">
			<div class="flex-1">
				{#if getFieldError('title')}
					<p class="text-sm text-red-500">{getFieldError('title')}</p>
				{/if}
				{#if getFieldWarnings('title').length > 0}
					{#each getFieldWarnings('title') as warning}
						<p class="text-sm text-yellow-600">{warning}</p>
					{/each}
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if isFieldValidating('title')}
					<div class="w-4 h-4">
						<svg class="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					</div>
				{/if}
				<p class="text-xs" style="color: {$currentTheme.base.muted};">
					{formData.title.length}/100 characters
				</p>
			</div>
		</div>
	</div>

	<!-- Priority -->
	<div class="space-y-2">
		<label
			for="priority"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Priority
		</label>
		<select
			id="priority"
			bind:value={formData.priority}
			onchange={() => validateFieldRealTime('priority', formData.priority)}
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {getFieldError(
				'priority'
			)
				? 'border-red-500'
				: ''}"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {getFieldError('priority') ? '#ef4444' : $currentTheme.base.border};"
			disabled={isSubmitting}
		>
			{#each priorities as priority}
				<option value={priority.value}>{priority.label} - {priority.description}</option>
			{/each}
		</select>
		{#if getFieldError('priority')}
			<p class="text-sm text-red-500">{getFieldError('priority')}</p>
		{/if}
		{#if getFieldWarnings('priority').length > 0}
			{#each getFieldWarnings('priority') as warning}
				<p class="text-sm text-yellow-600">{warning}</p>
			{/each}
		{/if}
	</div>

	<!-- Current State -->
	<div class="space-y-2">
		<div
			id="current_state_label"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Current State *
		</div>
		<RichTextEditor
			id="current_state"
			content={formData.current_state}
			placeholder="Describe the current situation or problem..."
			minHeight="150px"
			maxHeight="300px"
			disabled={isSubmitting}
			required={true}
			aria-labelledby="current_state_label"
			onUpdate={(content) => {
				formData.current_state = content;
				validateFieldRealTime('current_state', content);
			}}
		/>
		{#if getFieldError('current_state')}
			<p class="text-sm text-red-500">{getFieldError('current_state')}</p>
		{/if}
		{#if getFieldWarnings('current_state').length > 0}
			{#each getFieldWarnings('current_state') as warning}
				<p class="text-sm text-yellow-600">{warning}</p>
			{/each}
		{/if}
	</div>

	<!-- Desired State -->
	<div class="space-y-2">
		<div
			id="desired_state_label"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Desired State *
		</div>
		<RichTextEditor
			id="desired_state"
			content={formData.desired_state}
			placeholder="Describe the desired outcome or solution..."
			minHeight="150px"
			maxHeight="300px"
			disabled={isSubmitting}
			required={true}
			aria-labelledby="desired_state_label"
			onUpdate={(content) => {
				formData.desired_state = content;
				validateFieldRealTime('desired_state', content);
			}}
		/>
		{#if getFieldError('desired_state')}
			<p class="text-sm text-red-500">{getFieldError('desired_state')}</p>
		{/if}
		{#if getFieldWarnings('desired_state').length > 0}
			{#each getFieldWarnings('desired_state') as warning}
				<p class="text-sm text-yellow-600">{warning}</p>
			{/each}
		{/if}
	</div>

	<!-- Type-Specific Fields -->
	{#if formData.type === 'FUNC'}
		<div class="space-y-6 animate-fade-in">
			<!-- Business Value (required for FUNC) -->
			<div class="space-y-2">
				<div
					id="business_value_label"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Business Value *
				</div>
				<RichTextEditor
					id="business_value"
					content={formData.business_value}
					placeholder="Explain the business value and impact..."
					minHeight="120px"
					maxHeight="250px"
					disabled={isSubmitting}
					required={true}
					aria-labelledby="business_value_label"
					onUpdate={(content) => {
						formData.business_value = content;
					}}
				/>
				{#if errors.business_value}
					<p class="text-sm text-red-500">{errors.business_value}</p>
				{/if}
			</div>

			<!-- Functional Requirements List -->
			<div class="space-y-2">
				<label
					for="functional_requirements_0"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Functional Requirements * (minimum 1)
				</label>
				{#each formData.functional_requirements as requirement, index}
					<div class="flex gap-2">
						<input
							id="functional_requirements_{index}"
							type="text"
							bind:value={formData.functional_requirements[index]}
							placeholder="Describe functional requirement..."
							class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							style="background-color: {$currentTheme.base.background}; 
								   color: {$currentTheme.base.foreground}; 
								   border-color: {$currentTheme.base.border};"
							disabled={isSubmitting}
						/>
						{#if formData.functional_requirements.length > 1}
							<button
								type="button"
								onclick={() => formData.functional_requirements.splice(index, 1)}
								class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
								disabled={isSubmitting}
							>
								Remove
							</button>
						{/if}
					</div>
				{/each}
				<button
					type="button"
					onclick={() => formData.functional_requirements.push('')}
					class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
					disabled={isSubmitting}
				>
					+ Add Functional Requirement
				</button>
			</div>

			<!-- User Stories (optional for FUNC) -->
			<div class="space-y-2">
				<label
					for="user_stories"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					User Stories
				</label>
				<textarea
					id="user_stories"
					bind:value={extendedFormData.user_stories}
					placeholder="Describe user stories and scenarios..."
					rows="3"
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				></textarea>
			</div>
		</div>
	{/if}

	{#if formData.type === 'NFUNC'}
		<div class="space-y-6 animate-fade-in">
			<!-- Risk Level (required for NFUNC) -->
			<div class="space-y-2">
				<label
					for="risk_level"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Risk Level *
				</label>
				<select
					id="risk_level"
					bind:value={formData.risk_level}
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				>
					{#each riskLevels as risk}
						<option value={risk.value}>{risk.label}</option>
					{/each}
				</select>
			</div>

			<!-- Performance Criteria (optional for NFUNC) -->
			<div class="space-y-2">
				<label
					for="performance_criteria"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Performance Criteria
				</label>
				<textarea
					id="performance_criteria"
					bind:value={extendedFormData.performance_criteria}
					placeholder="Describe performance requirements and benchmarks..."
					rows="3"
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				></textarea>
			</div>

			<!-- Quality Attributes (checkboxes for NFUNC) -->
			<fieldset class="space-y-2">
				<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
					Quality Attributes
				</legend>
				<div class="grid grid-cols-2 gap-3">
					{#each qualityAttributeOptions as attribute}
						<label class="flex items-center space-x-2">
							<input
								type="checkbox"
								bind:group={extendedFormData.quality_attributes}
								value={attribute.value}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								disabled={isSubmitting}
							/>
							<span class="text-sm" style="color: {$currentTheme.base.foreground};">
								{attribute.label}
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
		</div>
	{/if}

	{#if formData.type === 'TECH'}
		<div class="space-y-6 animate-fade-in">
			<!-- Technical Constraints (optional for TECH) -->
			<div class="space-y-2">
				<label
					for="technical_constraints"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Technical Constraints
				</label>
				<textarea
					id="technical_constraints"
					bind:value={extendedFormData.technical_constraints}
					placeholder="Describe technical limitations and constraints..."
					rows="3"
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				></textarea>
			</div>

			<!-- Architecture Dependencies (multi-select from existing ADRs) -->
			<div class="space-y-2">
				<label
					for="architecture_dependencies"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Architecture Dependencies
				</label>
				<div class="text-sm text-gray-600 mb-2">
					Select existing architectural decisions this requirement depends on
				</div>
				<select
					id="architecture_dependencies"
					multiple
					bind:value={extendedFormData.architecture_dependencies}
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				>
					<option value="ADR-0001">ADR-0001: System Architecture</option>
					<option value="ADR-0002">ADR-0002: Database Selection</option>
					<option value="ADR-0003">ADR-0003: Authentication Strategy</option>
					<!-- These would be populated dynamically in real implementation -->
				</select>
			</div>

			<!-- Technical Stack (tags input) -->
			<fieldset class="space-y-2">
				<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
					Technical Stack
				</legend>
				{#each extendedFormData.technical_stack as tech, index}
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={extendedFormData.technical_stack[index]}
							placeholder="Technology, framework, or library..."
							class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							style="background-color: {$currentTheme.base.background}; 
								   color: {$currentTheme.base.foreground}; 
								   border-color: {$currentTheme.base.border};"
							disabled={isSubmitting}
						/>
						<button
							type="button"
							onclick={() => removeListItem('technical_stack', index)}
							class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
							disabled={isSubmitting}
						>
							Remove
						</button>
					</div>
				{/each}
				<button
					type="button"
					onclick={() => addListItem('technical_stack')}
					class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
					disabled={isSubmitting}
				>
					+ Add Technology
				</button>
			</fieldset>
		</div>
	{/if}

	{#if formData.type === 'BUS'}
		<div class="space-y-6 animate-fade-in">
			<!-- Business Value (required for BUS) -->
			<div class="space-y-2">
				<div
					id="business_value_bus_label"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Business Value *
				</div>
				<RichTextEditor
					id="business_value_bus"
					content={formData.business_value}
					placeholder="Explain the business value and impact..."
					minHeight="120px"
					maxHeight="250px"
					disabled={isSubmitting}
					required={true}
					aria-labelledby="business_value_bus_label"
					onUpdate={(content) => {
						formData.business_value = content;
					}}
				/>
				{#if errors.business_value}
					<p class="text-sm text-red-500">{errors.business_value}</p>
				{/if}
			</div>

			<!-- Stakeholder Impact (required for BUS) -->
			<div class="space-y-2">
				<label
					for="stakeholder_impact"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Stakeholder Impact *
				</label>
				<textarea
					id="stakeholder_impact"
					bind:value={extendedFormData.stakeholder_impact}
					placeholder="Describe how this affects stakeholders..."
					rows="3"
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
					required
				></textarea>
			</div>

			<!-- Success Metrics (dynamic list, optional for BUS) -->
			<fieldset class="space-y-2">
				<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
					Success Metrics
				</legend>
				{#each extendedFormData.success_metrics as metric, index}
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={extendedFormData.success_metrics[index]}
							placeholder="How will success be measured..."
							class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							style="background-color: {$currentTheme.base.background}; 
								   color: {$currentTheme.base.foreground}; 
								   border-color: {$currentTheme.base.border};"
							disabled={isSubmitting}
						/>
						<button
							type="button"
							onclick={() => removeListItem('success_metrics', index)}
							class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
							disabled={isSubmitting}
						>
							Remove
						</button>
					</div>
				{/each}
				<button
					type="button"
					onclick={() => addListItem('success_metrics')}
					class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
					disabled={isSubmitting}
				>
					+ Add Success Metric
				</button>
			</fieldset>

			<!-- ROI Justification (optional for BUS) -->
			<div class="space-y-2">
				<label
					for="roi_justification"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					ROI Justification
				</label>
				<textarea
					id="roi_justification"
					bind:value={extendedFormData.roi_justification}
					placeholder="Describe expected return on investment..."
					rows="3"
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				></textarea>
			</div>
		</div>
	{/if}

	{#if formData.type === 'INTF'}
		<div class="space-y-6 animate-fade-in">
			<!-- Interface Specifications (rich text, required for INTF) -->
			<div class="space-y-2">
				<label
					for="interface_specifications"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Interface Specifications *
				</label>
				<textarea
					id="interface_specifications"
					bind:value={extendedFormData.interface_specifications}
					placeholder="Describe the interface requirements and specifications..."
					rows="4"
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
					required
				></textarea>
			</div>

			<!-- Integration Points (dynamic list, min 1 for INTF) -->
			<fieldset class="space-y-2">
				<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
					Integration Points * (minimum 1)
				</legend>
				{#each extendedFormData.integration_points as point, index}
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={extendedFormData.integration_points[index]}
							placeholder="System or service integration point..."
							class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							style="background-color: {$currentTheme.base.background}; 
								   color: {$currentTheme.base.foreground}; 
								   border-color: {$currentTheme.base.border};"
							disabled={isSubmitting}
						/>
						{#if extendedFormData.integration_points.length > 1}
							<button
								type="button"
								onclick={() => removeListItem('integration_points', index)}
								class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
								disabled={isSubmitting}
							>
								Remove
							</button>
						{/if}
					</div>
				{/each}
				<button
					type="button"
					onclick={() => addListItem('integration_points')}
					class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
					disabled={isSubmitting}
				>
					+ Add Integration Point
				</button>
			</fieldset>

			<!-- Data Formats (dropdown for INTF) -->
			<div class="space-y-2">
				<label
					for="data_formats"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Data Formats
				</label>
				<select
					id="data_formats"
					bind:value={extendedFormData.data_formats}
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				>
					{#each dataFormatOptions as format}
						<option value={format.value}>{format.label}</option>
					{/each}
				</select>
			</div>

			<!-- Protocol Requirements (text input for INTF) -->
			<div class="space-y-2">
				<label
					for="protocol_requirements"
					class="block text-sm font-medium"
					style="color: {$currentTheme.base.foreground};"
				>
					Protocol Requirements
				</label>
				<input
					id="protocol_requirements"
					type="text"
					bind:value={extendedFormData.protocol_requirements}
					placeholder="HTTP, WebSocket, gRPC, etc..."
					class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				/>
			</div>
		</div>
	{/if}

	<!-- Acceptance Criteria (required for all types) -->
	<fieldset class="space-y-2">
		<legend class="block text-sm font-medium mb-3" style="color: {$currentTheme.base.foreground};">
			Acceptance Criteria * ({formData.acceptance_criteria?.length || 0}
			{(formData.acceptance_criteria?.length || 0) === 1 ? 'criterion' : 'criteria'})
		</legend>
		<div class="space-y-3">
			{#each formData.acceptance_criteria || [] as criterion, index}
				<div class="flex gap-2 items-start">
					<div
						class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center mt-2"
					>
						{index + 1}
					</div>
					<textarea
						bind:value={formData.acceptance_criteria[index]}
						placeholder="Given [context], when [action], then [outcome]..."
						rows="2"
						class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
						style="background-color: {$currentTheme.base.background}; 
							   color: {$currentTheme.base.foreground}; 
							   border-color: {$currentTheme.base.border};"
						disabled={isSubmitting}
						onkeydown={(e) => handleAcceptanceCriteriaKeydown(e, index)}
					></textarea>
					<div class="flex flex-col gap-1 mt-2">
						{#if index > 0}
							<button
								type="button"
								onclick={() => moveAcceptanceCriteria(index, index - 1)}
								class="p-1 text-gray-500 hover:text-gray-700 transition-colors"
								disabled={isSubmitting}
								title="Move up"
								aria-label="Move criterion {index + 1} up"
							>
								↑
							</button>
						{/if}
						{#if index < formData.acceptance_criteria.length - 1}
							<button
								type="button"
								onclick={() => moveAcceptanceCriteria(index, index + 1)}
								class="p-1 text-gray-500 hover:text-gray-700 transition-colors"
								disabled={isSubmitting}
								title="Move down"
								aria-label="Move criterion {index + 1} down"
							>
								↓
							</button>
						{/if}
						<button
							type="button"
							onclick={() => removeAcceptanceCriteria(index)}
							class="p-1 text-red-600 hover:text-red-800 transition-colors {formData
								.acceptance_criteria.length <= 1
								? 'opacity-50 cursor-not-allowed'
								: ''}"
							disabled={isSubmitting || formData.acceptance_criteria.length <= 1}
							title="Remove acceptance criterion"
							aria-label="Remove acceptance criterion"
						>
							✕
						</button>
					</div>
				</div>
			{/each}
		</div>
		<button
			type="button"
			onclick={addAcceptanceCriteria}
			class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors px-3 py-2 rounded-md border border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50"
			disabled={isSubmitting}
			title="Add acceptance criterion"
			aria-label="Add acceptance criterion"
		>
			<span>+</span>
			Add Acceptance Criterion
		</button>
		{#if errors.acceptance_criteria}
			<p class="text-sm text-red-500">{errors.acceptance_criteria}</p>
		{/if}
	</fieldset>

	<!-- Author -->
	<div class="space-y-2">
		<label
			for="author"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Author
		</label>
		<input
			id="author"
			type="text"
			bind:value={formData.author}
			oninput={() => validateFieldRealTime('author', formData.author)}
			placeholder="Your name or email..."
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {getFieldError(
				'author'
			)
				? 'border-red-500'
				: ''}"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {getFieldError('author') ? '#ef4444' : $currentTheme.base.border};"
			disabled={isSubmitting}
		/>
		{#if getFieldError('author')}
			<p class="text-sm text-red-500">{getFieldError('author')}</p>
		{/if}
		{#if getFieldWarnings('author').length > 0}
			{#each getFieldWarnings('author') as warning}
				<p class="text-sm text-yellow-600">{warning}</p>
			{/each}
		{/if}
	</div>

	<!-- Submission Feedback (when MCP integration enabled) -->
	{#if enableMcpIntegration}
		<div class="space-y-3">
			<!-- Optimistic Creation Feedback -->
			{#if optimisticRequirement && isSubmitting}
				<div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
					<div class="flex items-start gap-2">
						<div class="w-5 h-5 mt-0.5 flex-shrink-0">
							<svg class="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						</div>
						<div>
							<h4 class="text-sm font-medium text-blue-800">Creating requirement...</h4>
							<p class="text-sm text-blue-700">
								"{optimisticRequirement.title}" is being created on the server.
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Success Message -->
			{#if successMessage}
				<div class="p-3 bg-green-50 border border-green-200 rounded-md">
					<div class="flex items-start gap-2">
						<svg
							class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						<div>
							<h4 class="text-sm font-medium text-green-800">Success!</h4>
							<p class="text-sm text-green-700">{successMessage}</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Error Message -->
			{#if submitError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-md">
					<div class="flex items-start gap-2">
						<svg
							class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
						<div class="flex-1">
							<h4 class="text-sm font-medium text-red-800">Error</h4>
							<p class="text-sm text-red-700">{submitError}</p>
							{#if isRetryable && !isSubmitting}
								<button
									type="button"
									onclick={retrySubmission}
									class="mt-2 text-sm text-red-600 hover:text-red-800 underline"
								>
									Try again
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Connection Error Fallback -->
			{#if connectionStatus === 'disconnected'}
				<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
					<div class="flex items-start gap-2">
						<svg
							class="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						<div>
							<h4 class="text-sm font-medium text-yellow-800">Connection Issue</h4>
							<p class="text-sm text-yellow-700">
								Unable to connect to the server. Your requirement will be saved locally and can be
								submitted when the connection is restored.
							</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Form Actions -->
	<div
		class="flex justify-end space-x-3 pt-4 {enableMcpIntegration ? '' : 'border-t'}"
		style={enableMcpIntegration ? '' : `border-color: ${$currentTheme.base.border};`}
	>
		<button
			type="button"
			onclick={handleCancel}
			disabled={isSubmitting}
			class="px-4 py-2 rounded-lg border transition-colors hover:bg-opacity-10 disabled:opacity-50"
			style="border-color: {$currentTheme.base.border}; 
				   color: {$currentTheme.base.muted};"
		>
			Cancel
		</button>
		<button
			type="submit"
			disabled={isSubmitting}
			class="px-4 py-2 rounded-lg transition-colors disabled:opacity-50 {isSubmitting
				? 'bg-gray-400 cursor-not-allowed'
				: 'bg-blue-600 hover:bg-blue-700'} text-white"
		>
			{isSubmitting ? 'Creating...' : 'Create Requirement'}
		</button>
	</div>
</form>

<style>
	.animate-fade-in {
		animation: fadeIn 0.3s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Smooth transitions for all interactive elements */
	input,
	select,
	textarea,
	button {
		transition: all 0.2s ease-in-out;
	}

	/* Enhanced focus states with smooth transitions */
	input:focus,
	select:focus,
	textarea:focus {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
	}

	/* Smooth hover effects for buttons */
	button:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	/* Smooth transitions for list items */
	.space-y-2 > div,
	.space-y-6 > div {
		transition:
			opacity 0.2s ease-in-out,
			transform 0.2s ease-in-out;
	}
</style>
