<script lang="ts">
	import { AlertCircle, AlertTriangle } from 'lucide-svelte';
	import { currentTheme } from '$lib/theme';

	export let errors: string[] = [];
	export let warnings: string[] = [];
	export let fieldId: string = '';
	export let compact: boolean = false;

	$: hasErrors = errors.length > 0;
	$: hasWarnings = warnings.length > 0;
	$: hasMessages = hasErrors || hasWarnings;
</script>

{#if hasMessages}
	<div class="mt-1 space-y-1" role="alert" aria-live="polite" aria-describedby={fieldId}>
		{#if hasErrors}
			{#each errors as error}
				<div class="flex items-start gap-2 text-sm text-red-600" class:text-xs={compact}>
					<AlertCircle class="w-4 h-4 mt-0.5 flex-shrink-0" />
					<span>{error}</span>
				</div>
			{/each}
		{/if}

		{#if hasWarnings}
			{#each warnings as warning}
				<div class="flex items-start gap-2 text-sm text-yellow-600" class:text-xs={compact}>
					<AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" />
					<span>{warning}</span>
				</div>
			{/each}
		{/if}
	</div>
{/if}

<style>
	:global(.theme-dark) .text-red-600 {
		color: #f87171;
	}

	:global(.theme-dark) .text-yellow-600 {
		color: #fbbf24;
	}

	:global(.theme-high-contrast) .text-red-600 {
		color: #dc2626;
		font-weight: 600;
	}

	:global(.theme-high-contrast) .text-yellow-600 {
		color: #d97706;
		font-weight: 600;
	}
</style>
