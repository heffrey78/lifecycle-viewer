<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
	import { X } from 'lucide-svelte';
	import { currentTheme } from '$lib/theme';

	export let isOpen = false;
	export let title = '';
	export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
	export let closeOnBackdrop = true;
	export let closeOnEscape = true;
	export let showCloseButton = true;

	const dispatch = createEventDispatcher<{
		close: void;
		open: void;
	}>();

	let modalElement: HTMLDivElement;
	let previousActiveElement: HTMLElement | null = null;

	// Size classes mapping
	const sizeClasses = {
		sm: 'max-w-md',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		full: 'max-w-full mx-4'
	};

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (closeOnEscape && event.key === 'Escape' && isOpen) {
			closeModal();
		}

		// Trap focus within modal when open
		if (isOpen && event.key === 'Tab') {
			trapFocus(event);
		}
	}

	// Focus trapping within modal
	function trapFocus(event: KeyboardEvent) {
		if (!modalElement) return;

		const focusableElements = modalElement.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		
		const firstFocusable = focusableElements[0] as HTMLElement;
		const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

		if (event.shiftKey) {
			if (document.activeElement === firstFocusable) {
				lastFocusable?.focus();
				event.preventDefault();
			}
		} else {
			if (document.activeElement === lastFocusable) {
				firstFocusable?.focus();
				event.preventDefault();
			}
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent) {
		if (closeOnBackdrop && event.target === event.currentTarget) {
			closeModal();
		}
	}

	// Close modal function
	function closeModal() {
		isOpen = false;
		dispatch('close');
	}

	// Focus management
	async function manageFocus() {
		if (isOpen) {
			// Store current focus
			previousActiveElement = document.activeElement as HTMLElement;
			
			// Focus first focusable element in modal after DOM updates
			await tick();
			const firstFocusable = modalElement?.querySelector(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			) as HTMLElement;
			firstFocusable?.focus();
			
			dispatch('open');
		} else {
			// Restore previous focus
			previousActiveElement?.focus();
		}
	}

	// Reactive statement to manage focus when isOpen changes
	$: if (typeof isOpen !== 'undefined') {
		manageFocus();
	}

	// Body scroll lock
	$: if (typeof window !== 'undefined') {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = '';
		}
	});
</script>

<!-- Modal Overlay -->
{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'modal-title' : undefined}
		tabindex="-1"
	>
		<!-- Backdrop -->
		<div 
			class="absolute inset-0 transition-opacity duration-300"
			style="background-color: rgba(0, 0, 0, 0.5);"
		></div>

		<!-- Modal Content -->
		<div
			bind:this={modalElement}
			class="relative w-full {sizeClasses[size]} transform transition-all duration-300 scale-100 opacity-100"
			style="background-color: {$currentTheme.semantic.card.background}; 
				   color: {$currentTheme.semantic.card.text};
				   border-color: {$currentTheme.semantic.card.border};"
		>
			<!-- Modal Container -->
			<div class="rounded-lg shadow-xl border overflow-hidden">
				<!-- Header -->
				{#if title || showCloseButton}
					<div 
						class="flex items-center justify-between p-6 border-b"
						style="border-color: {$currentTheme.base.border};"
					>
						{#if title}
							<h2 
								id="modal-title" 
								class="text-xl font-semibold"
								style="color: {$currentTheme.base.foreground};"
							>
								{title}
							</h2>
						{/if}
						
						{#if showCloseButton}
							<button
								type="button"
								on:click={closeModal}
								class="p-1 rounded-lg transition-colors hover:bg-opacity-10"
								style="color: {$currentTheme.base.muted};"
								aria-label="Close modal"
							>
								<X class="w-5 h-5" />
							</button>
						{/if}
					</div>
				{/if}

				<!-- Content -->
				<div class="p-6">
					<slot />
				</div>

				<!-- Footer Slot -->
				{#if $$slots.footer}
					<div 
						class="px-6 py-4 border-t flex justify-end space-x-3"
						style="background-color: {$currentTheme.base.background}; 
							   border-color: {$currentTheme.base.border};"
					>
						<slot name="footer" />
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Smooth transitions for modal entrance/exit */
	@keyframes modal-enter {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes modal-exit {
		from {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
		to {
			opacity: 0;
			transform: scale(0.95) translateY(-10px);
		}
	}

	/* Apply animations when modal is shown */
	.modal-container {
		animation: modal-enter 0.3s ease-out;
	}
</style>