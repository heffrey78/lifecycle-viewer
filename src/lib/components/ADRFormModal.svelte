<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { AlertTriangle, X } from 'lucide-svelte';

	let {
		isOpen = $bindable(false),
		isSubmitting = false
	}: {
		isOpen: boolean;
		isSubmitting?: boolean;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		create: any;
	}>();

	function closeModal(): void {
		isOpen = false;
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Modal backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="0"
	>
		<!-- Modal content -->
		<div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
			<!-- Modal header -->
			<div class="flex items-center justify-between p-6 border-b flex-shrink-0">
				<h2 id="modal-title" class="text-xl font-semibold text-gray-900">
					New Architecture Decision Record
				</h2>
				<button
					onclick={closeModal}
					class="text-gray-400 hover:text-gray-600 transition-colors p-1"
					aria-label="Close modal"
				>
					<X size={24} />
				</button>
			</div>

			<!-- Modal body -->
			<div class="p-6 overflow-y-auto flex-1">
				<!-- Placeholder content -->
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<AlertTriangle class="w-16 h-16 text-yellow-500 mb-4" />
					<h3 class="text-lg font-semibold text-gray-900 mb-2">ADR Form Not Yet Implemented</h3>
					<p class="text-gray-600 mb-6">
						The architecture decision record creation form is coming soon! This feature will be available once TASK-0009-00-00 
						(Implement ADR Creation Form) is completed.
					</p>
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
						<p class="text-sm text-blue-800">
							<strong>Coming Soon:</strong> Full ADR creation with context, decision drivers, 
							considered options, and consequences tracking.
						</p>
					</div>
				</div>
			</div>

			<!-- Modal footer -->
			<div class="flex justify-end gap-3 p-6 border-t bg-gray-50 flex-shrink-0">
				<button
					onclick={closeModal}
					class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
					disabled={isSubmitting}
				>
					Close
				</button>
				<button
					disabled
					class="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
					title="Available when ADR form is implemented"
				>
					Create ADR
				</button>
			</div>
		</div>
	</div>
{/if}