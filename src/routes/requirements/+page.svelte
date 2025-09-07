<script lang="ts">
	import { onMount } from 'svelte';
	import { mcpClient } from '$lib/services/mcp-client.js';
	import type {
		Requirement,
		RequirementFilters,
		RequirementStatus,
		RequirementType,
		Priority
	} from '$lib/types/lifecycle.js';
	import { Search, Filter, Plus, Eye, Edit, Trash2, AlertTriangle } from 'lucide-svelte';
	import ErrorNotification from '$lib/components/ErrorNotification.svelte';
	import SortableTable from '$lib/components/SortableTable.svelte';

	let requirements: Requirement[] = [];
	let filteredRequirements: Requirement[] = [];
	let loading = true;
	let error = '';

	// Filters
	let searchText = '';
	let statusFilter: RequirementStatus | '' = '';
	let typeFilter: RequirementType | '' = '';
	let priorityFilter: Priority | '' = '';

	onMount(async () => {
		try {
			// Connect to MCP server if not already connected
			if (!mcpClient.isConnected()) {
				await mcpClient.connect();
			}

			const response = await mcpClient.getRequirementsJson();
			if (response.success) {
				requirements = response.data!;
			} else {
				throw new Error(response.error || 'Failed to fetch requirements');
			}

			filteredRequirements = requirements;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			requirements = [];
			filteredRequirements = [];
		} finally {
			loading = false;
		}
	});

	// Filter requirements based on current filters
	$: {
		filteredRequirements = requirements.filter((req) => {
			const matchesSearch =
				!searchText ||
				req.title.toLowerCase().includes(searchText.toLowerCase()) ||
				req.desired_state?.toLowerCase().includes(searchText.toLowerCase()) ||
				req.id.toLowerCase().includes(searchText.toLowerCase());

			const matchesStatus = !statusFilter || req.status === statusFilter;
			const matchesType = !typeFilter || req.type === typeFilter;
			const matchesPriority = !priorityFilter || req.priority === priorityFilter;

			return matchesSearch && matchesStatus && matchesType && matchesPriority;
		});
	}

	function getStatusColor(status: RequirementStatus): string {
		const colors: Record<RequirementStatus, string> = {
			Draft: 'bg-red-100 text-red-800 border-red-200',
			'Under Review': 'bg-orange-100 text-orange-800 border-orange-200',
			Approved: 'bg-blue-100 text-blue-800 border-blue-200',
			Architecture: 'bg-purple-100 text-purple-800 border-purple-200',
			Ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
			Implemented: 'bg-emerald-200 text-emerald-900 border-emerald-300',
			Validated: 'bg-emerald-300 text-emerald-900 border-emerald-400',
			Deprecated: 'bg-gray-100 text-gray-800 border-gray-200'
		};
		return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
	}

	function getPriorityColor(priority: Priority): string {
		const colors: Record<Priority, string> = {
			P0: 'bg-red-100 text-red-800 border-red-200',
			P1: 'bg-orange-100 text-orange-800 border-orange-200',
			P2: 'bg-blue-100 text-blue-800 border-blue-200',
			P3: 'bg-gray-100 text-gray-800 border-gray-200'
		};
		return colors[priority];
	}

	function getRiskColor(risk: string): string {
		const colors: Record<string, string> = {
			High: 'bg-red-100 text-red-800',
			Medium: 'bg-orange-100 text-orange-800',
			Low: 'bg-emerald-100 text-emerald-800'
		};
		return colors[risk] || 'bg-gray-100 text-gray-800';
	}

	function getCompletionPercentage(req: Requirement): number {
		if (req.task_count === 0) return 0;
		return Math.round((req.tasks_completed / req.task_count) * 100);
	}

	// Sortable table configuration
	const columns = [
		{
			key: 'title',
			label: 'Requirement',
			type: 'string' as const,
			defaultSort: 'asc' as const
		},
		{
			key: 'status',
			label: 'Status',
			type: 'string' as const
		},
		{
			key: 'priority',
			label: 'Priority',
			type: 'enum' as const
		},
		{
			key: 'task_count',
			label: 'Progress',
			type: 'number' as const,
			sortable: false  // Progress is calculated, not directly sortable by task count
		},
		{
			key: 'risk_level',
			label: 'Risk',
			type: 'enum' as const
		},
		{
			key: 'updated_at',
			label: 'Updated',
			type: 'date' as const
		},
		{
			key: 'actions',
			label: 'Actions',
			sortable: false
		}
	];

	function clearFilters(): void {
		searchText = '';
		statusFilter = '';
		typeFilter = '';
		priorityFilter = '';
	}

	async function viewRequirement(id: string): Promise<void> {
		// Navigate to requirement detail view
		// This would be implemented with SvelteKit routing
		console.log('Viewing requirement:', id);
	}

	async function editRequirement(id: string): Promise<void> {
		// Navigate to requirement edit form
		console.log('Editing requirement:', id);
	}

	async function deleteRequirement(id: string): Promise<void> {
		if (confirm('Are you sure you want to delete this requirement?')) {
			// Implement delete functionality
			console.log('Deleting requirement:', id);
		}
	}
</script>

<svelte:head>
	<title>Requirements - Lifecycle Viewer</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header with Actions -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Requirements</h1>
			<p class="text-gray-600">Manage and track project requirements</p>
		</div>
		<button
			class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
		>
			<Plus class="w-4 h-4 mr-2" />
			New Requirement
		</button>
	</div>

	<!-- Filters -->
	<div class="bg-white rounded-lg shadow p-6">
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
				<input
					type="text"
					placeholder="Search requirements..."
					bind:value={searchText}
					class="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>

			<!-- Status Filter -->
			<select
				bind:value={statusFilter}
				class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value="">All Statuses</option>
				<option value="Draft">Draft</option>
				<option value="Under Review">Under Review</option>
				<option value="Approved">Approved</option>
				<option value="Architecture">Architecture</option>
				<option value="Ready">Ready</option>
				<option value="Implemented">Implemented</option>
				<option value="Validated">Validated</option>
				<option value="Deprecated">Deprecated</option>
			</select>

			<!-- Type Filter -->
			<select
				bind:value={typeFilter}
				class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value="">All Types</option>
				<option value="FUNC">Functional</option>
				<option value="NFUNC">Non-Functional</option>
				<option value="TECH">Technical</option>
				<option value="BUS">Business</option>
				<option value="INTF">Interface</option>
			</select>

			<!-- Priority Filter -->
			<select
				bind:value={priorityFilter}
				class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value="">All Priorities</option>
				<option value="P0">P0 - Critical</option>
				<option value="P1">P1 - High</option>
				<option value="P2">P2 - Medium</option>
				<option value="P3">P3 - Low</option>
			</select>
		</div>

		{#if searchText || statusFilter || typeFilter || priorityFilter}
			<div class="mt-4 flex items-center justify-between">
				<p class="text-sm text-gray-600">
					Showing {filteredRequirements.length} of {requirements.length} requirements
				</p>
				<button on:click={clearFilters} class="text-sm text-blue-600 hover:text-blue-800">
					Clear Filters
				</button>
			</div>
		{/if}
	</div>

	<!-- Requirements List -->
	{#if loading}
		<div class="flex items-center justify-center h-64">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else if error && requirements.length === 0}
		<ErrorNotification
			{error}
			onRetry={async () => {
				loading = true;
				error = '';
				try {
					if (!mcpClient.isConnected()) {
						await mcpClient.connect();
					}
					const response = await mcpClient.getRequirements();
					if (response.success) {
						requirements = response.data!;
						filteredRequirements = requirements;
					} else {
						throw new Error(response.error || 'Failed to fetch requirements');
					}
				} catch (e) {
					error = e instanceof Error ? e.message : String(e);
				} finally {
					loading = false;
				}
			}}
			onDismiss={() => (error = '')}
		/>
	{:else if filteredRequirements.length === 0}
		<div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
			<Filter class="w-12 h-12 text-gray-400 mx-auto mb-4" />
			<h3 class="text-lg font-medium text-gray-900 mb-2">No requirements found</h3>
			<p class="text-gray-500">
				{requirements.length === 0
					? 'No requirements have been created yet.'
					: 'Try adjusting your filters to see more results.'}
			</p>
		</div>
	{:else}
		<SortableTable data={filteredRequirements as any} {columns}>
			<div slot="cell" let:row let:column>
				{#if column.key === 'title'}
					<div class="flex flex-col">
						<div class="flex items-center">
							<span class="text-xs font-mono text-gray-500 mr-2">{row.id}</span>
							<span class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded uppercase">
								{row.type}
							</span>
						</div>
						<h4 class="text-sm font-medium text-gray-900 mt-1">{row.title}</h4>
						{#if row.desired_state}
							<p class="text-sm text-gray-600 mt-1 line-clamp-2">{row.desired_state}</p>
						{/if}
					</div>
				{:else if column.key === 'status'}
					<span
						class="inline-flex px-2 py-1 text-xs font-semibold rounded border {getStatusColor(
							row.status
						)}"
					>
						{row.status}
					</span>
				{:else if column.key === 'priority'}
					<span
						class="inline-flex px-2 py-1 text-xs font-semibold rounded border {getPriorityColor(
							row.priority
						)}"
					>
						{row.priority}
					</span>
				{:else if column.key === 'task_count'}
					<div class="flex flex-col">
						<div class="flex items-center justify-between text-sm">
							<span class="text-gray-900">{row.tasks_completed}/{row.task_count} tasks</span>
							<span class="text-gray-500">{Math.round((row.task_count > 0 ? (row.tasks_completed / row.task_count) * 100 : 0))}%</span>
						</div>
						<div class="mt-1 bg-gray-200 rounded-full h-2">
							<div
								class="bg-blue-600 h-2 rounded-full"
								style="width: {Math.round((row.task_count > 0 ? (row.tasks_completed / row.task_count) * 100 : 0))}%"
							></div>
						</div>
					</div>
				{:else if column.key === 'risk_level'}
					{#if row.risk_level}
						<span
							class="inline-flex px-2 py-1 text-xs font-medium rounded {getRiskColor(
								row.risk_level
							)}"
						>
							{row.risk_level}
						</span>
					{:else}
						<span class="text-gray-400">-</span>
					{/if}
				{:else if column.key === 'updated_at'}
					<span class="text-sm text-gray-500">
						{new Date(row.updated_at).toLocaleDateString()}
					</span>
				{:else if column.key === 'actions'}
					<div class="flex items-center justify-end space-x-2">
						<button
							on:click={() => viewRequirement(row.id)}
							class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
							title="View Details"
						>
							<Eye class="w-4 h-4" />
						</button>
						<button
							on:click={() => editRequirement(row.id)}
							class="p-1 text-gray-400 hover:text-orange-600 transition-colors"
							title="Edit"
						>
							<Edit class="w-4 h-4" />
						</button>
						<button
							on:click={() => deleteRequirement(row.id)}
							class="p-1 text-gray-400 hover:text-red-600 transition-colors"
							title="Delete"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				{/if}
			</div>
		</SortableTable>
	{/if}

	<!-- Summary Stats -->
	{#if filteredRequirements.length > 0}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Summary</h3>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
				<div>
					<p class="text-2xl font-bold text-blue-600">
						{filteredRequirements.length}
					</p>
					<p class="text-sm text-gray-600">Total Requirements</p>
				</div>
				<div>
					<p class="text-2xl font-bold text-emerald-600">
						{filteredRequirements.filter((r) => ['Implemented', 'Validated'].includes(r.status))
							.length}
					</p>
					<p class="text-sm text-gray-600">Completed</p>
				</div>
				<div>
					<p class="text-2xl font-bold text-orange-600">
						{filteredRequirements.filter((r) =>
							['In Progress', 'Ready', 'Architecture'].includes(r.status)
						).length}
					</p>
					<p class="text-sm text-gray-600">In Progress</p>
				</div>
				<div>
					<p class="text-2xl font-bold text-red-600">
						{filteredRequirements.filter((r) => r.priority === 'P0').length}
					</p>
					<p class="text-sm text-gray-600">Critical Priority</p>
				</div>
			</div>
		</div>
	{/if}
</div>
