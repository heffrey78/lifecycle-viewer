<script lang="ts" context="module">
	export type SortDirection = 'asc' | 'desc' | null;
	export type SortableData = Record<string, unknown>;
	
	export interface SortableTableColumn<T = SortableData> {
		key: string;
		label: string;
		sortable?: boolean;
		type?: 'string' | 'number' | 'date' | 'enum';
		defaultSort?: SortDirection;
		render?: (value: unknown, row: T) => string;
	}
</script>

<script lang="ts">
	import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-svelte';
	
	export let data: SortableData[] = [];
	export let columns: SortableTableColumn[] = [];
	
	let sortKey: string | null = null;
	let sortDirection: SortDirection = null;
	let sortedData: SortableData[] = [];
	
	// Initialize with default sort if specified
	$: {
		const defaultSortCol = columns.find(col => col.defaultSort);
		if (defaultSortCol && !sortKey) {
			sortKey = defaultSortCol.key;
			sortDirection = defaultSortCol.defaultSort!;
		}
		updateSortedData();
	}
	
	function updateSortedData() {
		if (!sortKey || !sortDirection) {
			sortedData = [...data];
			return;
		}
		
		const column = columns.find(col => col.key === sortKey);
		const type = column?.type || 'string';
		
		sortedData = [...data].sort((a, b) => {
			const aValue = getNestedValue(a, sortKey!);
			const bValue = getNestedValue(b, sortKey!);
			
			let comparison = 0;
			
			// Handle null/undefined values
			if (aValue == null && bValue == null) return 0;
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			
			switch (type) {
				case 'number':
					comparison = Number(aValue) - Number(bValue);
					break;
				case 'date':
					const dateA = typeof aValue === 'string' || typeof aValue === 'number' ? new Date(aValue) : new Date();
					const dateB = typeof bValue === 'string' || typeof bValue === 'number' ? new Date(bValue) : new Date();
					comparison = dateA.getTime() - dateB.getTime();
					break;
				case 'enum':
					// For enums like priority (P0, P1, P2, P3), we want P0 to be highest
					if (sortKey === 'priority') {
						const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
						comparison = (priorityOrder[aValue as keyof typeof priorityOrder] || 99) - 
						           (priorityOrder[bValue as keyof typeof priorityOrder] || 99);
					} else {
						comparison = String(aValue).localeCompare(String(bValue));
					}
					break;
				default: // string
					comparison = String(aValue).localeCompare(String(bValue));
			}
			
			return sortDirection === 'desc' ? -comparison : comparison;
		});
	}
	
	function getNestedValue(obj: unknown, path: string): unknown {
		if (typeof obj !== 'object' || obj === null) return undefined;
		return path.split('.').reduce((current: any, key) => current?.[key], obj);
	}
	
	function handleSort(columnKey: string) {
		const column = columns.find(col => col.key === columnKey);
		if (!column || column.sortable === false) return;
		
		if (sortKey === columnKey) {
			// Cycle through: asc -> desc -> null -> asc...
			if (sortDirection === 'asc') {
				sortDirection = 'desc';
			} else if (sortDirection === 'desc') {
				sortDirection = null;
				sortKey = null;
			}
		} else {
			sortKey = columnKey;
			sortDirection = 'asc';
		}
		
		updateSortedData();
	}
	
	function getSortIcon(columnKey: string) {
		if (sortKey !== columnKey) return ChevronsUpDown;
		if (sortDirection === 'asc') return ChevronUp;
		if (sortDirection === 'desc') return ChevronDown;
		return ChevronsUpDown;
	}
	
	function getSortIconClass(columnKey: string) {
		if (sortKey === columnKey && sortDirection) {
			return 'text-blue-600';
		}
		return 'text-gray-400';
	}

	function getAriaSort(columnKey: string): 'ascending' | 'descending' | 'none' {
		if (sortKey !== columnKey) return 'none';
		if (sortDirection === 'asc') return 'ascending';
		if (sortDirection === 'desc') return 'descending';
		return 'none';
	}

	function getSortDescription(columnKey: string): string {
		const column = columns.find(col => col.key === columnKey);
		if (!column || column.sortable === false) return '';
		
		if (sortKey !== columnKey) return 'Click to sort ascending';
		if (sortDirection === 'asc') return 'Click to sort descending';
		if (sortDirection === 'desc') return 'Click to clear sort';
		return 'Click to sort ascending';
	}
</script>

<div class="bg-white rounded-lg shadow overflow-hidden">
	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					{#each columns as column}
						<th 
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							class:cursor-pointer={column.sortable !== false}
							class:hover:bg-gray-100={column.sortable !== false}
							class:select-none={column.sortable !== false}
							role="columnheader"
							aria-sort={column.sortable !== false ? getAriaSort(column.key) : undefined}
							aria-label="{column.label}{column.sortable !== false ? ' - ' + getSortDescription(column.key) : ''}"
							tabindex={column.sortable !== false ? 0 : -1}
							on:click={() => handleSort(column.key)}
							on:keydown={(e) => e.key === 'Enter' && handleSort(column.key)}
						>
							<div class="flex items-center space-x-1">
								<span>{column.label}</span>
								{#if column.sortable !== false}
									<svelte:component 
										this={getSortIcon(column.key)} 
										class="w-4 h-4 {getSortIconClass(column.key)}"
									/>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="bg-white divide-y divide-gray-200">
				{#each sortedData as row}
					<tr class="hover:bg-gray-50">
						{#each columns as column}
							<td class="px-6 py-4">
								<slot name="cell" {row} {column}>
									{#if column.render}
										{column.render(getNestedValue(row, column.key), row)}
									{:else}
										{getNestedValue(row, column.key) || '—'}
									{/if}
								</slot>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>