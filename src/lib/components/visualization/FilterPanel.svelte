<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Check, X } from 'lucide-svelte';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';
	import { currentTheme } from '$lib/theme';

	export let requirements: Requirement[] = [];
	export let tasks: Task[] = [];
	export let architectureDecisions: ArchitectureDecision[] = [];

	const dispatch = createEventDispatcher<{
		filterChange: {
			search: string;
			statusFilters: Set<string>;
			priorityFilters: Set<string>;
		};
	}>();

	let searchTerm = '';
	let statusFilters = new Set<string>();
	let priorityFilters = new Set<string>();

	// Extract unique values for filter options
	$: allStatuses = [
		...new Set([
			...requirements.map((r) => r.status),
			...tasks.map((t) => t.status),
			...architectureDecisions.map((a) => a.status)
		])
	].sort();

	$: allPriorities = [
		...new Set([...requirements.map((r) => r.priority), ...tasks.map((t) => t.priority)])
	].sort();

	// Emit filter changes
	$: {
		dispatch('filterChange', {
			search: searchTerm,
			statusFilters,
			priorityFilters
		});
	}

	function toggleStatusFilter(status: string) {
		if (statusFilters.has(status)) {
			statusFilters.delete(status);
		} else {
			statusFilters.add(status);
		}
		statusFilters = new Set(statusFilters);
	}

	function togglePriorityFilter(priority: string) {
		if (priorityFilters.has(priority)) {
			priorityFilters.delete(priority);
		} else {
			priorityFilters.add(priority);
		}
		priorityFilters = new Set(priorityFilters);
	}

	function clearAllFilters() {
		searchTerm = '';
		statusFilters.clear();
		priorityFilters.clear();
		statusFilters = new Set(statusFilters);
		priorityFilters = new Set(priorityFilters);
	}

	function getStatusColor(status: string): string {
		// Map statuses to colors based on lifecycle progression
		const statusColorMap: Record<string, string> = {
			Draft: '#ef4444', // red
			'Under Review': '#f59e0b', // amber
			Approved: '#3b82f6', // blue
			Architecture: '#8b5cf6', // violet
			Ready: '#06b6d4', // cyan
			Implemented: '#10b981', // emerald
			Validated: '#22c55e', // green
			Complete: '#22c55e', // green
			Deprecated: '#6b7280', // gray
			'Not Started': '#6b7280', // gray
			'In Progress': '#f59e0b', // amber
			Blocked: '#ef4444', // red
			Abandoned: '#6b7280', // gray
			Proposed: '#8b5cf6', // violet
			Accepted: '#22c55e', // green
			Rejected: '#ef4444', // red
			Superseded: '#6b7280' // gray
		};
		return statusColorMap[status] || '#6b7280';
	}

	function getPriorityColor(priority: string): string {
		const priorityColorMap: Record<string, string> = {
			P0: '#dc2626', // red-600
			P1: '#ea580c', // orange-600
			P2: '#ca8a04', // yellow-600
			P3: '#16a34a' // green-600
		};
		return priorityColorMap[priority] || '#6b7280';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h3 class="font-semibold" style="color: {$currentTheme.base.foreground};">Filters</h3>
		{#if statusFilters.size > 0 || priorityFilters.size > 0}
			<button
				class="text-sm px-2 py-1 rounded-md transition-colors hover:bg-opacity-10"
				style="color: {$currentTheme.base.accent};"
				on:click={clearAllFilters}
			>
				Clear All
			</button>
		{/if}
	</div>

	<!-- Status Filters -->
	<div>
		<h4 class="text-sm font-medium mb-3" style="color: {$currentTheme.base.foreground};">
			Status ({statusFilters.size} selected)
		</h4>
		<div class="space-y-2 max-h-48 overflow-y-auto">
			{#each allStatuses as status}
				<label class="flex items-center space-x-3 cursor-pointer group">
					<div class="relative">
						<input
							type="checkbox"
							class="sr-only"
							checked={statusFilters.has(status)}
							on:change={() => toggleStatusFilter(status)}
						/>
						<div
							class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
							class:opacity-20={!statusFilters.has(status)}
							style="background-color: {statusFilters.has(status)
								? getStatusColor(status)
								: 'transparent'};
									border-color: {getStatusColor(status)};"
						>
							{#if statusFilters.has(status)}
								<Check class="w-3 h-3 text-white" />
							{/if}
						</div>
					</div>
					<span class="text-sm flex-1" style="color: {$currentTheme.base.foreground};">
						{status}
					</span>
					<div
						class="w-3 h-3 rounded-full"
						style="background-color: {getStatusColor(status)};"
					></div>
				</label>
			{/each}
		</div>
	</div>

	<!-- Priority Filters -->
	<div>
		<h4 class="text-sm font-medium mb-3" style="color: {$currentTheme.base.foreground};">
			Priority ({priorityFilters.size} selected)
		</h4>
		<div class="space-y-2">
			{#each allPriorities as priority}
				<label class="flex items-center space-x-3 cursor-pointer group">
					<div class="relative">
						<input
							type="checkbox"
							class="sr-only"
							checked={priorityFilters.has(priority)}
							on:change={() => togglePriorityFilter(priority)}
						/>
						<div
							class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
							class:opacity-20={!priorityFilters.has(priority)}
							style="background-color: {priorityFilters.has(priority)
								? getPriorityColor(priority)
								: 'transparent'};
									border-color: {getPriorityColor(priority)};"
						>
							{#if priorityFilters.has(priority)}
								<Check class="w-3 h-3 text-white" />
							{/if}
						</div>
					</div>
					<span class="text-sm flex-1" style="color: {$currentTheme.base.foreground};">
						{priority}
					</span>
					<div
						class="w-3 h-3 rounded-full"
						style="background-color: {getPriorityColor(priority)};"
					></div>
				</label>
			{/each}
		</div>
	</div>

	<!-- Filter Summary -->
	{#if statusFilters.size > 0 || priorityFilters.size > 0}
		<div class="pt-4 border-t" style="border-color: {$currentTheme.base.border};">
			<h4 class="text-sm font-medium mb-2" style="color: {$currentTheme.base.foreground};">
				Active Filters
			</h4>
			<div class="space-y-1">
				{#each [...statusFilters] as status}
					<div class="flex items-center justify-between text-xs">
						<span style="color: {$currentTheme.base.muted};">Status: {status}</span>
						<button
							class="p-1 rounded hover:bg-opacity-10"
							style="color: {$currentTheme.base.muted};"
							on:click={() => toggleStatusFilter(status)}
						>
							<X class="w-3 h-3" />
						</button>
					</div>
				{/each}
				{#each [...priorityFilters] as priority}
					<div class="flex items-center justify-between text-xs">
						<span style="color: {$currentTheme.base.muted};">Priority: {priority}</span>
						<button
							class="p-1 rounded hover:bg-opacity-10"
							style="color: {$currentTheme.base.muted};"
							on:click={() => togglePriorityFilter(priority)}
						>
							<X class="w-3 h-3" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
