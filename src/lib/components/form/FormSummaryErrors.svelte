<script lang="ts">
	import { AlertCircle, X } from 'lucide-svelte';
	import type { ValidationResult } from '$lib/validation/schemas.js';

	export let validation: ValidationResult | null = null;
	export let title: string = 'Please fix the following errors:';
	export let showWarnings: boolean = false;
	export let dismissible: boolean = false;

	let dismissed = false;

	$: hasErrors = validation?.errors && Object.keys(validation.errors).length > 0;
	$: hasWarnings = validation?.warnings && Object.keys(validation.warnings).length > 0;
	$: shouldShow = !dismissed && (hasErrors || (showWarnings && hasWarnings));

	function formatFieldName(fieldName: string): string {
		return fieldName
			.split(/[_-]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	function handleDismiss() {
		dismissed = true;
	}

	function focusField(fieldId: string, event?: KeyboardEvent) {
		// Handle keyboard navigation
		if (event && event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event?.preventDefault();

		const element = document.getElementById(fieldId);
		if (element) {
			element.focus();
			element.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});

			// Announce focus change to screen readers
			const announcement = document.createElement('div');
			announcement.setAttribute('aria-live', 'polite');
			announcement.className = 'sr-only';
			announcement.textContent = `Focused on ${formatFieldName(fieldId)} field with error`;
			document.body.appendChild(announcement);

			setTimeout(() => {
				if (document.body.contains(announcement)) {
					document.body.removeChild(announcement);
				}
			}, 1000);
		}
	}
</script>

{#if shouldShow}
	<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" role="alert" aria-live="polite">
		<div class="flex items-start">
			<div class="flex-shrink-0">
				<AlertCircle class="w-5 h-5 text-red-500" />
			</div>

			<div class="ml-3 flex-1">
				<h3 class="text-sm font-medium text-red-800">
					{title}
				</h3>

				{#if hasErrors}
					<div class="mt-2 text-sm text-red-700">
						<ul class="space-y-1">
							{#each Object.entries(validation?.errors || {}) as [fieldName, fieldErrors]}
								<li class="flex flex-col">
									<span class="font-medium">{formatFieldName(fieldName)}:</span>
									<ul class="ml-4 space-y-0.5">
										{#each fieldErrors as error}
											<li>
												<button
													type="button"
													class="text-left underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
													on:click={() => focusField(fieldName)}
													on:keydown={(e) => focusField(fieldName, e)}
													aria-describedby="{fieldName}-error-description"
												>
													{error}
												</button>
											</li>
										{/each}
									</ul>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if showWarnings && hasWarnings}
					<div class="mt-3 pt-3 border-t border-red-200">
						<h4 class="text-sm font-medium text-yellow-800 mb-1">Warnings:</h4>
						<div class="text-sm text-yellow-700">
							<ul class="space-y-1">
								{#each Object.entries(validation?.warnings || {}) as [fieldName, fieldWarnings]}
									<li class="flex flex-col">
										<span class="font-medium">{formatFieldName(fieldName)}:</span>
										<ul class="ml-4 space-y-0.5">
											{#each fieldWarnings as warning}
												<li>{warning}</li>
											{/each}
										</ul>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}
			</div>

			{#if dismissible}
				<div class="ml-auto pl-3">
					<div class="-mx-1.5 -my-1.5">
						<button
							type="button"
							class="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
							on:click={handleDismiss}
							aria-label="Dismiss error summary"
						>
							<X class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Screen reader only utility class */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	:global(.theme-dark) .bg-red-50 {
		background-color: #7f1d1d;
	}

	:global(.theme-dark) .border-red-200 {
		border-color: #b91c1c;
	}

	:global(.theme-dark) .text-red-800 {
		color: #fca5a5;
	}

	:global(.theme-dark) .text-red-700 {
		color: #f87171;
	}

	:global(.theme-dark) .text-red-500 {
		color: #f87171;
	}

	:global(.theme-dark) .text-yellow-800 {
		color: #fcd34d;
	}

	:global(.theme-dark) .text-yellow-700 {
		color: #fbbf24;
	}

	:global(.theme-dark) .hover:bg-red-100 {
		background-color: #991b1b;
	}

	:global(.theme-high-contrast) .bg-red-50 {
		background-color: #fee2e2;
		border-width: 2px;
	}

	:global(.theme-high-contrast) .text-red-800,
	:global(.theme-high-contrast) .text-red-700 {
		color: #7f1d1d;
		font-weight: 600;
	}
</style>
