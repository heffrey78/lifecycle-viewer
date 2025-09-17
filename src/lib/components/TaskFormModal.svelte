<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import TaskForm from './TaskForm.svelte';
	import type { TaskFormData, Task } from '$lib/types/lifecycle';

	interface Props {
		isOpen?: boolean;
		isSubmitting?: boolean;
		initialData?: Partial<TaskFormData>;
	}

	let { isOpen = false, isSubmitting = false, initialData = {} }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		create: TaskFormData;
		success: { task: Task; message: string };
		error: { error: string; isRetryable: boolean };
	}>();

	function handleClose() {
		if (!isSubmitting) {
			dispatch('close');
		}
	}

	function handleCancel() {
		handleClose();
	}

	function handleSubmit(event: CustomEvent<TaskFormData>) {
		dispatch('create', event.detail);
	}

	function handleSuccess(event: CustomEvent<{ task: Task; message: string }>) {
		dispatch('success', event.detail);
		// Close modal after successful creation
		setTimeout(() => handleClose(), 1500);
	}

	function handleError(event: CustomEvent<{ error: string; isRetryable: boolean }>) {
		dispatch('error', event.detail);
	}
</script>

<Modal
	{isOpen}
	title="Create New Task"
	size="lg"
	closeOnBackdrop={!isSubmitting}
	closeOnEscape={!isSubmitting}
	showCloseButton={!isSubmitting}
	on:close={handleClose}
>
	<div class="p-6">
		<TaskForm
			{initialData}
			enableMcpIntegration={true}
			{isSubmitting}
			on:submit={handleSubmit}
			on:cancel={handleCancel}
			on:success={handleSuccess}
			on:error={handleError}
		/>
	</div>
</Modal>
