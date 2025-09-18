<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import ADRForm from './ADRForm.svelte';
	import type { ADRFormData, ArchitectureDecision } from '$lib/types/lifecycle';

	interface Props {
		isOpen?: boolean;
		isSubmitting?: boolean;
		initialData?: Partial<ADRFormData>;
	}

	let { isOpen = false, isSubmitting = false, initialData = {} }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		create: ADRFormData;
		success: { adr: ArchitectureDecision; message: string };
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

	function handleSubmit(event: CustomEvent<ADRFormData>) {
		dispatch('create', event.detail);
	}

	function handleSuccess(event: CustomEvent<{ adr: ArchitectureDecision; message: string }>) {
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
	title="Create New ADR"
	size="xl"
	closeOnBackdrop={!isSubmitting}
	closeOnEscape={!isSubmitting}
	showCloseButton={!isSubmitting}
	on:close={handleClose}
>
	<div class="p-6">
		<ADRForm
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
