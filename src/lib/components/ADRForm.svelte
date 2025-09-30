<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import RichTextEditor from './RichTextEditor.svelte';
	import { stripHtmlForValidation } from '$lib/utils/html-sanitizer.js';
	import { adrCreationService } from '$lib/services/adr-creation.js';
	import {
		validationUtils,
		FormValidator,
		DebouncedValidator,
		type FieldValidationResult,
		type ValidationResult
	} from '$lib/validation/index.js';
	import type {
		ADRFormData,
		ArchitectureType,
		ArchitectureDecision,
		Requirement,
		MCPResponse
	} from '$lib/types/lifecycle';

	interface Props {
		initialData?: Partial<ADRFormData>;
		enableMcpIntegration?: boolean;
		isSubmitting?: boolean;
	}

	let {
		initialData = {},
		enableMcpIntegration = false,
		isSubmitting: isSubmittingProp = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		submit: ADRFormData;
		cancel: void;
		success: { adr: ArchitectureDecision; message: string };
		error: { error: string; isRetryable: boolean };
	}>();

	// Submission state
	let internalIsSubmitting = $state(false);
	let submitError = $state<string>('');
	let successMessage = $state<string>('');
	let connectionStatus = $state<'connected' | 'disconnected' | 'checking'>('checking');
	let isRetryable = $state(false);
	let submissionId = $state<string>('');

	// Combined submission state (external prop takes precedence)
	let isSubmitting = $derived(isSubmittingProp || internalIsSubmitting);

	// Request debouncing
	let submissionDebounce: NodeJS.Timeout | undefined;

	// Form validation state
	let validator: FormValidator | null = $state(null);
	let debouncedValidator: DebouncedValidator | null = $state(null);
	let fieldValidationResults = $state<Record<string, FieldValidationResult>>({});
	let formValidationResult = $state<ValidationResult | null>(null);

	// Available requirements for selection
	let availableRequirements = $state<Requirement[]>([]);
	let loadingRequirements = $state(false);

	// Form data
	let formData = $state<ADRFormData>({
		type: initialData.type || 'ADR',
		title: initialData.title || '',
		context: initialData.context || '',
		decision_outcome: initialData.decision_outcome || '',
		authors: initialData.authors?.length ? initialData.authors : [''],
		decision_drivers: initialData.decision_drivers?.length ? initialData.decision_drivers : [''],
		considered_options: initialData.considered_options?.length
			? initialData.considered_options
			: ['', ''],
		consequences: {
			good: initialData.consequences?.good?.length ? initialData.consequences.good : [''],
			bad: initialData.consequences?.bad?.length ? initialData.consequences.bad : [''],
			neutral: initialData.consequences?.neutral?.length ? initialData.consequences.neutral : ['']
		},
		requirement_ids: initialData.requirement_ids || []
	});

	// Architecture types
	const typeOptions: { value: ArchitectureType; label: string; description: string }[] = [
		{
			value: 'ADR',
			label: 'ADR - Architecture Decision Record',
			description: 'Architectural decisions and their context'
		},
		{
			value: 'TDD',
			label: 'TDD - Technical Design Document',
			description: 'Detailed technical implementations'
		},
		{
			value: 'INTG',
			label: 'INTG - Integration Guide',
			description: 'System integration specifications'
		}
	];

	// Form validation
	async function validateFieldRealTime(fieldName: string, value: any) {
		if (!validator || !debouncedValidator) return;

		debouncedValidator.validateFieldDebounced(
			fieldName,
			value,
			formData,
			(result: FieldValidationResult) => {
				fieldValidationResults[fieldName] = result;
			}
		);
	}

	function getFieldError(fieldName: string): string | undefined {
		const result = fieldValidationResults[fieldName];
		if (result && !result.isValid && result.errors.length > 0) {
			return result.errors[0];
		}
		return undefined;
	}

	function isFieldValidating(fieldName: string): boolean {
		const result = fieldValidationResults[fieldName];
		return result?.isValidating || false;
	}

	function getFieldWarnings(fieldName: string): string[] {
		const result = fieldValidationResults[fieldName];
		return result?.warnings || [];
	}

	// Load data from MCP server
	async function loadAvailableRequirements() {
		if (!enableMcpIntegration) return;

		loadingRequirements = true;
		try {
			const response = await adrCreationService.getApprovedRequirements();
			if (response.success && response.data) {
				availableRequirements = response.data;
			}
		} catch (error) {
			console.error('Failed to load requirements:', error);
		} finally {
			loadingRequirements = false;
		}
	}

	// Form submission
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (isSubmitting) return;

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
		// Generate unique submission ID
		const currentSubmissionId = crypto.randomUUID();
		submissionId = currentSubmissionId;

		// Clear previous state
		submitError = '';
		successMessage = '';
		isRetryable = false;

		if (enableMcpIntegration) {
			internalIsSubmitting = true;

			try {
				const result = await adrCreationService.createADR(formData);

				// Check if this submission is still current
				if (submissionId !== currentSubmissionId) return;

				if (result.success && result.data) {
					successMessage = `ADR "${result.data.title}" created successfully with ID ${result.data.id}`;
					dispatch('success', {
						adr: result.data,
						message: successMessage
					});

					// Reset form after successful creation
					resetForm();
				} else {
					submitError = result.error || 'Failed to create ADR';
					isRetryable = result.isRetryable || false;
					dispatch('error', {
						error: submitError,
						isRetryable
					});
				}
			} catch (error) {
				if (submissionId !== currentSubmissionId) return;

				submitError = 'An unexpected error occurred. Please try again.';
				isRetryable = true;
				dispatch('error', {
					error: submitError,
					isRetryable
				});
			} finally {
				if (submissionId === currentSubmissionId) {
					internalIsSubmitting = false;
				}
			}
		} else {
			// Fallback to event dispatch
			dispatch('submit', formData);
		}
	}

	function resetForm() {
		formData = {
			type: 'ADR',
			title: '',
			context: '',
			decision_outcome: '',
			authors: [''],
			decision_drivers: [''],
			considered_options: ['', ''],
			consequences: {
				good: [''],
				bad: [''],
				neutral: ['']
			},
			requirement_ids: []
		};

		// Clear submission state
		submitError = '';
		successMessage = '';
		submissionId = '';
		isRetryable = false;
	}

	async function retrySubmission() {
		await performSubmission();
	}

	function handleCancel() {
		dispatch('cancel');
	}

	// Dynamic list management
	function addListItem(listName: keyof ADRFormData, listItem?: string) {
		const currentList = formData[listName] as string[];
		if (Array.isArray(currentList)) {
			(formData[listName] as string[]) = [...currentList, listItem || ''];
		}
	}

	function removeListItem(listName: keyof ADRFormData, index: number) {
		const currentList = formData[listName] as string[];
		if (Array.isArray(currentList) && currentList.length > 1) {
			const newList = [...currentList];
			newList.splice(index, 1);
			(formData[listName] as string[]) = newList;
		}
	}

	function addConsequenceItem(type: 'good' | 'bad' | 'neutral') {
		if (!formData.consequences) {
			formData.consequences = { good: [], bad: [], neutral: [] };
		}

		const currentList = formData.consequences[type] || [];
		formData.consequences[type] = [...currentList, ''];
	}

	function removeConsequenceItem(type: 'good' | 'bad' | 'neutral', index: number) {
		if (!formData.consequences) return;

		const currentList = formData.consequences[type] || [];
		if (currentList.length > 1) {
			const newList = [...currentList];
			newList.splice(index, 1);
			formData.consequences[type] = newList;
		}
	}

	// Lifecycle
	onMount(async () => {
		// Initialize form validation
		try {
			validator = await validationUtils.createArchitectureValidator({
				isEdit: false,
				entityType: 'architecture'
			});
			if (validator) {
				debouncedValidator = new DebouncedValidator(validator, 300);
			}
		} catch (error) {
			console.warn('Failed to initialize form validation:', error);
		}

		if (enableMcpIntegration) {
			connectionStatus = 'checking';
			const isConnected = await adrCreationService.checkConnection();
			connectionStatus = isConnected ? 'connected' : 'disconnected';

			// Load available requirements
			await loadAvailableRequirements();
		}
	});

	onDestroy(() => {
		if (submissionDebounce) {
			clearTimeout(submissionDebounce);
		}
		if (debouncedValidator) {
			debouncedValidator.cancel();
		}
	});
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
									const isConnected = await adrCreationService.checkConnection();
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

	<!-- ADR Type Selection -->
	<div class="space-y-2">
		<label
			for="type"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			ADR Type
		</label>
		<select
			id="type"
			bind:value={formData.type}
			onchange={() => validateFieldRealTime('type', formData.type)}
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
				.foreground}; border-color: {$currentTheme.base.border};"
			disabled={isSubmitting}
		>
			{#each typeOptions as option}
				<option value={option.value}>{option.label} - {option.description}</option>
			{/each}
		</select>
		{#if getFieldError('type')}
			<p class="text-sm text-red-500">{getFieldError('type')}</p>
		{/if}
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
			placeholder="Enter ADR title (e.g., 'Use React for frontend framework')"
			maxlength="200"
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {getFieldError(
				'title'
			)
				? 'border-red-500'
				: ''}"
			style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
				.foreground}; border-color: {getFieldError('title')
				? '#ef4444'
				: $currentTheme.base.border};"
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
					{formData.title.length}/200 characters
				</p>
			</div>
		</div>
	</div>

	<!-- Context -->
	<div class="space-y-2">
		<div class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Context *
		</div>
		<RichTextEditor
			id="context"
			content={formData.context}
			placeholder="Describe the context and problem space that requires this decision..."
			minHeight="150px"
			maxHeight="300px"
			disabled={isSubmitting}
			required={true}
			onUpdate={(content) => {
				formData.context = content;
				validateFieldRealTime('context', content);
			}}
		/>
		{#if getFieldError('context')}
			<p class="text-sm text-red-500">{getFieldError('context')}</p>
		{/if}
	</div>

	<!-- Decision Drivers -->
	<fieldset class="space-y-2">
		<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Decision Drivers
		</legend>
		{#each formData.decision_drivers || [] as driver, index}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={formData.decision_drivers[index]}
					placeholder="What drove this decision? (e.g., 'Performance requirements', 'Team expertise')"
					class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
						.foreground}; border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				/>
				{#if (formData.decision_drivers?.length || 0) > 1}
					<button
						type="button"
						onclick={() => removeListItem('decision_drivers', index)}
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
			onclick={() => addListItem('decision_drivers')}
			class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
			disabled={isSubmitting}
		>
			+ Add Decision Driver
		</button>
	</fieldset>

	<!-- Considered Options -->
	<fieldset class="space-y-2">
		<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Considered Options (minimum 2)
		</legend>
		{#each formData.considered_options || [] as option, index}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={formData.considered_options[index]}
					placeholder="Option {index + 1}: Describe the alternative considered"
					class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
						.foreground}; border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				/>
				{#if (formData.considered_options?.length || 0) > 2}
					<button
						type="button"
						onclick={() => removeListItem('considered_options', index)}
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
			onclick={() => addListItem('considered_options')}
			class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
			disabled={isSubmitting}
		>
			+ Add Option
		</button>
	</fieldset>

	<!-- Decision Outcome -->
	<div class="space-y-2">
		<div class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Decision Outcome *
		</div>
		<RichTextEditor
			id="decision_outcome"
			content={formData.decision_outcome}
			placeholder="Describe the final decision and rationale..."
			minHeight="150px"
			maxHeight="300px"
			disabled={isSubmitting}
			required={true}
			onUpdate={(content) => {
				formData.decision_outcome = content;
				validateFieldRealTime('decision_outcome', content);
			}}
		/>
		{#if getFieldError('decision_outcome')}
			<p class="text-sm text-red-500">{getFieldError('decision_outcome')}</p>
		{/if}
	</div>

	<!-- Consequences -->
	<fieldset class="space-y-4">
		<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Consequences
		</legend>

		<!-- Good Consequences -->
		<div class="space-y-2">
			<h4 class="text-sm font-medium text-green-600">Good Consequences</h4>
			{#each formData.consequences?.good || [] as consequence, index}
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={formData.consequences.good[index]}
						placeholder="Positive outcome from this decision"
						class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-green-500 focus:border-green-500"
						style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
							.foreground}; border-color: {$currentTheme.base.border};"
						disabled={isSubmitting}
					/>
					{#if (formData.consequences?.good?.length || 0) > 1}
						<button
							type="button"
							onclick={() => removeConsequenceItem('good', index)}
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
				onclick={() => addConsequenceItem('good')}
				class="text-sm text-green-600 hover:text-green-800 transition-colors"
				disabled={isSubmitting}
			>
				+ Add Good Consequence
			</button>
		</div>

		<!-- Bad Consequences -->
		<div class="space-y-2">
			<h4 class="text-sm font-medium text-red-600">Bad Consequences</h4>
			{#each formData.consequences?.bad || [] as consequence, index}
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={formData.consequences.bad[index]}
						placeholder="Negative outcome or trade-off from this decision"
						class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-red-500 focus:border-red-500"
						style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
							.foreground}; border-color: {$currentTheme.base.border};"
						disabled={isSubmitting}
					/>
					{#if (formData.consequences?.bad?.length || 0) > 1}
						<button
							type="button"
							onclick={() => removeConsequenceItem('bad', index)}
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
				onclick={() => addConsequenceItem('bad')}
				class="text-sm text-red-600 hover:text-red-800 transition-colors"
				disabled={isSubmitting}
			>
				+ Add Bad Consequence
			</button>
		</div>

		<!-- Neutral Consequences -->
		<div class="space-y-2">
			<h4 class="text-sm font-medium text-gray-600">Neutral Consequences</h4>
			{#each formData.consequences?.neutral || [] as consequence, index}
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={formData.consequences.neutral[index]}
						placeholder="Neutral outcome or side effect from this decision"
						class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
						style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
							.foreground}; border-color: {$currentTheme.base.border};"
						disabled={isSubmitting}
					/>
					{#if (formData.consequences?.neutral?.length || 0) > 1}
						<button
							type="button"
							onclick={() => removeConsequenceItem('neutral', index)}
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
				onclick={() => addConsequenceItem('neutral')}
				class="text-sm text-gray-600 hover:text-gray-800 transition-colors"
				disabled={isSubmitting}
			>
				+ Add Neutral Consequence
			</button>
		</div>
	</fieldset>

	<!-- Authors -->
	<fieldset class="space-y-2">
		<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Authors * (minimum 1)
		</legend>
		{#each formData.authors as author, index}
			<div class="flex gap-2">
				<input
					type="email"
					bind:value={formData.authors[index]}
					placeholder="Author email address"
					class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base
						.foreground}; border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
					required
				/>
				{#if formData.authors.length > 1}
					<button
						type="button"
						onclick={() => removeListItem('authors', index)}
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
			onclick={() => addListItem('authors')}
			class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
			disabled={isSubmitting}
		>
			+ Add Author
		</button>
	</fieldset>

	<!-- Requirements Linking -->
	<fieldset class="space-y-2">
		<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Linked Requirements *
		</legend>
		<p class="text-sm text-gray-600">Select requirements this architectural decision addresses:</p>

		{#if loadingRequirements}
			<div class="flex items-center space-x-2 text-sm text-gray-600">
				<div
					class="animate-spin h-4 w-4 border border-gray-300 border-t-blue-600 rounded-full"
				></div>
				<span>Loading requirements...</span>
			</div>
		{:else if availableRequirements.length === 0}
			<p class="text-sm text-gray-500">
				No approved requirements available. Requirements must be in 'Approved' status or later for
				architectural decisions.
			</p>
		{:else}
			<div class="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
				{#each availableRequirements as requirement}
					<label class="flex items-start space-x-2">
						<input
							type="checkbox"
							bind:group={formData.requirement_ids}
							value={requirement.id}
							class="mt-1"
							disabled={isSubmitting}
						/>
						<div class="flex-1">
							<div class="text-sm font-medium">{requirement.title}</div>
							<div class="text-xs text-gray-500">
								{requirement.id} | {requirement.type} | {requirement.status}
							</div>
						</div>
					</label>
				{/each}
			</div>
		{/if}

		{#if getFieldError('requirement_ids')}
			<p class="text-sm text-red-500">{getFieldError('requirement_ids')}</p>
		{/if}

		{#if formData.requirement_ids.length > 0}
			<p class="text-sm text-gray-600">
				{formData.requirement_ids.length} requirement{formData.requirement_ids.length === 1
					? ''
					: 's'} selected
			</p>
		{/if}
	</fieldset>

	<!-- Submission Feedback (when MCP integration enabled) -->
	{#if enableMcpIntegration}
		<div class="space-y-3">
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
								Unable to connect to the server. Your ADR will be saved locally and can be submitted
								when the connection is restored.
							</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Form Actions -->
	<div
		class="flex justify-end space-x-3 pt-4 border-t"
		style="border-color: {$currentTheme.base.border};"
	>
		<button
			type="button"
			onclick={handleCancel}
			disabled={isSubmitting}
			class="px-4 py-2 rounded-lg border transition-colors hover:bg-opacity-10 disabled:opacity-50"
			style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base.muted};"
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
			{isSubmitting ? 'Creating...' : 'Create ADR'}
		</button>
	</div>
</form>
