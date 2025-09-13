<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import RequirementForm from './RequirementForm.svelte';
	import type { RequirementFormData } from '$lib/types/lifecycle';

	interface Props {
		isOpen?: boolean;
		isSubmitting?: boolean;
	}

	let { isOpen = false, isSubmitting = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		create: RequirementFormData;
		success: { requirement: any; message: string };
	}>();

	function handleClose() {
		if (!isSubmitting) {
			dispatch('close');
		}
	}

	function handleSubmit(event: CustomEvent<RequirementFormData>) {
		dispatch('create', event.detail);
	}

	function handleCancel() {
		handleClose();
	}

	function handleSuccess(event: CustomEvent<{ requirement: any; message: string }>) {
		dispatch('success', event.detail);
		handleClose();
	}
</script>

<Modal
	{isOpen}
	title="Create New Requirement"
	size="lg"
	closeOnBackdrop={!isSubmitting}
	closeOnEscape={!isSubmitting}
	showCloseButton={!isSubmitting}
	on:close={handleClose}
>
	<RequirementForm {isSubmitting} enableMcpIntegration={true} on:submit={handleSubmit} on:cancel={handleCancel} on:success={handleSuccess} />
</Modal>
