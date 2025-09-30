<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import RichTextEditor from './RichTextEditor.svelte';
	import { stripHtmlForValidation } from '$lib/utils/html-sanitizer.js';
	import { taskCreationService } from '$lib/services/task-creation.js';
	import {
		validationUtils,
		FormValidator,
		DebouncedValidator,
		type FieldValidationResult,
		type ValidationResult
	} from '$lib/validation/index.js';
	import type {
		TaskFormData,
		Priority,
		EffortSize,
		Task,
		Requirement,
		MCPResponse
	} from '$lib/types/lifecycle';

	interface Props {
		initialData?: Partial<TaskFormData>;
		enableMcpIntegration?: boolean;
		isSubmitting?: boolean;
	}

	let {
		initialData = {},
		enableMcpIntegration = false,
		isSubmitting: isSubmittingProp = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		submit: TaskFormData;
		cancel: void;
		success: { task: Task; message: string };
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
	let isValidating = $state(false);

	// Available requirements and tasks for selection
	let availableRequirements = $state<Requirement[]>([]);
	let availableTasks = $state<Task[]>([]);
	let loadingRequirements = $state(false);
	let loadingTasks = $state(false);

	// Form data
	let formData = $state<TaskFormData>({
		title: initialData.title || '',
		priority: initialData.priority || 'P1',
		effort: initialData.effort || 'M',
		user_story: initialData.user_story || '',
		acceptance_criteria: initialData.acceptance_criteria?.length
			? initialData.acceptance_criteria
			: [''],
		assignee: initialData.assignee || '',
		requirement_ids: initialData.requirement_ids || [],
		parent_task_id: initialData.parent_task_id || ''
	});

	// Priority options
	const priorityOptions: { value: Priority; label: string; description: string }[] = [
		{
			value: 'P0',
			label: 'P0 - Critical',
			description: 'Critical/blocking issues requiring immediate attention'
		},
		{ value: 'P1', label: 'P1 - High', description: 'High priority features and important fixes' },
		{ value: 'P2', label: 'P2 - Medium', description: 'Standard features and improvements' },
		{ value: 'P3', label: 'P3 - Low', description: 'Nice-to-have features and minor enhancements' }
	];

	// Effort size options
	const effortOptions: { value: EffortSize; label: string; description: string }[] = [
		{ value: 'XS', label: 'XS - Extra Small', description: '1-2 hours of work' },
		{ value: 'S', label: 'S - Small', description: '2-4 hours of work' },
		{ value: 'M', label: 'M - Medium', description: '4-8 hours of work' },
		{ value: 'L', label: 'L - Large', description: '1-2 days of work' },
		{ value: 'XL', label: 'XL - Extra Large', description: '2+ days of work' }
	];

	// Computed properties
	let isFormValid = $derived(
		formValidationResult?.isValid &&
			formData.title.trim().length > 0 &&
			formData.requirement_ids.length > 0
	);

	let hasValidationErrors = $derived(
		Object.values(fieldValidationResults).some((result) => !result.isValid)
	);

	// Initialize form
	onMount(async () => {
		await initializeForm();
		await loadRequirements();
		await loadTasks();
	});

	onDestroy(() => {
		if (submissionDebounce) {
			clearTimeout(submissionDebounce);
		}
		debouncedValidator?.cancel();
	});

	async function initializeForm() {
		try {
			if (enableMcpIntegration) {
				connectionStatus = 'checking';
				const connected = await taskCreationService.checkConnection();
				connectionStatus = connected ? 'connected' : 'disconnected';
			}

			// Initialize validator with context that includes available requirements
			const validationContext = {
				entityType: 'task',
				availableRequirements: availableRequirements
			};
			validator = await validationUtils.createTaskValidator(validationContext);
			debouncedValidator = new DebouncedValidator(validator, 300);

			// Initial form validation
			await validateForm();
		} catch (error) {
			console.error('Failed to initialize task form:', error);
			connectionStatus = 'disconnected';
		}
	}

	async function loadRequirements() {
		if (!enableMcpIntegration) return;

		try {
			loadingRequirements = true;
			const response = await taskCreationService.getApprovedRequirements();
			if (response.success && response.data) {
				availableRequirements = response.data;

				// Update validator context with loaded requirements
				if (validator) {
					const validationContext = {
						entityType: 'task',
						availableRequirements: availableRequirements
					};
					validator.updateContext(validationContext);
				}
			}
		} catch (error) {
			console.error('Failed to load requirements:', error);
		} finally {
			loadingRequirements = false;
		}
	}

	async function loadTasks() {
		if (!enableMcpIntegration) return;

		try {
			loadingTasks = true;
			const response = await taskCreationService.getAllTasks();
			if (response.success && response.data) {
				availableTasks = response.data;
			}
		} catch (error) {
			console.error('Failed to load tasks:', error);
		} finally {
			loadingTasks = false;
		}
	}

	async function validateForm() {
		if (!validator) return;

		try {
			isValidating = true;
			formValidationResult = await validator.validateForm(formData);
		} catch (error) {
			console.error('Form validation failed:', error);
		} finally {
			isValidating = false;
		}
	}

	async function validateField(fieldName: string, value: any) {
		if (!debouncedValidator) return;

		try {
			debouncedValidator.validateFieldDebounced(fieldName, value, formData, (result) => {
				fieldValidationResults[fieldName] = result;
			});
		} catch (error) {
			console.error(`Validation failed for field ${fieldName}:`, error);
		}
	}

	// Acceptance criteria management
	function addAcceptanceCriterion() {
		formData.acceptance_criteria = [...formData.acceptance_criteria, ''];
	}

	function removeAcceptanceCriterion(index: number) {
		if (formData.acceptance_criteria.length > 1) {
			formData.acceptance_criteria = formData.acceptance_criteria.filter((_, i) => i !== index);
		}
	}

	function updateAcceptanceCriterion(index: number, value: string) {
		formData.acceptance_criteria[index] = value;
		formData.acceptance_criteria = [...formData.acceptance_criteria];
	}

	// Requirement selection
	function toggleRequirement(requirementId: string) {
		if (formData.requirement_ids.includes(requirementId)) {
			formData.requirement_ids = formData.requirement_ids.filter((id) => id !== requirementId);
		} else {
			formData.requirement_ids = [...formData.requirement_ids, requirementId];
		}
		validateField('requirement_ids', formData.requirement_ids);
	}

	// Form submission
	async function handleSubmit() {
		if (!isFormValid || isSubmitting) return;

		// Clear previous state
		submitError = '';
		successMessage = '';
		isRetryable = false;

		// Debounce rapid submissions
		if (submissionDebounce) {
			clearTimeout(submissionDebounce);
		}

		submissionDebounce = setTimeout(async () => {
			try {
				internalIsSubmitting = true;
				submissionId = `task-${Date.now()}`;

				// Validate form one more time
				await validateForm();
				if (!formValidationResult?.isValid) {
					throw new Error('Form validation failed');
				}

				// Submit via service or dispatch
				if (enableMcpIntegration) {
					const response = await taskCreationService.createTask(formData);

					if (response.success && response.data) {
						successMessage = 'Task created successfully!';
						dispatch('success', {
							task: response.data,
							message: successMessage
						});

						// Reset form on success
						resetForm();
					} else {
						throw new Error(response.error || 'Failed to create task');
					}
				} else {
					// Emit form data for parent component to handle
					dispatch('submit', formData);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to create task';
				submitError = errorMessage;
				isRetryable = !errorMessage.includes('validation') && !errorMessage.includes('invalid');

				dispatch('error', {
					error: errorMessage,
					isRetryable
				});
			} finally {
				internalIsSubmitting = false;
			}
		}, 100);
	}

	function resetForm() {
		formData = {
			title: '',
			priority: 'P1',
			effort: 'M',
			user_story: '',
			acceptance_criteria: [''],
			assignee: '',
			requirement_ids: [],
			parent_task_id: ''
		};
		fieldValidationResults = {};
		formValidationResult = null;
		submitError = '';
		successMessage = '';
	}

	function handleCancel() {
		dispatch('cancel');
	}

	// Input handlers with validation
	async function handleTitleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		formData.title = target.value;
		await validateField('title', formData.title);
		await validateForm();
	}

	async function handleUserStoryChange(content: string) {
		formData.user_story = stripHtmlForValidation(content);
		await validateField('user_story', formData.user_story);
		await validateForm();
	}

	async function handleAssigneeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		formData.assignee = target.value;
		await validateField('assignee', formData.assignee);
		await validateForm();
	}

	async function handlePriorityChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		formData.priority = target.value as Priority;
		await validateField('priority', formData.priority);
		await validateForm();
	}

	async function handleEffortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		formData.effort = target.value as EffortSize;
		await validateField('effort', formData.effort);
		await validateForm();
	}

	async function handleParentTaskChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		formData.parent_task_id = target.value || '';
		await validateField('parent_task_id', formData.parent_task_id);
		await validateForm();
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6" data-testid="task-form">
	<!-- Connection Status (if MCP enabled) -->
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
						<span class="text-green-700">Connected to Lifecycle MCP</span>
					{:else}
						<div class="h-3 w-3 bg-red-500 rounded-full"></div>
						<span class="text-red-700">Disconnected from MCP server</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Success Message -->
	{#if successMessage}
		<div class="bg-green-50 border border-green-200 rounded-md p-4" data-testid="success-message">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium text-green-800">{successMessage}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if submitError}
		<div class="bg-red-50 border border-red-200 rounded-md p-4" data-testid="error-message">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-sm text-red-800">{submitError}</p>
					{#if isRetryable}
						<p class="text-xs text-red-600 mt-1">
							Please try again. If the problem persists, check your connection.
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Title Field -->
	<div>
		<label for="task-title" class="block text-sm font-medium text-gray-700 mb-1">
			Task Title *
		</label>
		<input
			id="task-title"
			type="text"
			bind:value={formData.title}
			on:input={handleTitleChange}
			placeholder="Enter a clear, actionable task title"
			class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			class:border-red-500={fieldValidationResults.title && !fieldValidationResults.title.isValid}
			required
			data-testid="task-title"
		/>
		{#if fieldValidationResults.title && !fieldValidationResults.title.isValid}
			<p class="mt-1 text-sm text-red-600" data-testid="title-error">
				{fieldValidationResults.title.errors.join(', ')}
			</p>
		{/if}
	</div>

	<!-- Priority and Effort -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="task-priority" class="block text-sm font-medium text-gray-700 mb-1">
				Priority *
			</label>
			<select
				id="task-priority"
				bind:value={formData.priority}
				on:change={handlePriorityChange}
				class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				required
				data-testid="task-priority"
			>
				{#each priorityOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="task-effort" class="block text-sm font-medium text-gray-700 mb-1">
				Effort Estimate
			</label>
			<select
				id="task-effort"
				bind:value={formData.effort}
				on:change={handleEffortChange}
				class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				data-testid="task-effort"
			>
				{#each effortOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- User Story -->
	<div>
		<label for="task-user-story" class="block text-sm font-medium text-gray-700 mb-1">
			User Story
		</label>
		<RichTextEditor
			initialContent={formData.user_story}
			placeholder="As a [user type], I want [functionality] so that [benefit]..."
			on:change={(e) => handleUserStoryChange(e.detail)}
			data-testid="task-user-story"
		/>
		<p class="mt-1 text-sm text-gray-500">Describe the task from the user's perspective</p>
	</div>

	<!-- Assignee -->
	<div>
		<label for="task-assignee" class="block text-sm font-medium text-gray-700 mb-1">
			Assignee
		</label>
		<input
			id="task-assignee"
			type="email"
			bind:value={formData.assignee}
			on:input={handleAssigneeChange}
			placeholder="assignee@company.com"
			class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			class:border-red-500={fieldValidationResults.assignee &&
				!fieldValidationResults.assignee.isValid}
			data-testid="task-assignee"
		/>
		{#if fieldValidationResults.assignee && !fieldValidationResults.assignee.isValid}
			<p class="mt-1 text-sm text-red-600" data-testid="assignee-error">
				{fieldValidationResults.assignee.errors.join(', ')}
			</p>
		{/if}
	</div>

	<!-- Requirements Selection -->
	<div>
		<label class="block text-sm font-medium text-gray-700 mb-1"> Linked Requirements * </label>
		{#if loadingRequirements}
			<div class="flex items-center space-x-2 py-2">
				<div
					class="animate-spin h-4 w-4 border border-gray-300 border-t-blue-600 rounded-full"
				></div>
				<span class="text-sm text-gray-600">Loading requirements...</span>
			</div>
		{:else if availableRequirements.length === 0}
			<div class="border border-gray-300 rounded-md p-4 text-center text-gray-500">
				No approved requirements available. Requirements must be in 'Approved' status or later to
				create tasks.
			</div>
		{:else}
			<div
				class="border border-gray-300 rounded-md max-h-48 overflow-y-auto"
				data-testid="requirements-selection"
			>
				{#each availableRequirements as requirement}
					<label
						class="flex items-start space-x-3 p-3 hover:bg-gray-50 border-b border-gray-200 last:border-b-0"
					>
						<input
							type="checkbox"
							checked={formData.requirement_ids.includes(requirement.id)}
							on:change={() => toggleRequirement(requirement.id)}
							class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
							data-testid={`requirement-${requirement.id}`}
						/>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-900">{requirement.title}</p>
							<p class="text-xs text-gray-500">
								{requirement.id} • {requirement.status} • {requirement.priority}
							</p>
						</div>
					</label>
				{/each}
			</div>
		{/if}
		{#if formData.requirement_ids.length === 0}
			<p class="mt-1 text-sm text-red-600" data-testid="requirements-error">
				At least one requirement must be selected
			</p>
		{/if}
	</div>

	<!-- Parent Task Selection -->
	<div>
		<label for="parent-task" class="block text-sm font-medium text-gray-700 mb-1">
			Parent Task (Optional)
		</label>
		{#if loadingTasks}
			<div class="flex items-center space-x-2 py-2">
				<div
					class="animate-spin h-4 w-4 border border-gray-300 border-t-blue-600 rounded-full"
				></div>
				<span class="text-sm text-gray-600">Loading tasks...</span>
			</div>
		{:else}
			<select
				id="parent-task"
				bind:value={formData.parent_task_id}
				on:change={handleParentTaskChange}
				class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				data-testid="parent-task"
			>
				<option value="">No parent task</option>
				{#each availableTasks as task}
					<option value={task.id}>{task.id} - {task.title}</option>
				{/each}
			</select>
		{/if}
		<p class="mt-1 text-sm text-gray-500">Select a parent task to create a subtask</p>
	</div>

	<!-- Acceptance Criteria -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<label class="block text-sm font-medium text-gray-700"> Acceptance Criteria </label>
			<button
				type="button"
				on:click={addAcceptanceCriterion}
				class="text-sm text-blue-600 hover:text-blue-800 font-medium"
				data-testid="add-criterion"
			>
				+ Add Criterion
			</button>
		</div>
		<div class="space-y-2" data-testid="acceptance-criteria">
			{#each formData.acceptance_criteria as criterion, index}
				<div class="flex items-start space-x-2">
					<input
						type="text"
						bind:value={formData.acceptance_criteria[index]}
						placeholder="Enter acceptance criterion"
						class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						data-testid={`criterion-${index}`}
					/>
					{#if formData.acceptance_criteria.length > 1}
						<button
							type="button"
							on:click={() => removeAcceptanceCriterion(index)}
							class="mt-2 p-1 text-red-600 hover:text-red-800"
							data-testid={`remove-criterion-${index}`}
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Form Actions -->
	<div class="flex justify-end space-x-3 pt-6 border-t border-gray-200">
		<button
			type="button"
			on:click={handleCancel}
			class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			data-testid="cancel-button"
		>
			Cancel
		</button>
		<button
			type="submit"
			disabled={!isFormValid || isSubmitting || hasValidationErrors}
			class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
			data-testid="submit-button"
		>
			{#if isSubmitting}
				<div class="flex items-center space-x-2">
					<div
						class="animate-spin h-4 w-4 border border-white border-t-transparent rounded-full"
					></div>
					<span>Creating Task...</span>
				</div>
			{:else}
				Create Task
			{/if}
		</button>
	</div>
</form>
