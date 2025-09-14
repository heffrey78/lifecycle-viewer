<script lang="ts">
	import { featureFlags, toggleFeature, resetAllFlags, emergencyRollback } from '$lib/stores/feature-flags';
	import { currentTheme } from '$lib/theme';
	import type { FeatureFlags } from '$lib/stores/feature-flags';

	export let showAdmin = false;

	let isExpanded = false;

	function handleToggle(feature: keyof FeatureFlags) {
		toggleFeature(feature);
	}

	function handleEmergencyRollback() {
		if (confirm('🚨 Emergency rollback will disable all Svelte-Flow features and reload the page. Continue?')) {
			emergencyRollback();
		}
	}

	// Feature flag metadata for better UX
	const flagMetadata: Record<keyof FeatureFlags, { label: string; description: string; risk: 'low' | 'medium' | 'high' }> = {
		useSvelteFlow: {
			label: 'Use Svelte-Flow',
			description: 'Enable Svelte-Flow visualization system (master toggle)',
			risk: 'high'
		},
		svelteFlowNetworkLayout: {
			label: 'Network Layout',
			description: 'Enable Svelte-Flow for Network layout mode',
			risk: 'medium'
		},
		svelteFlowHierarchyLayout: {
			label: 'Hierarchy Layout',
			description: 'Enable Svelte-Flow for Hierarchy layout mode',
			risk: 'medium'
		},
		svelteFlowTimelineLayout: {
			label: 'Timeline Layout',
			description: 'Enable Svelte-Flow for Timeline layout mode',
			risk: 'medium'
		},
		svelteFlowRoadmapLayout: {
			label: 'Roadmap Layout',
			description: 'Enable Svelte-Flow for Roadmap layout mode',
			risk: 'medium'
		},
		dragToConnectRelationships: {
			label: 'Drag-to-Connect',
			description: 'Enable drag-and-drop relationship creation UX',
			risk: 'low'
		},
		enableVisualizationPerformanceMonitoring: {
			label: 'Performance Monitoring',
			description: 'Enable performance tracking for visualization system',
			risk: 'low'
		}
	};

	function getRiskColor(risk: 'low' | 'medium' | 'high') {
		switch (risk) {
			case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
			case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
		}
	}
</script>

{#if showAdmin}
	<div class="fixed top-4 right-4 z-50 max-w-md">
		<div class="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg">
			<!-- Header -->
			<div class="p-3 border-b border-gray-200 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-gray-900 dark:text-white text-sm">
						🚩 Feature Flags
					</h3>
					<div class="flex items-center gap-2">
						<button
							on:click={() => isExpanded = !isExpanded}
							class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						>
							{isExpanded ? 'Collapse' : 'Expand'}
						</button>
						<button
							on:click={() => showAdmin = false}
							class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							×
						</button>
					</div>
				</div>
			</div>

			{#if isExpanded}
				<!-- Feature toggles -->
				<div class="p-3 space-y-3 max-h-96 overflow-y-auto">
					{#each Object.entries(flagMetadata) as [key, metadata]}
						{@const flagKey = key as keyof FeatureFlags}
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-gray-900 dark:text-white">
										{metadata.label}
									</span>
									<span class="text-xs px-2 py-1 rounded {getRiskColor(metadata.risk)}">
										{metadata.risk}
									</span>
								</div>
								<p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
									{metadata.description}
								</p>
							</div>
							<label class="flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={$featureFlags[flagKey]}
									on:change={() => handleToggle(flagKey)}
									class="sr-only"
								>
								<div class="relative">
									<div class="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full shadow-inner transition-colors duration-200 ease-in-out {$featureFlags[flagKey] ? 'bg-blue-500' : ''}"></div>
									<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-in-out {$featureFlags[flagKey] ? 'translate-x-4' : ''}"></div>
								</div>
							</label>
						</div>
					{/each}
				</div>

				<!-- Actions -->
				<div class="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
					<div class="flex gap-2">
						<button
							on:click={resetAllFlags}
							class="flex-1 text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
						>
							Reset All
						</button>
						<button
							on:click={handleEmergencyRollback}
							class="flex-1 text-xs px-3 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 rounded"
						>
							🚨 Rollback
						</button>
					</div>
					<div class="text-xs text-gray-500 dark:text-gray-400 text-center">
						Flags saved to localStorage
					</div>
				</div>
			{:else}
				<!-- Collapsed view with active flags count -->
				<div class="p-3">
					{#if $featureFlags}
						{@const activeFlags = Object.values($featureFlags).filter(Boolean).length}
						<div class="text-sm text-gray-600 dark:text-gray-400">
							{activeFlags} active flag{activeFlags !== 1 ? 's' : ''}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Keyboard shortcut to show admin -->
