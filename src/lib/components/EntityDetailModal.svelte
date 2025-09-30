<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { mcpClient } from '$lib/services/lifecycle-mcp-client.js';
	import Modal from './Modal.svelte';
	import { Calendar, User, Tag, AlertCircle, Edit, Trash2, Clock, FileText } from 'lucide-svelte';
	import { currentTheme } from '$lib/theme';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';

	type EntityType = 'requirement' | 'task' | 'architecture';
	type Entity = Requirement | Task | ArchitectureDecision;

	interface Props {
		isOpen?: boolean;
		entityType: EntityType;
		entityId: string;
	}

	let { isOpen = false, entityType, entityId }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		edit: { entityType: EntityType; entityId: string };
		delete: { entityType: EntityType; entityId: string };
		refresh: void;
	}>();

	let entity: Entity | null = $state(null);
	let loading = $state(false);
	let error = $state('');

	// Load entity details when modal opens
	$effect(() => {
		if (isOpen && entityId) {
			loadEntityDetails();
		}
	});

	async function loadEntityDetails() {
		console.log(`[EntityDetailModal] Loading ${entityType} details for ID: ${entityId}`);
		loading = true;
		error = '';
		entity = null;

		try {
			let response;

			// Use JSON endpoints that return structured data instead of formatted text
			switch (entityType) {
				case 'requirement':
					response = await mcpClient.requirements.getRequirementsJson();
					break;
				case 'task':
					response = await mcpClient.tasks.getTasksJson();
					break;
				case 'architecture':
					response = await mcpClient.architecture.getArchitectureDecisionsJson();
					break;
				default:
					throw new Error(`Unknown entity type: ${entityType}`);
			}

			console.log(`[EntityDetailModal] Response for ${entityType} ${entityId}:`, response);

			if (response.success && response.data && Array.isArray(response.data)) {
				// Find the specific entity by ID from the array
				const foundEntity = response.data.find((item: any) => item.id === entityId);
				if (foundEntity) {
					entity = foundEntity;
					console.log(`[EntityDetailModal] Successfully loaded entity:`, entity);
				} else {
					error = `${entityType} with ID ${entityId} not found`;
					console.log(`[EntityDetailModal] Entity not found in response array`);
				}
			} else {
				error = response.error || `Failed to load ${entityType} details`;
				console.log(`[EntityDetailModal] Failed to load entity:`, error);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : `Failed to load ${entityType}`;
			console.log(`[EntityDetailModal] Error loading entity:`, err);
		} finally {
			loading = false;
			console.log(`[EntityDetailModal] Loading complete. Entity:`, entity, 'Error:', error);
		}
	}

	function handleClose() {
		dispatch('close');
	}

	function handleEdit() {
		dispatch('edit', { entityType, entityId });
	}

	function handleDelete() {
		dispatch('delete', { entityType, entityId });
	}

	// Get display title based on entity type
	function getTitle(entity: Entity, type: EntityType): string {
		if (type === 'requirement') return (entity as Requirement).title;
		if (type === 'task') return (entity as Task).title;
		if (type === 'architecture') return (entity as ArchitectureDecision).title;
		return 'Entity Details';
	}

	// Get status color classes based on entity type and status
	function getStatusColorClasses(entity: Entity, type: EntityType): string {
		const status = entity.status;

		if (type === 'requirement') {
			return (
				{
					Draft: 'text-red-700 bg-red-100 border-red-300',
					'Under Review': 'text-yellow-700 bg-yellow-100 border-yellow-300',
					Approved: 'text-blue-700 bg-blue-100 border-blue-300',
					Architecture: 'text-purple-700 bg-purple-100 border-purple-300',
					Ready: 'text-green-700 bg-green-100 border-green-300',
					Implemented: 'text-emerald-700 bg-emerald-100 border-emerald-300',
					Validated: 'text-teal-700 bg-teal-100 border-teal-300',
					Deprecated: 'text-gray-700 bg-gray-100 border-gray-300'
				}[status] || 'text-gray-700 bg-gray-100 border-gray-300'
			);
		}

		if (type === 'task') {
			return (
				{
					'Not Started': 'text-gray-700 bg-gray-100 border-gray-300',
					'In Progress': 'text-blue-700 bg-blue-100 border-blue-300',
					Blocked: 'text-red-700 bg-red-100 border-red-300',
					Complete: 'text-green-700 bg-green-100 border-green-300',
					Abandoned: 'text-gray-700 bg-gray-100 border-gray-300'
				}[status] || 'text-gray-700 bg-gray-100 border-gray-300'
			);
		}

		if (type === 'architecture') {
			return (
				{
					Draft: 'text-red-700 bg-red-100 border-red-300',
					'Under Review': 'text-yellow-700 bg-yellow-100 border-yellow-300',
					Approved: 'text-blue-700 bg-blue-100 border-blue-300',
					Implemented: 'text-green-700 bg-green-100 border-green-300',
					Deprecated: 'text-gray-700 bg-gray-100 border-gray-300'
				}[status] || 'text-gray-700 bg-gray-100 border-gray-300'
			);
		}

		return 'text-gray-700 bg-gray-100 border-gray-300';
	}

	// Format date for display
	function formatDate(dateString: string): string {
		try {
			return new Date(dateString).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateString;
		}
	}
</script>

<Modal
	{isOpen}
	title={entity ? getTitle(entity, entityType) : `Loading ${entityType}...`}
	size="xl"
	on:close={handleClose}
>
	<div class="space-y-6">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div
					class="animate-spin h-8 w-8 border border-gray-300 border-t-blue-600 rounded-full"
				></div>
				<span class="ml-3 text-gray-600">Loading {entityType} details...</span>
			</div>
		{:else if error}
			<div class="flex items-center justify-center py-8">
				<div class="text-center">
					<AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-3" />
					<p class="text-red-600 font-medium">Failed to load {entityType}</p>
					<p class="text-gray-500 text-sm mt-1">{error}</p>
					<button
						onclick={loadEntityDetails}
						class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		{:else if entity}
			<!-- DEBUG: Rendering entity content -->
			<!-- Header with status and actions -->
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<div class="flex items-center space-x-3 mb-2">
						<span
							class={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColorClasses(entity, entityType)}`}
						>
							{entity.status}
						</span>
						{#if entity.priority}
							<span
								class="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300"
							>
								{entity.priority}
							</span>
						{/if}
						{#if entityType === 'requirement' && (entity as Requirement).type}
							<span
								class="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300"
							>
								{(entity as Requirement).type}
							</span>
						{/if}
						{#if entityType === 'task' && (entity as Task).effort}
							<span
								class="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-300"
							>
								{(entity as Task).effort}
							</span>
						{/if}
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-1">
						{getTitle(entity, entityType)}
					</h3>
					{#if entity.id}
						<p class="text-sm text-gray-500">{entity.id}</p>
					{/if}
				</div>

				<div class="flex items-center space-x-2 ml-4">
					<button
						onclick={handleEdit}
						class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
						title="Edit {entityType}"
					>
						<Edit class="w-5 h-5" />
					</button>
					<button
						onclick={handleDelete}
						class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
						title="Delete {entityType}"
					>
						<Trash2 class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Entity-specific content -->
			<div class="space-y-6">
				<!-- Common fields -->
				{#if entityType === 'requirement'}
					{@const req = entity as Requirement}
					{#if req.current_state}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Current State</h4>
							<p class="text-gray-700 leading-relaxed">{req.current_state}</p>
						</div>
					{/if}
					{#if req.desired_state}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Desired State</h4>
							<p class="text-gray-700 leading-relaxed">{req.desired_state}</p>
						</div>
					{/if}
					{#if req.business_value && req.business_value.length > 0}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Business Value</h4>
							<ul class="list-disc list-inside space-y-1 text-gray-700">
								{#each req.business_value as value}
									<li>{value}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if req.functional_requirements && req.functional_requirements.length > 0}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Functional Requirements</h4>
							<ul class="list-disc list-inside space-y-1 text-gray-700">
								{#each req.functional_requirements as func}
									<li>{func}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if req.acceptance_criteria && req.acceptance_criteria.length > 0}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Acceptance Criteria</h4>
							<ul class="list-disc list-inside space-y-1 text-gray-700">
								{#each req.acceptance_criteria as criteria}
									<li>{criteria}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{:else if entityType === 'task'}
					{@const task = entity as Task}
					{#if task.user_story}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">User Story</h4>
							<p class="text-gray-700 leading-relaxed">{task.user_story}</p>
						</div>
					{/if}
					{#if task.assignee}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Assignee</h4>
							<div class="flex items-center space-x-2">
								<User class="w-4 h-4 text-gray-500" />
								<span class="text-gray-700">{task.assignee}</span>
							</div>
						</div>
					{/if}
					{#if task.acceptance_criteria && task.acceptance_criteria.length > 0}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Acceptance Criteria</h4>
							<ul class="list-disc list-inside space-y-1 text-gray-700">
								{#each task.acceptance_criteria as criteria}
									<li>{criteria}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{:else if entityType === 'architecture'}
					{@const arch = entity as ArchitectureDecision}
					{#if arch.context}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Context</h4>
							<p class="text-gray-700 leading-relaxed">{arch.context}</p>
						</div>
					{/if}
					{#if arch.decision}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Decision</h4>
							<p class="text-gray-700 leading-relaxed">{arch.decision}</p>
						</div>
					{/if}
					{#if arch.considered_options && arch.considered_options.length > 0}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Considered Options</h4>
							<ul class="list-disc list-inside space-y-1 text-gray-700">
								{#each arch.considered_options as option}
									<li>{option}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if arch.consequences}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Consequences</h4>
							<div class="space-y-3">
								{#if arch.consequences.good && arch.consequences.good.length > 0}
									<div>
										<h5 class="text-sm font-medium text-green-700 mb-1">Good</h5>
										<ul class="list-disc list-inside space-y-1 text-gray-700 text-sm">
											{#each arch.consequences.good as consequence}
												<li>{consequence}</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if arch.consequences.bad && arch.consequences.bad.length > 0}
									<div>
										<h5 class="text-sm font-medium text-red-700 mb-1">Bad</h5>
										<ul class="list-disc list-inside space-y-1 text-gray-700 text-sm">
											{#each arch.consequences.bad as consequence}
												<li>{consequence}</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if arch.consequences.neutral && arch.consequences.neutral.length > 0}
									<div>
										<h5 class="text-sm font-medium text-gray-700 mb-1">Neutral</h5>
										<ul class="list-disc list-inside space-y-1 text-gray-700 text-sm">
											{#each arch.consequences.neutral as consequence}
												<li>{consequence}</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						</div>
					{/if}
					{#if arch.authors && arch.authors.length > 0}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Authors</h4>
							<div class="flex flex-wrap gap-2">
								{#each arch.authors as author}
									<span
										class="inline-flex items-center px-2 py-1 rounded text-sm bg-gray-100 text-gray-700 border border-gray-300"
									>
										<User class="w-3 h-3 mr-1" />
										{author}
									</span>
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<!-- Metadata -->
				<div class="border-t pt-4">
					<h4 class="font-medium text-gray-900 mb-3">Metadata</h4>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
						{#if entity.author}
							<div class="flex items-center space-x-2">
								<User class="w-4 h-4 text-gray-500" />
								<span class="text-gray-500">Author:</span>
								<span class="text-gray-700">{entity.author}</span>
							</div>
						{/if}
						{#if entity.created_at}
							<div class="flex items-center space-x-2">
								<Calendar class="w-4 h-4 text-gray-500" />
								<span class="text-gray-500">Created:</span>
								<span class="text-gray-700">{formatDate(entity.created_at)}</span>
							</div>
						{/if}
						{#if entity.updated_at}
							<div class="flex items-center space-x-2">
								<Clock class="w-4 h-4 text-gray-500" />
								<span class="text-gray-500">Updated:</span>
								<span class="text-gray-700">{formatDate(entity.updated_at)}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- DEBUG: No condition matched -->
			<div class="flex items-center justify-center py-8">
				<div class="text-center">
					<p class="text-gray-600">Debug: No condition matched</p>
					<p class="text-sm text-gray-500">
						Loading: {loading}, Error: {error}, Entity: {entity ? 'exists' : 'null'}
					</p>
				</div>
			</div>
		{/if}
	</div>
</Modal>
