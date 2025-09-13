<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		isOpen?: boolean;
		isSubmitting?: boolean;
	}

	let { isOpen = false, isSubmitting = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		create: any; // Will be TaskFormData when TaskForm is implemented
	}>();

	function handleClose() {
		if (!isSubmitting) {
			dispatch('close');
		}
	}

	function handleCancel() {
		handleClose();
	}
</script>

<Modal
	{isOpen}
	title="Create New Task"
	size="md"
	closeOnBackdrop={!isSubmitting}
	closeOnEscape={!isSubmitting}
	showCloseButton={!isSubmitting}
	on:close={handleClose}
>
	<div class="flex flex-col items-center justify-center p-8 text-center">
		<AlertTriangle class="w-16 h-16 text-yellow-500 mb-4" />
		<h3 class="text-lg font-semibold text-gray-900 mb-2">Task Form Not Yet Implemented</h3>
		<p class="text-gray-600 mb-6">
			The task creation form is coming soon! This feature will be available once TASK-0008-00-00 
			(Implement Task Creation Form) is completed.
		</p>
		<div class="flex gap-3">
			<button
				type="button"
				onclick={handleCancel}
				class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
			>
				Close
			</button>
		</div>
	</div>
</Modal>