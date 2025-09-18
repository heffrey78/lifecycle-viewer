<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import { AlertTriangle, X, Trash2, Info } from 'lucide-svelte';

	interface Props {
		isOpen?: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'danger' | 'warning' | 'info';
		isProcessing?: boolean;
	}

	let {
		isOpen = false,
		title = 'Confirm Action',
		message = 'Are you sure you want to proceed?',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'danger',
		isProcessing = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
		close: void;
	}>();

	function handleConfirm() {
		dispatch('confirm');
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleClose() {
		if (!isProcessing) {
			dispatch('close');
		}
	}

	// Get icon and colors based on variant
	const variantConfig = {
		danger: {
			icon: AlertTriangle,
			iconColor: 'text-red-600',
			iconBg: 'bg-red-100',
			confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
		},
		warning: {
			icon: AlertTriangle,
			iconColor: 'text-yellow-600',
			iconBg: 'bg-yellow-100',
			confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
		},
		info: {
			icon: Info,
			iconColor: 'text-blue-600',
			iconBg: 'bg-blue-100',
			confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
		}
	};

	const config = variantConfig[variant];
	const IconComponent = config.icon;
</script>

<Modal
	{isOpen}
	{title}
	size="sm"
	closeOnBackdrop={!isProcessing}
	closeOnEscape={!isProcessing}
	showCloseButton={!isProcessing}
	on:close={handleClose}
>
	<div class="text-center">
		<!-- Icon -->
		<div class={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${config.iconBg} mb-4`}>
			<IconComponent class={`h-6 w-6 ${config.iconColor}`} />
		</div>

		<!-- Message -->
		<div class="mb-6">
			<p class="text-gray-900 mb-2">{message}</p>
		</div>

		<!-- Actions -->
		<div class="flex justify-center space-x-3">
			<button
				type="button"
				onclick={handleCancel}
				disabled={isProcessing}
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{cancelText}
			</button>
			<button
				type="button"
				onclick={handleConfirm}
				disabled={isProcessing}
				class={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${config.confirmButton}`}
			>
				{#if isProcessing}
					<div class="animate-spin h-4 w-4 border border-white border-t-transparent rounded-full"></div>
					<span>Processing...</span>
				{:else if variant === 'danger'}
					<Trash2 class="w-4 h-4" />
					<span>{confirmText}</span>
				{:else}
					<span>{confirmText}</span>
				{/if}
			</button>
		</div>
	</div>
</Modal>