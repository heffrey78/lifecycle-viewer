<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Network, BarChart3, Calendar, Map, ZoomIn, ZoomOut, RotateCcw } from 'lucide-svelte';
	import { currentTheme } from '$lib/theme';

	export let layoutMode: 'network' | 'hierarchy' | 'timeline' | 'roadmap' = 'network';

	const dispatch = createEventDispatcher<{
		layoutChange: 'network' | 'hierarchy' | 'timeline' | 'roadmap';
		zoomIn: void;
		zoomOut: void;
		resetView: void;
	}>();

	const layoutModes = [
		{
			id: 'network' as const,
			label: 'Network',
			icon: Network,
			description: 'Force-directed graph showing all relationships'
		},
		{
			id: 'hierarchy' as const,
			label: 'Hierarchy',
			icon: BarChart3,
			description: 'Tree structure showing requirement → task chains'
		},
		{
			id: 'timeline' as const,
			label: 'Timeline',
			icon: Calendar,
			description: 'Chronological layout based on dates'
		},
		{
			id: 'roadmap' as const,
			label: 'Roadmap',
			icon: Map,
			description: 'Priority-based swimlanes with dependencies'
		}
	];

	function handleLayoutChange(mode: typeof layoutMode) {
		if (mode !== layoutMode) {
			dispatch('layoutChange', mode);
		}
	}

	function handleZoomIn() {
		dispatch('zoomIn');
	}

	function handleZoomOut() {
		dispatch('zoomOut');
	}

	function handleResetView() {
		dispatch('resetView');
	}
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center space-x-1">
		{#each layoutModes as mode}
			<button
				class="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
				class:ring-2={layoutMode === mode.id}
				style="background-color: {layoutMode === mode.id
					? $currentTheme.semantic.primary.background + '40'
					: 'transparent'};
						color: {layoutMode === mode.id
					? $currentTheme.semantic.primary.foreground
					: $currentTheme.base.foreground};
						{layoutMode === mode.id ? `ring-color: ${$currentTheme.semantic.primary.foreground}40;` : ''}"
				title={mode.description}
				on:click={() => handleLayoutChange(mode.id)}
			>
				<svelte:component this={mode.icon} class="w-4 h-4" />
				<span>{mode.label}</span>
			</button>
		{/each}
	</div>

	<div class="flex items-center space-x-1">
		<div class="w-px h-6" style="background-color: {$currentTheme.base.border};"></div>

		<button
			class="p-2 rounded-lg transition-colors hover:bg-opacity-10"
			style="color: {$currentTheme.base.foreground};"
			title="Zoom In"
			on:click={handleZoomIn}
		>
			<ZoomIn class="w-4 h-4" />
		</button>

		<button
			class="p-2 rounded-lg transition-colors hover:bg-opacity-10"
			style="color: {$currentTheme.base.foreground};"
			title="Zoom Out"
			on:click={handleZoomOut}
		>
			<ZoomOut class="w-4 h-4" />
		</button>

		<button
			class="p-2 rounded-lg transition-colors hover:bg-opacity-10"
			style="color: {$currentTheme.base.foreground};"
			title="Reset View"
			on:click={handleResetView}
		>
			<RotateCcw class="w-4 h-4" />
		</button>
	</div>
</div>
