<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { mcpClient } from '$lib/services/lifecycle-mcp-client.js';
	import Modal from './Modal.svelte';
	import { Save, X, AlertCircle } from 'lucide-svelte';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';

	type EntityType = 'requirement' | 'task' | 'architecture';
	type Entity = Requirement | Task | ArchitectureDecision;

	interface Props {
		isOpen?: boolean;
		entityType: EntityType;
		entity: Entity | null;
	}

	let { isOpen = false, entityType, entity }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		success: { entity: Entity; message: string };
		error: { error: string };
	}>();

	let newStatus = $state(entity?.status || '');
	let newAssignee = $state(entityType === 'task' ? (entity as Task)?.assignee || '' : '');
	let comment = $state('');
	let isSubmitting = $state(false);
	let error = $state('');

	// Reset form when entity changes
	$effect(() => {
		if (entity) {
			newStatus = entity.status;
			newAssignee = entityType === 'task' ? (entity as Task).assignee || '' : '';
			comment = '';
			error = '';
		}
	});

	// Status options for each entity type
	const statusOptions = {
		requirement: [
			'Draft',
			'Under Review',
			'Approved',
			'Architecture',
			'Ready',
			'Implemented',
			'Validated',
			'Deprecated'
		],
		task: [
			'Not Started',
			'In Progress',
			'Blocked',
			'Complete',
			'Abandoned'
		],
		architecture: [
			'Draft',
			'Under Review',
			'Approved',
			'Implemented',
			'Deprecated'
		]
	};

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (isSubmitting) return;

		// Validate form
		if (!newStatus) {
			error = 'Status is required';
			return;
		}

		if (entityType === 'task' && newAssignee && !isValidEmail(newAssignee)) {
			error = 'Assignee must be a valid email address';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			let response;

			switch (entityType) {
				case 'requirement':
					response = await mcpClient.requirements.updateRequirementStatus(
						entity.id,
						newStatus,
						comment || undefined
					);
					break;
				case 'task':
					response = await mcpClient.tasks.updateTaskStatus(
						entity.id,
						newStatus,
						comment || undefined,
						newAssignee || undefined
					);
					break;
				case 'architecture':
					response = await mcpClient.architecture.updateArchitectureStatus(
						entity.id,
						newStatus,
						comment || undefined
					);
					break;
				default:
					throw new Error(`Unknown entity type: ${entityType}`);
			}

			if (response.success && response.data) {
				dispatch('success', {
					entity: response.data,
					message: `${capitalizeFirst(entityType)} updated successfully`
				});
			} else {
				error = response.error || `Failed to update ${entityType}`;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : `Failed to update ${entityType}`;
		} finally {
			isSubmitting = false;
		}
	}

	function handleClose() {
		if (!isSubmitting) {
			dispatch('close');
		}
	}

	function isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	function capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	// Check if form has changes
	const hasChanges = $derived(() => {
		if (!entity) return false;
		const statusChanged = newStatus !== entity.status;
		const assigneeChanged = entityType === 'task' && newAssignee !== ((entity as Task).assignee || '');
		return statusChanged || assigneeChanged || comment.trim() !== '';
	});
</script>

<Modal
	{isOpen}
	title="Edit {capitalizeFirst(entityType)}"
	size="md"
	closeOnBackdrop={!isSubmitting}
	closeOnEscape={!isSubmitting}
	showCloseButton={!isSubmitting}
	on:close={handleClose}
>
	<form onsubmit={handleSubmit} class="space-y-6">
		<!-- Entity Info -->
		{#if entity}
			<div class="bg-gray-50 rounded-lg p-4">
				<h3 class="font-medium text-gray-900 mb-1">{entity.title}</h3>
				<p class="text-sm text-gray-500">{entity.id}</p>
			</div>
		{/if}

		<!-- Status Field -->
		<div>
			<label for="status" class="block text-sm font-medium text-gray-700 mb-2">
				Status *
			</label>
			<select
				id="status"
				bind:value={newStatus}
				disabled={isSubmitting}
				class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
				required
			>
				{#each statusOptions[entityType] as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>

		<!-- Assignee Field (Tasks only) -->
		{#if entityType === 'task'}
			<div>
				<label for="assignee" class="block text-sm font-medium text-gray-700 mb-2">
					Assignee
				</label>
				<input
					id="assignee"
					type="email"
					bind:value={newAssignee}
					disabled={isSubmitting}
					placeholder="developer@company.com"
					class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
				<p class="text-xs text-gray-500 mt-1">Leave empty to unassign the task</p>
			</div>
		{/if}

		<!-- Comment Field -->
		<div>
			<label for="comment" class="block text-sm font-medium text-gray-700 mb-2">
				Comment
			</label>
			<textarea
				id="comment"
				bind:value={comment}
				disabled={isSubmitting}
				rows="3"
				placeholder="Optional comment explaining the changes..."
				class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
			></textarea>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
				<AlertCircle class="w-5 h-5 flex-shrink-0" />
				<span class="text-sm">{error}</span>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
			<button
				type="button"
				onclick={handleClose}
				disabled={isSubmitting}
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={isSubmitting || !hasChanges}
				class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
			>
				{#if isSubmitting}
					<div class="animate-spin h-4 w-4 border border-white border-t-transparent rounded-full"></div>
					<span>Updating...</span>
				{:else}
					<Save class="w-4 h-4" />
					<span>Save Changes</span>
				{/if}
			</button>
		</div>
	</form>
</Modal>