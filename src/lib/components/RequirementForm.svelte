<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import RichTextEditor from './RichTextEditor.svelte';
	import { stripHtmlForValidation } from '$lib/utils/html-sanitizer.js';
	import type {
		RequirementFormData,
		RequirementType,
		Priority,
		RiskLevel
	} from '$lib/types/lifecycle';

	interface Props {
		isSubmitting?: boolean;
		initialData?: Partial<RequirementFormData>;
	}

	let { isSubmitting = false, initialData = {} }: Props = $props();

	const dispatch = createEventDispatcher<{
		submit: RequirementFormData;
		cancel: void;
	}>();

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

	function validateForm(): boolean {
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

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!validateForm() || isSubmitting) return;

		dispatch('submit', formData);
	}

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
</script>

<form onsubmit={handleSubmit} class="space-y-6">
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
			placeholder="Enter requirement title (max 100 characters)"
			maxlength="100"
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {errors.title
				? 'border-red-500'
				: ''}"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {errors.title ? '#ef4444' : $currentTheme.base.border};"
			disabled={isSubmitting}
		/>
		{#if errors.title}
			<p class="text-sm text-red-500">{errors.title}</p>
		{/if}
		<p class="text-xs" style="color: {$currentTheme.base.muted};">
			{formData.title.length}/100 characters
		</p>
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
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {$currentTheme.base.border};"
			disabled={isSubmitting}
		>
			{#each priorities as priority}
				<option value={priority.value}>{priority.label} - {priority.description}</option>
			{/each}
		</select>
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
			}}
		/>
		{#if errors.current_state}
			<p class="text-sm text-red-500">{errors.current_state}</p>
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
			}}
		/>
		{#if errors.desired_state}
			<p class="text-sm text-red-500">{errors.desired_state}</p>
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
		<legend class="block text-sm font-medium" style="color: {$currentTheme.base.foreground};">
			Acceptance Criteria * (minimum 1)
		</legend>
		{#each formData.acceptance_criteria as criteria, index}
			<div class="flex gap-2">
				<textarea
					bind:value={formData.acceptance_criteria[index]}
					placeholder="Given [context], when [action], then [outcome]..."
					rows="2"
					class="flex-1 px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
					style="background-color: {$currentTheme.base.background}; 
						   color: {$currentTheme.base.foreground}; 
						   border-color: {$currentTheme.base.border};"
					disabled={isSubmitting}
				></textarea>
				{#if formData.acceptance_criteria.length > 1}
					<button
						type="button"
						onclick={() => formData.acceptance_criteria.splice(index, 1)}
						class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors self-start"
						disabled={isSubmitting}
					>
						Remove
					</button>
				{/if}
			</div>
		{/each}
		<button
			type="button"
			onclick={() => formData.acceptance_criteria.push('')}
			class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
			disabled={isSubmitting}
		>
			+ Add Acceptance Criterion
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
			placeholder="Your name or email..."
			class="w-full px-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			style="background-color: {$currentTheme.base.background}; 
				   color: {$currentTheme.base.foreground}; 
				   border-color: {$currentTheme.base.border};"
			disabled={isSubmitting}
		/>
	</div>

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
