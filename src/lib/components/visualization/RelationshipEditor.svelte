<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, Link, AlertTriangle } from 'lucide-svelte';
	import { currentTheme } from '$lib/theme';
	import type { DiagramNode } from './DiagramRenderer.svelte';

	export let isOpen = false;
	export let sourceNode: DiagramNode | null = null;
	export let targetNode: DiagramNode | null = null;
	export let existingRelationship: any = null;


	const dispatch = createEventDispatcher<{
		close: void;
		create: { sourceId: string; targetId: string; type: string };
		delete: { relationshipId: string };
		update: { relationshipId: string; type: string };
	}>();

	const relationshipTypes = [
		{
			value: 'implements',
			label: 'Implements',
			description: 'Target implements the source requirement'
		},
		{
			value: 'depends',
			label: 'Depends On',
			description: 'Target depends on the source to be completed first'
		},
		{
			value: 'addresses',
			label: 'Addresses',
			description: 'Target addresses or relates to the source'
		},
		{ value: 'blocks', label: 'Blocks', description: 'Source blocks progress on the target' },
		{
			value: 'informs',
			label: 'Informs',
			description: 'Source provides information relevant to the target'
		}
	];

	let selectedType = 'implements';
	let showDeleteConfirm = false;

	$: if (existingRelationship) {
		selectedType = existingRelationship.type;
	}

	function handleCreate() {
		if (sourceNode && targetNode) {
			dispatch('create', {
				sourceId: sourceNode.id,
				targetId: targetNode.id,
				type: selectedType
			});
			handleClose();
		}
	}

	function handleUpdate() {
		if (existingRelationship) {
			dispatch('update', {
				relationshipId: existingRelationship.id,
				type: selectedType
			});
			handleClose();
		}
	}

	function handleDelete() {
		if (existingRelationship) {
			dispatch('delete', {
				relationshipId: existingRelationship.id
			});
			handleClose();
		}
	}

	function handleClose() {
		console.log('🚪 RelationshipEditor handleClose() called');
		isOpen = false;
		showDeleteConfirm = false;
		dispatch('close');
	}

	function validateRelationship(): { valid: boolean; warning?: string } {
		if (!sourceNode || !targetNode) {
			return { valid: false };
		}

		// Check for circular dependencies
		if (selectedType === 'depends' && sourceNode.id === targetNode.id) {
			return { valid: false, warning: 'Cannot create dependency to self' };
		}

		// Warn about unusual relationships
		if (selectedType === 'implements') {
			if (sourceNode.type === 'task' && targetNode.type === 'requirement') {
				return {
					valid: true,
					warning: 'Usually requirements are implemented by tasks, not the other way around'
				};
			}
		}

		return { valid: true };
	}

	// Only run validation when modal is open and we have the required props
	$: validation = isOpen && sourceNode && targetNode ? validateRelationship() : { valid: false };
</script>

{#if isOpen}
	<!-- Modal Overlay -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div
			class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
			style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base
				.border};"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between p-4 border-b"
				style="border-color: {$currentTheme.base.border};"
			>
				<div class="flex items-center space-x-2">
					<Link class="w-5 h-5" style="color: {$currentTheme.base.accent};" />
					<h3 class="text-lg font-semibold" style="color: {$currentTheme.base.foreground};">
						{existingRelationship ? 'Edit' : 'Create'} Relationship
					</h3>
				</div>
				<button
					on:click={() => {
						console.log('🚪 X button clicked');
						handleClose();
					}}
					class="p-1 rounded hover:bg-opacity-10"
					style="color: {$currentTheme.base.muted};"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-4 space-y-4">
				<!-- Source and Target -->
				<div class="space-y-2">
					<div class="text-sm font-medium" style="color: {$currentTheme.base.foreground};">
						Relationship
					</div>
					<div class="flex items-center space-x-2 text-sm">
						<div
							class="flex-1 p-2 rounded border"
							style="border-color: {$currentTheme.base.border};"
						>
							<div class="font-medium" style="color: {$currentTheme.base.foreground};">
								{sourceNode?.title || 'Source'}
							</div>
							<div class="text-xs" style="color: {$currentTheme.base.muted};">
								{sourceNode?.id} ({sourceNode?.type})
							</div>
						</div>
						<div class="text-2xl" style="color: {$currentTheme.base.muted};">→</div>
						<div
							class="flex-1 p-2 rounded border"
							style="border-color: {$currentTheme.base.border};"
						>
							<div class="font-medium" style="color: {$currentTheme.base.foreground};">
								{targetNode?.title || 'Target'}
							</div>
							<div class="text-xs" style="color: {$currentTheme.base.muted};">
								{targetNode?.id} ({targetNode?.type})
							</div>
						</div>
					</div>
				</div>

				<!-- Relationship Type -->
				<div class="space-y-2">
					<label class="text-sm font-medium" style="color: {$currentTheme.base.foreground};">
						Relationship Type
					</label>
					<select
						bind:value={selectedType}
						class="w-full p-2 rounded border text-sm"
						style="background-color: {$currentTheme.base.background};
								border-color: {$currentTheme.base.border};
								color: {$currentTheme.base.foreground};"
					>
						{#each relationshipTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
					<div class="text-xs" style="color: {$currentTheme.base.muted};">
						{relationshipTypes.find((t) => t.value === selectedType)?.description || ''}
					</div>
				</div>

				<!-- Validation Warning -->
				{#if validation.warning}
					<div class="flex items-start space-x-2 p-3 rounded" style="background-color: #fbbf2420;">
						<AlertTriangle class="w-4 h-4 text-yellow-600 mt-0.5" />
						<div class="text-sm text-yellow-800">
							{validation.warning}
						</div>
					</div>
				{/if}

				<!-- Delete Confirmation -->
				{#if showDeleteConfirm}
					<div
						class="p-3 rounded border"
						style="border-color: #ef444450; background-color: #ef444410;"
					>
						<div class="text-sm font-medium text-red-600 mb-2">Delete Relationship</div>
						<div class="text-sm text-red-700 mb-3">
							Are you sure you want to delete this relationship? This action cannot be undone.
						</div>
						<div class="flex space-x-2">
							<button
								on:click={handleDelete}
								class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
							>
								Delete
							</button>
							<button
								on:click={() => (showDeleteConfirm = false)}
								class="px-3 py-1 border text-sm rounded transition-colors"
								style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base
									.foreground};"
							>
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between p-4 border-t"
				style="border-color: {$currentTheme.base.border};"
			>
				<div>
					{#if existingRelationship}
						<button
							on:click={() => (showDeleteConfirm = true)}
							class="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
						>
							Delete
						</button>
					{/if}
				</div>

				<div class="flex space-x-2">
					<button
						on:click={() => {
							console.log('🚪 Cancel button clicked');
							handleClose();
						}}
						class="px-4 py-2 border rounded text-sm transition-colors"
						style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base
							.foreground};"
					>
						Cancel
					</button>
					<button
						on:click={existingRelationship ? handleUpdate : handleCreate}
						disabled={!validation.valid}
						class="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						style="background-color: {$currentTheme.base.accent}; color: white;"
					>
						{existingRelationship ? 'Update' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
