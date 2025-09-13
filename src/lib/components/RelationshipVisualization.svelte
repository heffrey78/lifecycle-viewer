<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, Filter, Network, BarChart3, Calendar, Map } from 'lucide-svelte';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';
	import { currentTheme } from '$lib/theme';
	import FilterPanel from './visualization/FilterPanel.svelte';
	import LayoutControls from './visualization/LayoutControls.svelte';
	import DiagramRenderer from './visualization/DiagramRenderer.svelte';

	export let requirements: Requirement[] = [];
	export let tasks: Task[] = [];
	export let architectureDecisions: ArchitectureDecision[] = [];

	type LayoutMode = 'network' | 'hierarchy' | 'timeline' | 'roadmap';
	type EntityType = 'requirements' | 'tasks' | 'architecture';

	let layoutMode: LayoutMode = 'network';
	let visibleEntityTypes: Set<EntityType> = new Set(['requirements', 'tasks', 'architecture']);
	let searchTerm = '';
	let statusFilters: Set<string> = new Set();
	let priorityFilters: Set<string> = new Set();
	let showFilterPanel = false;

	// Filtered and processed data for visualization
	let filteredData: {
		requirements: Requirement[];
		tasks: Task[];
		architectureDecisions: ArchitectureDecision[];
	} = {
		requirements: [],
		tasks: [],
		architectureDecisions: []
	};

	let isLoading = true;

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		try {
			isLoading = true;
			// Load data from MCP client
			// This will be implemented to fetch actual data
			console.log('Loading relationship data...');
		} catch (error) {
			console.error('Failed to load relationship data:', error);
		} finally {
			isLoading = false;
		}
	}

	// Filter data based on current filters
	$: {
		filteredData = {
			requirements: filterRequirements(requirements),
			tasks: filterTasks(tasks),
			architectureDecisions: filterArchitectureDecisions(architectureDecisions)
		};
	}

	function filterRequirements(reqs: Requirement[]): Requirement[] {
		if (!visibleEntityTypes.has('requirements')) return [];

		return reqs.filter(req => {
			// Search filter
			if (searchTerm && !req.title.toLowerCase().includes(searchTerm.toLowerCase())) {
				return false;
			}

			// Status filter
			if (statusFilters.size > 0 && !statusFilters.has(req.status)) {
				return false;
			}

			// Priority filter
			if (priorityFilters.size > 0 && !priorityFilters.has(req.priority)) {
				return false;
			}

			return true;
		});
	}

	function filterTasks(taskList: Task[]): Task[] {
		if (!visibleEntityTypes.has('tasks')) return [];

		return taskList.filter(task => {
			// Search filter
			if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
				return false;
			}

			// Status filter
			if (statusFilters.size > 0 && !statusFilters.has(task.status)) {
				return false;
			}

			// Priority filter
			if (priorityFilters.size > 0 && !priorityFilters.has(task.priority)) {
				return false;
			}

			return true;
		});
	}

	function filterArchitectureDecisions(decisions: ArchitectureDecision[]): ArchitectureDecision[] {
		if (!visibleEntityTypes.has('architecture')) return [];

		return decisions.filter(decision => {
			// Search filter
			if (searchTerm && !decision.title.toLowerCase().includes(searchTerm.toLowerCase())) {
				return false;
			}

			// Status filter
			if (statusFilters.size > 0 && !statusFilters.has(decision.status)) {
				return false;
			}

			return true;
		});
	}

	function handleLayoutChange(newMode: LayoutMode) {
		layoutMode = newMode;
	}

	function handleEntityTypeToggle(entityType: EntityType, visible: boolean) {
		if (visible) {
			visibleEntityTypes.add(entityType);
		} else {
			visibleEntityTypes.delete(entityType);
		}
		visibleEntityTypes = new Set(visibleEntityTypes);
	}

	function handleFilterChange(filters: {
		search: string;
		statusFilters: Set<string>;
		priorityFilters: Set<string>;
	}) {
		searchTerm = filters.search;
		statusFilters = filters.statusFilters;
		priorityFilters = filters.priorityFilters;
	}
</script>

<div class="flex flex-col h-full min-h-screen">
	<!-- Header Controls -->
	<div
		class="flex items-center justify-between p-4 border-b"
		style="border-color: {$currentTheme.base.border};"
	>
		<div class="flex items-center space-x-4">
			<h1 class="text-2xl font-semibold" style="color: {$currentTheme.base.foreground};">
				Relationship Visualization
			</h1>

			<!-- Entity Type Toggle Buttons -->
			<div class="flex items-center space-x-2">
				<button
					class="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
					class:opacity-50={!visibleEntityTypes.has('requirements')}
					style="background-color: {visibleEntityTypes.has('requirements') ? $currentTheme.semantic.primary.background + '40' : 'transparent'};
							color: {visibleEntityTypes.has('requirements') ? $currentTheme.semantic.primary.foreground : $currentTheme.base.muted};"
					on:click={() => handleEntityTypeToggle('requirements', !visibleEntityTypes.has('requirements'))}
				>
					<div class="w-3 h-3 rounded bg-blue-500"></div>
					<span>Requirements</span>
				</button>

				<button
					class="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
					class:opacity-50={!visibleEntityTypes.has('tasks')}
					style="background-color: {visibleEntityTypes.has('tasks') ? $currentTheme.semantic.primary.background + '40' : 'transparent'};
							color: {visibleEntityTypes.has('tasks') ? $currentTheme.semantic.primary.foreground : $currentTheme.base.muted};"
					on:click={() => handleEntityTypeToggle('tasks', !visibleEntityTypes.has('tasks'))}
				>
					<div class="w-3 h-3 rounded bg-green-500"></div>
					<span>Tasks</span>
				</button>

				<button
					class="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
					class:opacity-50={!visibleEntityTypes.has('architecture')}
					style="background-color: {visibleEntityTypes.has('architecture') ? $currentTheme.semantic.primary.background + '40' : 'transparent'};
							color: {visibleEntityTypes.has('architecture') ? $currentTheme.semantic.primary.foreground : $currentTheme.base.muted};"
					on:click={() => handleEntityTypeToggle('architecture', !visibleEntityTypes.has('architecture'))}
				>
					<div class="w-3 h-3 rounded bg-purple-500"></div>
					<span>Architecture</span>
				</button>
			</div>
		</div>

		<div class="flex items-center space-x-2">
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
				<input
					type="text"
					placeholder="Search entities..."
					class="pl-10 pr-4 py-2 rounded-lg border text-sm"
					style="background-color: {$currentTheme.base.background};
							border-color: {$currentTheme.base.border};
							color: {$currentTheme.base.foreground};"
					bind:value={searchTerm}
				/>
			</div>

			<!-- Filter Toggle -->
			<button
				class="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
				class:bg-opacity-20={showFilterPanel}
				style="background-color: {showFilterPanel ? $currentTheme.semantic.primary.background : 'transparent'};
						border-color: {$currentTheme.base.border};
						color: {$currentTheme.base.foreground};"
				on:click={() => (showFilterPanel = !showFilterPanel)}
			>
				<Filter class="w-4 h-4" />
				<span>Filters</span>
			</button>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<!-- Filter Panel -->
		{#if showFilterPanel}
			<div
				class="w-80 border-r p-4 overflow-y-auto"
				style="border-color: {$currentTheme.base.border};"
			>
				<FilterPanel
					{requirements}
					{tasks}
					{architectureDecisions}
					on:filterChange={(e) => handleFilterChange(e.detail)}
				/>
			</div>
		{/if}

		<!-- Main Visualization Area -->
		<div class="flex-1 flex flex-col">
			<!-- Layout Controls -->
			<div
				class="flex items-center justify-between p-3 border-b"
				style="border-color: {$currentTheme.base.border};"
			>
				<LayoutControls
					{layoutMode}
					on:layoutChange={(e) => handleLayoutChange(e.detail)}
				/>

				<div class="text-sm" style="color: {$currentTheme.base.muted};">
					{filteredData.requirements.length} Requirements •
					{filteredData.tasks.length} Tasks •
					{filteredData.architectureDecisions.length} Architecture Decisions
				</div>
			</div>

			<!-- Diagram Container -->
			<div class="flex-1 overflow-hidden relative">
				{#if isLoading}
					<div class="flex items-center justify-center h-full">
						<div class="text-center">
							<div class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
								 style="border-color: {$currentTheme.base.accent};"></div>
							<p style="color: {$currentTheme.base.muted};">Loading relationship data...</p>
						</div>
					</div>
				{:else}
					<DiagramRenderer
						data={filteredData}
						{layoutMode}
						{visibleEntityTypes}
					/>
				{/if}
			</div>
		</div>
	</div>
</div>