<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, Filter, Network, BarChart3, Calendar, Map, RefreshCw } from 'lucide-svelte';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';
	import { currentTheme } from '$lib/theme';
	import { LifecycleMCPClient } from '$lib/services/mcp-client';
	import FilterPanel from './visualization/FilterPanel.svelte';
	import LayoutControls from './visualization/LayoutControls.svelte';
	import DiagramRenderer from './visualization/DiagramRenderer.svelte';
	import SvelteFlowVisualization from './visualization/SvelteFlowVisualization.svelte';
	import RelationshipEditor from './visualization/RelationshipEditor.svelte';
	import ErrorNotification from './ErrorNotification.svelte';
	import { featureFlags } from '$lib/stores/feature-flags';

	export let requirements: Requirement[] = [];
	export let tasks: Task[] = [];
	export let architectureDecisions: ArchitectureDecision[] = [];

	let relationships: any[] = [];

	const mcpClient = new LifecycleMCPClient();

	type LayoutMode = 'network' | 'hierarchy' | 'timeline' | 'roadmap';
	type EntityType = 'requirements' | 'tasks' | 'architecture';

	let layoutMode: LayoutMode = 'hierarchy';
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
		relationships: any[];
	} = {
		requirements: [],
		tasks: [],
		architectureDecisions: [],
		relationships: []
	};

	let isLoading = true;
	let currentError = '';
	let isRelationshipLoading = false;

	onMount(() => {
		loadData();

		// Add keyboard shortcuts
		const handleKeydown = (event: KeyboardEvent) => {
			// Ctrl/Cmd + F for search focus
			if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
				event.preventDefault();
				const searchInput = document.querySelector(
					'input[placeholder*="Search"]'
				) as HTMLInputElement;
				if (searchInput) {
					searchInput.focus();
				}
			}

			// Escape to clear search
			if (event.key === 'Escape' && searchTerm) {
				event.preventDefault();
				searchTerm = '';
			}

			// Number keys to toggle entity types
			if (event.key === '1') {
				handleEntityTypeToggle('requirements', !visibleEntityTypes.has('requirements'));
			}
			if (event.key === '2') {
				handleEntityTypeToggle('tasks', !visibleEntityTypes.has('tasks'));
			}
			if (event.key === '3') {
				handleEntityTypeToggle('architecture', !visibleEntityTypes.has('architecture'));
			}
		};

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	async function loadData() {
		try {
			isLoading = true;

			// Load data from MCP client
			await mcpClient.connect();

			const [reqResponse, taskResponse, archResponse, relationshipsResponse] = await Promise.all([
				mcpClient.getRequirementsJson(),
				mcpClient.getTasksJson(),
				mcpClient.getArchitectureDecisionsJson(),
				mcpClient.getAllRelationships()
			]);

			// Ensure we always have arrays, even if the response is empty or malformed
			if (reqResponse.success && Array.isArray(reqResponse.data)) {
				requirements = reqResponse.data;
			} else {
				console.warn('Requirements data is not an array:', reqResponse);
				requirements = [];
			}

			if (taskResponse.success && Array.isArray(taskResponse.data)) {
				tasks = taskResponse.data;
			} else {
				console.warn('Tasks data is not an array:', taskResponse);
				tasks = [];
			}

			if (archResponse.success && Array.isArray(archResponse.data)) {
				architectureDecisions = archResponse.data;
			} else {
				console.warn('Architecture data is not an array:', archResponse);
				architectureDecisions = [];
			}

			if (relationshipsResponse.success && Array.isArray(relationshipsResponse.data)) {
				relationships = relationshipsResponse.data;
			} else {
				console.warn('Relationships data is not an array:', relationshipsResponse);
				relationships = [];
			}

			console.log('Loaded data:', {
				requirements: requirements.length,
				tasks: tasks.length,
				architectureDecisions: architectureDecisions.length,
				relationships: relationships.length
			});

			// Clear any previous errors on successful load
			currentError = '';
		} catch (error) {
			console.error('Failed to load relationship data:', error);
			currentError = error instanceof Error ? error.message : 'Failed to load relationship data';
			// Fallback to empty arrays
			requirements = [];
			tasks = [];
			architectureDecisions = [];
		} finally {
			isLoading = false;
		}
	}

	// Filter data based on current filters - trigger reactivity on filter changes
	$: if (
		searchTerm ||
		visibleEntityTypes ||
		statusFilters ||
		priorityFilters ||
		requirements ||
		tasks ||
		architectureDecisions ||
		relationships
	) {
		filteredData = {
			requirements: filterRequirements(requirements),
			tasks: filterTasks(tasks),
			architectureDecisions: filterArchitectureDecisions(architectureDecisions),
			relationships: relationships || []
		};
	}

	function filterRequirements(reqs: Requirement[]): Requirement[] {
		if (!visibleEntityTypes.has('requirements')) return [];
		if (!Array.isArray(reqs)) return [];

		return reqs.filter((req) => {
			// Search filter - check title, ID, and status
			if (searchTerm) {
				const search = searchTerm.toLowerCase();
				const matchesTitle = req.title.toLowerCase().includes(search);
				const matchesId = req.id.toLowerCase().includes(search);
				const matchesStatus = req.status.toLowerCase().includes(search);
				const matchesPriority = req.priority.toLowerCase().includes(search);
				const matchesType = req.type.toLowerCase().includes(search);

				if (!matchesTitle && !matchesId && !matchesStatus && !matchesPriority && !matchesType) {
					return false;
				}
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
		if (!Array.isArray(taskList)) return [];

		return taskList.filter((task) => {
			// Search filter - check title, ID, status, assignee
			if (searchTerm) {
				const search = searchTerm.toLowerCase();
				const matchesTitle = task.title.toLowerCase().includes(search);
				const matchesId = task.id.toLowerCase().includes(search);
				const matchesStatus = task.status.toLowerCase().includes(search);
				const matchesPriority = task.priority.toLowerCase().includes(search);
				const matchesAssignee = task.assignee?.toLowerCase().includes(search) || false;

				if (!matchesTitle && !matchesId && !matchesStatus && !matchesPriority && !matchesAssignee) {
					return false;
				}
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
		if (!Array.isArray(decisions)) return [];

		return decisions.filter((decision) => {
			// Search filter - check title, ID, status, type
			if (searchTerm) {
				const search = searchTerm.toLowerCase();
				const matchesTitle = decision.title.toLowerCase().includes(search);
				const matchesId = decision.id.toLowerCase().includes(search);
				const matchesStatus = decision.status.toLowerCase().includes(search);
				const matchesType = decision.type.toLowerCase().includes(search);

				if (!matchesTitle && !matchesId && !matchesStatus && !matchesType) {
					return false;
				}
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

	let diagramRenderer: DiagramRenderer;
	let svelteFlowVisualization: SvelteFlowVisualization;

	// Relationship editing state
	let showRelationshipEditor = false;
	let editingSourceNode: any = null;
	let editingTargetNode: any = null;
	let editingRelationship: any = null;
	let isOpeningRelationshipEditor = false;


	function handleNodeClick(event: CustomEvent) {
		const { node } = event.detail;

		if (editingSourceNode && !editingTargetNode) {
			// Second click - set target and open editor
			editingTargetNode = node;
			if (editingSourceNode.id !== node.id) {
				showRelationshipEditor = true;
			} else {
				// Clicked same node, cancel
				editingSourceNode = null;
			}
		} else {
			// First click - set source
			editingSourceNode = node;
			editingTargetNode = null;
		}
	}

	async function handleRelationshipCreate(event: CustomEvent) {
		const { sourceId, targetId, type } = event.detail;

		try {
			isRelationshipLoading = true;
			currentError = ''; // Clear any previous errors
			const result = await mcpClient.createRelationship(sourceId, targetId, type);

			if (result.success) {
				currentError = ''; // Clear error on success
				// Refresh data to show new relationship
				await loadData();
			} else {
				console.error('Failed to create relationship:', result.error);
				currentError = `Failed to create relationship: ${result.error || 'Unknown error'}`;
			}
		} catch (error) {
			console.error('Error creating relationship:', error);
			currentError =
				error instanceof Error
					? `Error creating relationship: ${error.message}`
					: 'Failed to create relationship due to unexpected error';
		} finally {
			isRelationshipLoading = false;
		}

		// Reset editing state
		editingSourceNode = null;
		editingTargetNode = null;
	}

	async function handleRelationshipUpdate(event: CustomEvent) {
		const { relationshipId, type } = event.detail;

		try {
			isRelationshipLoading = true;
			currentError = ''; // Clear any previous errors
			const result = await mcpClient.updateRelationship(relationshipId, type);

			if (result.success) {
				console.log('Relationship updated successfully');
				currentError = ''; // Clear error on success
				// Refresh data to show updated relationship
				await loadData();
			} else {
				console.error('Failed to update relationship:', result.error);
				currentError = `Failed to update relationship: ${result.error || 'Unknown error'}`;
			}
		} catch (error) {
			console.error('Error updating relationship:', error);
			currentError =
				error instanceof Error
					? `Error updating relationship: ${error.message}`
					: 'Failed to update relationship due to unexpected error';
		} finally {
			isRelationshipLoading = false;
		}

		editingRelationship = null;
	}

	async function handleRelationshipDelete(event: CustomEvent) {
		const { relationshipId } = event.detail;

		try {
			isRelationshipLoading = true;
			currentError = ''; // Clear any previous errors
			const result = await mcpClient.deleteRelationship(relationshipId);

			if (result.success) {
				console.log('Relationship deleted successfully');
				currentError = ''; // Clear error on success
				// Refresh data to show removed relationship
				await loadData();
			} else {
				console.error('Failed to delete relationship:', result.error);
				currentError = `Failed to delete relationship: ${result.error || 'Unknown error'}`;
			}
		} catch (error) {
			console.error('Error deleting relationship:', error);
			currentError =
				error instanceof Error
					? `Error deleting relationship: ${error.message}`
					: 'Failed to delete relationship due to unexpected error';
		} finally {
			isRelationshipLoading = false;
		}

		editingRelationship = null;
	}

	function handleEditorClose() {
		showRelationshipEditor = false;
		isOpeningRelationshipEditor = false;

		// If we were creating a new relationship via drag-to-connect, remove the temporary edge
		if (editingSourceNode && editingTargetNode && $featureFlags.dragToConnectRelationships) {
			// Signal to SvelteFlowVisualization to remove the temporary edge
			if (svelteFlowVisualization?.removeTemporaryEdge) {
				svelteFlowVisualization.removeTemporaryEdge(editingSourceNode.id, editingTargetNode.id);
			}
		}

		editingSourceNode = null;
		editingTargetNode = null;
		editingRelationship = null;
	}

	async function manualRefresh() {
		if (!isLoading) {
			await loadData();
		}
	}

	// Helper function to find entity by ID from filtered data
	function findEntityById(id: string): Requirement | Task | ArchitectureDecision | null {
		// Check requirements first
		const requirement = filteredData.requirements.find(req => req.id === id);
		if (requirement) return requirement;

		// Check tasks
		const task = filteredData.tasks.find(t => t.id === id);
		if (task) return task;

		// Check architecture decisions
		const architecture = filteredData.architectureDecisions.find(arch => arch.id === id);
		if (architecture) return architecture;

		return null;
	}

	// Helper function to determine entity type for DiagramNode
	function getEntityTypeFromEntity(entity: Requirement | Task | ArchitectureDecision): string {
		if ('current_state' in entity) return 'requirement';
		if ('effort' in entity) return 'task';
		return 'architecture';
	}
</script>

<div class="flex flex-col h-full">
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
					style="background-color: {visibleEntityTypes.has('requirements')
						? $currentTheme.semantic.primary.background + '40'
						: 'transparent'};
							color: {visibleEntityTypes.has('requirements')
						? $currentTheme.base.accent
						: $currentTheme.base.muted};"
					on:click={() =>
						handleEntityTypeToggle('requirements', !visibleEntityTypes.has('requirements'))}
				>
					<div class="w-3 h-3 rounded bg-blue-500"></div>
					<span>Requirements</span>
				</button>

				<button
					class="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
					class:opacity-50={!visibleEntityTypes.has('tasks')}
					style="background-color: {visibleEntityTypes.has('tasks')
						? $currentTheme.semantic.primary.background + '40'
						: 'transparent'};
							color: {visibleEntityTypes.has('tasks') ? $currentTheme.base.accent : $currentTheme.base.muted};"
					on:click={() => handleEntityTypeToggle('tasks', !visibleEntityTypes.has('tasks'))}
				>
					<div class="w-3 h-3 rounded bg-green-500"></div>
					<span>Tasks</span>
				</button>

				<button
					class="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
					class:opacity-50={!visibleEntityTypes.has('architecture')}
					style="background-color: {visibleEntityTypes.has('architecture')
						? $currentTheme.semantic.primary.background + '40'
						: 'transparent'};
							color: {visibleEntityTypes.has('architecture')
						? $currentTheme.base.accent
						: $currentTheme.base.muted};"
					on:click={() =>
						handleEntityTypeToggle('architecture', !visibleEntityTypes.has('architecture'))}
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
					placeholder="Search titles, IDs, or status..."
					class="pl-10 pr-4 py-2 rounded-lg border text-sm w-64"
					style="background-color: {$currentTheme.base.background};
							border-color: {$currentTheme.base.border};
							color: {$currentTheme.base.foreground};"
					bind:value={searchTerm}
				/>
				{#if searchTerm}
					<button
						class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
						on:click={() => (searchTerm = '')}
						title="Clear search"
					>
						×
					</button>
				{/if}
			</div>

			<!-- Filter Toggle -->
			<button
				class="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
				class:bg-opacity-20={showFilterPanel}
				style="background-color: {showFilterPanel
					? $currentTheme.semantic.primary.background
					: 'transparent'};
						border-color: {$currentTheme.base.border};
						color: {$currentTheme.base.foreground};"
				on:click={() => (showFilterPanel = !showFilterPanel)}
			>
				<Filter class="w-4 h-4" />
				<span>Filters</span>
			</button>

			<!-- Refresh Controls -->
			<button
				class="p-2 rounded-lg text-sm font-medium transition-colors border"
				style="border-color: {$currentTheme.base.border};
						color: {$currentTheme.base.foreground};"
				on:click={manualRefresh}
				disabled={isLoading}
				title="Manual refresh"
			>
				<RefreshCw class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	<!-- Error Notifications -->
	{#if currentError}
		<div class="p-4">
			<ErrorNotification
				error={currentError}
				onRetry={async () => {
					currentError = '';
					await loadData();
				}}
				onDismiss={() => {
					currentError = '';
				}}
			/>
		</div>
	{/if}

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

				<div class="flex items-center space-x-4 text-sm" style="color: {$currentTheme.base.muted};">
					<div>
						{filteredData.requirements.length} Requirements •
						{filteredData.tasks.length} Tasks •
						{filteredData.architectureDecisions.length} Architecture Decisions
					</div>

					{#if searchTerm || statusFilters.size > 0 || priorityFilters.size > 0}
						<div
							class="flex items-center space-x-2 px-2 py-1 rounded text-xs"
							style="background-color: {$currentTheme.semantic.primary.background}40;"
						>
							<span>Filtered</span>
							{#if searchTerm}
								<span
									class="px-1 py-0.5 rounded"
									style="background-color: {$currentTheme.base.accent}20;"
								>
									"{searchTerm}"
								</span>
							{/if}
						</div>
					{/if}

					{#if editingSourceNode}
						<div
							class="flex items-center space-x-2 px-2 py-1 rounded text-xs"
							style="background-color: #3b82f640;"
						>
							<span
								>Relationship Mode: Click target node to connect to "{editingSourceNode.title}"</span
							>
						</div>
					{/if}
				</div>
			</div>

			<!-- Diagram Container -->
			<div class="flex-1 overflow-hidden relative">
				{#if isLoading}
					<div class="flex items-center justify-center h-full">
						<div class="text-center">
							<div
								class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
								style="border-color: {$currentTheme.base.accent};"
							></div>
							<p style="color: {$currentTheme.base.muted};">Loading relationship data...</p>
						</div>
					</div>
				{:else}
					{#if $featureFlags.useSvelteFlow}
						<SvelteFlowVisualization
							bind:this={svelteFlowVisualization}
							data={filteredData}
							{layoutMode}
							{visibleEntityTypes}
							on:nodeClick={handleNodeClick}
							on:edgeClick={(event) => console.log('Edge clicked:', event.detail)}
							on:relationshipCreate={(event) => {
								if ($featureFlags.dragToConnectRelationships && !isOpeningRelationshipEditor) {
									isOpeningRelationshipEditor = true;

									// Find the actual nodes from the filtered data to create proper DiagramNode objects
									const sourceEntity = findEntityById(event.detail.source);
									const targetEntity = findEntityById(event.detail.target);

									if (sourceEntity && targetEntity) {
										// Create DiagramNode objects that RelationshipEditor expects
										editingSourceNode = {
											id: sourceEntity.id,
											title: sourceEntity.title,
											type: getEntityTypeFromEntity(sourceEntity)
										};
										editingTargetNode = {
											id: targetEntity.id,
											title: targetEntity.title,
											type: getEntityTypeFromEntity(targetEntity)
										};

										// Add small delay to prevent immediate closure
										setTimeout(() => {
											showRelationshipEditor = true;
											isOpeningRelationshipEditor = false;
										}, 100);
									} else {
										console.warn('❌ Could not find entities for relationship:', {
											sourceId: event.detail.source,
											targetId: event.detail.target,
											sourceEntity,
											targetEntity
										});
										isOpeningRelationshipEditor = false;
									}
								}
							}}
						/>
					{:else}
						<DiagramRenderer
							bind:this={diagramRenderer}
							data={filteredData}
							{layoutMode}
							{visibleEntityTypes}
							on:nodeClick={handleNodeClick}
						/>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Relationship Editor Modal -->
	<RelationshipEditor
		bind:isOpen={showRelationshipEditor}
		sourceNode={editingSourceNode}
		targetNode={editingTargetNode}
		existingRelationship={editingRelationship}
		on:create={handleRelationshipCreate}
		on:update={handleRelationshipUpdate}
		on:delete={handleRelationshipDelete}
		on:close={handleEditorClose}
	/>
</div>
