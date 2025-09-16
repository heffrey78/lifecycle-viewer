<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { SvelteFlow, Controls, Background, MiniMap, NodeToolbar } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Node, Edge } from '@xyflow/svelte';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';
	import { buildSvelteFlowGraph } from '$lib/visualization/svelte-flow-adapters';
	import { currentTheme } from '$lib/theme';
	import { featureFlags } from '$lib/stores/feature-flags';

	export let data: {
		requirements: Requirement[];
		tasks: Task[];
		architectureDecisions: ArchitectureDecision[];
		relationships?: any[];
	};
	export let layoutMode: 'network' | 'hierarchy' | 'timeline' | 'roadmap';
	export let visibleEntityTypes: Set<'requirements' | 'tasks' | 'architecture'>;

	const dispatch = createEventDispatcher();

	let nodes: Node[] = [];
	let edges: Edge[] = [];

	// Simplified test nodes for debugging
	let testNodes = [
		{
			id: 'debug-1',
			type: 'default',
			position: { x: 0, y: 0 },
			data: { label: 'AT ORIGIN' },
			style: 'background: red; color: white; padding: 20px; border: 3px solid yellow; border-radius: 4px; width: 150px; height: 50px;'
		},
		{
			id: 'debug-2',
			type: 'default',
			position: { x: 200, y: 0 },
			data: { label: 'RIGHT OF ORIGIN' },
			style: 'background: blue; color: white; padding: 20px; border: 3px solid yellow; border-radius: 4px; width: 150px; height: 50px;'
		},
		{
			id: 'debug-3',
			type: 'default',
			position: { x: 0, y: 200 },
			data: { label: 'BELOW ORIGIN' },
			style: 'background: green; color: white; padding: 20px; border: 3px solid yellow; border-radius: 4px; width: 150px; height: 50px;'
		}
	];
	let svelteFlowComponent: any;
	let performanceMetrics: any = null;
	let selectedNode: Node<NodeData> | null = null;

	// Build graph when data OR layout changes (with stable dependencies)
	$: if (data && $featureFlags.useSvelteFlow && data.requirements && data.tasks && data.architectureDecisions && layoutMode) {
		rebuildGraph();

		// Trigger fitView after layout change
		setTimeout(() => {
			if (svelteFlowComponent && typeof svelteFlowComponent.fitView === 'function') {
				svelteFlowComponent.fitView({
					padding: 0.1,
					includeHiddenNodes: false,
					duration: 300
				});
			}
		}, 100);
	}

	function rebuildGraph() {

		const result = buildSvelteFlowGraph(data, layoutMode, visibleEntityTypes);

		nodes = result.nodes as Node[];
		edges = result.edges as Edge[];
		performanceMetrics = {
			buildTime: result.buildTime,
			nodeCount: result.nodeCount,
			edgeCount: result.edgeCount
		};


		// fitView will be handled automatically by Svelte-Flow

		// Log performance if monitoring is enabled
		if ($featureFlags.enableVisualizationPerformanceMonitoring) {
			console.debug('📊 Svelte-Flow Performance:', performanceMetrics);
		}
	}

	// Node click handler
	function handleNodeClick({ node, event }: { node: any, event: any }) {
		if (node?.data?.entity) {
			// Set selected node for detail viewing
			selectedNode = node;

			// Also dispatch for relationship creation workflow
			dispatch('nodeClick', {
				entity: node.data.entity,
				entityType: node.data.entityType
			});
		}
	}

	// Edge click handler
	function handleEdgeClick({ edge, event }: { edge: any, event: any }) {
		if (edge?.data) {
			dispatch('edgeClick', {
				relationshipType: edge.data.relationshipType,
				source: edge.data.source,
				target: edge.data.target
			});
		}
	}

	// Connection handler for drag-to-connect
	function handleConnect(connection: any) {
		if ($featureFlags.dragToConnectRelationships) {
			// Add the edge immediately to make it persist
			const newEdge = {
				id: `${connection.source}-${connection.target}`,
				source: connection.source,
				target: connection.target,
				type: 'default',
				data: {
					relationshipType: 'implements',
					source: connection.source,
					target: connection.target
				},
				style: 'stroke: #10b981; stroke-width: 3px;',
				animated: false
			};

			edges = [...edges, newEdge];

			// Also dispatch for parent component handling
			dispatch('relationshipCreate', {
				source: connection.source,
				target: connection.target,
				type: 'implements'
			});
		}
	}


	// Public method to remove temporary edges (called from parent when relationship creation is cancelled)
	export function removeTemporaryEdge(sourceId: string, targetId: string) {
		const edgeId = `${sourceId}-${targetId}`;
		edges = edges.filter(edge => edge.id !== edgeId);
	}

	onMount(() => {
		if ($featureFlags.useSvelteFlow) {
			rebuildGraph();

			// Initial fitView after component is fully mounted
			setTimeout(() => {
				if (svelteFlowComponent && typeof svelteFlowComponent.fitView === 'function') {
					svelteFlowComponent.fitView({
						padding: 0.1,
						includeHiddenNodes: false,
						duration: 300
					});
				}
			}, 200);
		}
	});
</script>

<div style="width: 100%; height: 500px;" class="relative">
	{#if $featureFlags.useSvelteFlow}


		<!-- Svelte-Flow Container -->
		<SvelteFlow
			bind:this={svelteFlowComponent}
			{nodes}
			{edges}
			fitView={false}
			fitViewOptions={{
				padding: 0.1,
				includeHiddenNodes: false,
				duration: 300
			}}
			minZoom={0.1}
			maxZoom={4}
			zoomOnScroll={true}
			zoomOnPinch={true}
			panOnDrag={true}
			panOnScroll={false}
			preventScrolling={true}
			class="svelte-flow-container"
			style="background: {$currentTheme.base.background}; width: 100%; height: 100%;"
			onnodeclick={handleNodeClick}
			onedgeclick={handleEdgeClick}
			onconnect={handleConnect}
		>
			<!-- Controls -->
			<Controls
				style="background: rgba(255, 255, 255, 0.9);"
				class="svelte-flow-controls"
			/>

			<!-- Background Pattern -->
			<Background
				gap={20}
				color={$currentTheme.base.border}
				style="opacity: 0.3;"
			/>

			<!-- Minimap -->
			<MiniMap
				nodeColor={(node) => {
					const type = node.data?.entityType;
					if (type === 'requirement') return '#3b82f6';
					if (type === 'task') return '#10b981';
					if (type === 'architecture') return '#8b5cf6';
					return '#6b7280';
				}}
				style="background: {$currentTheme.base.background}; border: 1px solid {$currentTheme.base.border};"
				class="minimap-custom"
			/>

			<!-- Entity Detail Toolbar -->
			{#if selectedNode}
				<NodeToolbar
					nodeId={selectedNode.id}
					position="top"
					align="center"
					offset={10}
					isVisible={true}
				>
					<div
						class="entity-detail-toolbar bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-80 max-w-96"
						style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base.border}; color: {$currentTheme.base.foreground};"
					>
						<!-- Entity Header -->
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center space-x-2">
								<div
									class="w-3 h-3 rounded-full"
									style="background-color: {selectedNode.data.entityType === 'requirement' ? '#3b82f6' : selectedNode.data.entityType === 'task' ? '#10b981' : '#8b5cf6'}"
								></div>
								<h3 class="font-semibold text-sm">
									{selectedNode.data.entityType === 'requirement' ? 'Requirement' : selectedNode.data.entityType === 'task' ? 'Task' : 'Architecture Decision'}
								</h3>
							</div>
							<button
								class="text-gray-400 hover:text-gray-600 p-1"
								on:click={() => selectedNode = null}
								title="Close details"
							>
								×
							</button>
						</div>

						<!-- Entity Details -->
						<div class="space-y-2">
							<div>
								<div class="font-medium text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
									Title
								</div>
								<div class="text-sm font-medium break-words">
									{selectedNode.data.entity.title}
								</div>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<div class="font-medium text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
										Status
									</div>
									<div class="text-sm">
										{selectedNode.data.entity.status}
									</div>
								</div>

								{#if selectedNode.data.entity.priority}
									<div>
										<div class="font-medium text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
											Priority
										</div>
										<div class="text-sm font-medium">
											{selectedNode.data.entity.priority}
										</div>
									</div>
								{/if}
							</div>

							{#if selectedNode.data.entity.created_at}
								<div>
									<div class="font-medium text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
										Created
									</div>
									<div class="text-sm">
										{new Date(selectedNode.data.entity.created_at).toLocaleDateString()}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</NodeToolbar>
			{/if}
		</SvelteFlow>

		<!-- Layout info -->
		<div class="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 p-2 rounded shadow text-xs">
			🚩 Svelte-Flow • {layoutMode} layout
			{#if $featureFlags.dragToConnectRelationships}
				• Drag-to-connect enabled
			{/if}
		</div>
	{:else}
		<!-- Fallback message when Svelte-Flow is disabled -->
		<div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
			<div class="text-center">
				<p class="text-lg font-medium mb-2">Svelte-Flow Visualization Disabled</p>
				<p class="text-sm">Enable via feature flags (Ctrl+Shift+F) or use legacy visualization</p>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom Svelte-Flow theming */
	:global(.svelte-flow) {
		background: transparent !important;
	}

	:global(.svelte-flow-controls) {
		border-radius: 8px !important;
	}

	:global(.dark .svelte-flow-controls) {
		background: rgba(17, 24, 39, 0.9) !important;
		color: white !important;
	}

	:global(.dark .svelte-flow-controls button) {
		color: white !important;
		border-color: rgba(75, 85, 99, 0.5) !important;
	}

	:global(.minimap-custom) {
		border-radius: 6px !important;
	}

	:global(.dark .minimap-custom) {
		background: rgba(17, 24, 39, 0.9) !important;
	}

	/* Node styling enhancements */
	:global(.svelte-flow .svelte-flow__node) {
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	:global(.svelte-flow .svelte-flow__node:hover) {
		transform: scale(1.02);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	/* Edge styling enhancements */
	:global(.svelte-flow .svelte-flow__edge) {
		cursor: pointer;
	}

	:global(.svelte-flow .svelte-flow__edge:hover .svelte-flow__edge-path) {
		stroke-width: 3px;
		filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
	}
</style>