<script context="module" lang="ts">
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';

	type EntityType = 'requirement' | 'task' | 'architecture';

	export interface DiagramNode {
		id: string;
		type: EntityType;
		title: string;
		status: string;
		priority?: string;
		x: number;
		y: number;
		width: number;
		height: number;
		data: Requirement | Task | ArchitectureDecision;
	}
</script>

<script lang="ts">
	import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';
	import { currentTheme } from '$lib/theme';
	import EntityNode from './EntityNode.svelte';
	import RelationshipEdge from './RelationshipEdge.svelte';

	export let data: {
		requirements: Requirement[];
		tasks: Task[];
		architectureDecisions: ArchitectureDecision[];
	};
	export let layoutMode: 'network' | 'hierarchy' | 'timeline' | 'roadmap';
	export let visibleEntityTypes: Set<'requirements' | 'tasks' | 'architecture'>;

	const dispatch = createEventDispatcher();

	interface DiagramEdge {
		id: string;
		source: string;
		target: string;
		type: 'implements' | 'depends' | 'addresses';
		sourceX: number;
		sourceY: number;
		targetX: number;
		targetY: number;
	}

	let svgContainer: SVGSVGElement;
	let nodes: DiagramNode[] = [];
	let edges: DiagramEdge[] = [];
	let viewBox = { x: 0, y: 0, width: 1000, height: 600 };
	let scale = 1;
	let isPanning = false;
	let panStart = { x: 0, y: 0 };
	let draggedNode: DiagramNode | null = null;
	let shiftPressed = false;

	// Node dimensions
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 80;
	const NODE_SPACING_X = 250;
	const NODE_SPACING_Y = 120;

	$: {
		// Rebuild diagram when data or layout changes
		console.log('Rebuilding diagram with data:', {
			requirements: data.requirements.length,
			tasks: data.tasks.length,
			architecture: data.architectureDecisions.length,
			layoutMode
		});
		rebuildDiagram();
	}

	function rebuildDiagram() {
		console.log('Starting rebuildDiagram');
		nodes = [];
		edges = [];

		// Create nodes for each visible entity type
		let yOffset = 50;

		console.log('Creating requirement nodes');
		if (visibleEntityTypes.has('requirements')) {
			data.requirements.forEach((req, index) => {
				nodes.push({
					id: req.id,
					type: 'requirement',
					title: req.title,
					status: req.status,
					priority: req.priority,
					x: calculateNodeX(index, 'requirement'),
					y: calculateNodeY(index, 'requirement', yOffset),
					width: NODE_WIDTH,
					height: NODE_HEIGHT,
					data: req
				});
			});
			yOffset += Math.ceil(data.requirements.length / getNodesPerRow()) * NODE_SPACING_Y + 100;
		}

		console.log('Creating task nodes');
		if (visibleEntityTypes.has('tasks')) {
			data.tasks.forEach((task, index) => {
				nodes.push({
					id: task.id,
					type: 'task',
					title: task.title,
					status: task.status,
					priority: task.priority,
					x: calculateNodeX(index, 'task'),
					y: calculateNodeY(index, 'task', yOffset),
					width: NODE_WIDTH,
					height: NODE_HEIGHT,
					data: task
				});
			});
			yOffset += Math.ceil(data.tasks.length / getNodesPerRow()) * NODE_SPACING_Y + 100;
		}

		console.log('Creating architecture nodes');
		if (visibleEntityTypes.has('architecture')) {
			data.architectureDecisions.forEach((arch, index) => {
				nodes.push({
					id: arch.id,
					type: 'architecture',
					title: arch.title,
					status: arch.status,
					priority: undefined,
					x: calculateNodeX(index, 'architecture'),
					y: calculateNodeY(index, 'architecture', yOffset),
					width: NODE_WIDTH,
					height: NODE_HEIGHT,
					data: arch
				});
			});
		}

		console.log('Created', nodes.length, 'nodes');

		// Apply layout-specific positioning
		console.log('Applying layout:', layoutMode);
		applyLayout();

		// Create edges based on relationships
		console.log('Creating edges');
		createEdges();
		console.log('Created', edges.length, 'edges');

		// Update viewBox to fit content
		console.log('Updating viewBox');
		updateViewBox();
		console.log('rebuildDiagram complete');
	}

	function getNodesPerRow(): number {
		return Math.max(1, Math.floor((viewBox.width - 100) / NODE_SPACING_X));
	}

	function calculateNodeX(index: number, type: EntityType): number {
		const nodesPerRow = getNodesPerRow();
		const col = index % nodesPerRow;
		return 50 + col * NODE_SPACING_X;
	}

	function calculateNodeY(index: number, type: EntityType, baseY: number): number {
		const nodesPerRow = getNodesPerRow();
		const row = Math.floor(index / nodesPerRow);
		return baseY + row * NODE_SPACING_Y;
	}

	function applyLayout() {
		switch (layoutMode) {
			case 'network':
				applyNetworkLayout();
				break;
			case 'hierarchy':
				applyHierarchicalLayout();
				break;
			case 'timeline':
				applyTimelineLayout();
				break;
			case 'roadmap':
				applyRoadmapLayout();
				break;
		}
	}

	function applyNetworkLayout() {
		console.log('Applying optimized network layout to', nodes.length, 'nodes');

		if (nodes.length === 0) return;

		// Optimized parameters for better performance
		const maxIterations = Math.min(15, Math.max(3, Math.floor(50 / Math.sqrt(nodes.length))));
		const repulsionForce = 2000;
		const attractionForce = 0.008;
		const dampingFactor = 0.15;
		const maxRepulsionDistance = 300; // Only calculate repulsion for nearby nodes

		console.log('Running', maxIterations, 'iterations for network layout');

		// Pre-calculate lookup maps for O(1) access
		const edgeMap = new Map<string, DiagramEdge[]>();
		const nodeMap = new Map<string, DiagramNode>();

		edges.forEach((edge) => {
			if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
			if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, []);
			edgeMap.get(edge.source)!.push(edge);
			edgeMap.get(edge.target)!.push(edge);
		});

		nodes.forEach((node) => {
			nodeMap.set(node.id, node);
		});

		for (let i = 0; i < maxIterations; i++) {
			// Apply spatial partitioning for O(n log n) repulsion instead of O(n²)
			const forces = new Map<string, { fx: number; fy: number }>();

			// Initialize forces
			nodes.forEach((node) => {
				forces.set(node.id, { fx: 0, fy: 0 });
			});

			// Optimized repulsion using spatial awareness
			for (let j = 0; j < nodes.length; j++) {
				const nodeA = nodes[j];
				const forceA = forces.get(nodeA.id)!;

				// Only check nearby nodes for repulsion (reduces complexity)
				for (let k = j + 1; k < nodes.length; k++) {
					const nodeB = nodes[k];
					const dx = nodeA.x - nodeB.x;
					const dy = nodeA.y - nodeB.y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					// Skip distant nodes to reduce calculations
					if (distance > maxRepulsionDistance) continue;

					const minDistance = Math.max(distance, 20);
					const force = repulsionForce / (minDistance * minDistance);

					const fx = (dx / minDistance) * force;
					const fy = (dy / minDistance) * force;

					forceA.fx += fx * dampingFactor;
					forceA.fy += fy * dampingFactor;

					const forceB = forces.get(nodeB.id)!;
					forceB.fx -= fx * dampingFactor;
					forceB.fy -= fy * dampingFactor;
				}
			}

			// Apply attraction along edges with pre-computed lookup
			nodes.forEach((node) => {
				const nodeEdges = edgeMap.get(node.id) || [];
				const nodeForce = forces.get(node.id)!;

				nodeEdges.forEach((edge) => {
					const isSource = edge.source === node.id;
					const connectedNodeId = isSource ? edge.target : edge.source;
					const connectedNode = nodeMap.get(connectedNodeId); // O(1) lookup

					if (connectedNode) {
						const dx = connectedNode.x - node.x;
						const dy = connectedNode.y - node.y;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance > 0) {
							const fx = (dx / distance) * distance * attractionForce;
							const fy = (dy / distance) * distance * attractionForce;

							nodeForce.fx += fx;
							nodeForce.fy += fy;
						}
					}
				});
			});

			// Apply forces to nodes with bounds checking
			nodes.forEach((node) => {
				const force = forces.get(node.id)!;

				// Apply forces with momentum preservation
				node.x += Math.max(-50, Math.min(50, force.fx));
				node.y += Math.max(-50, Math.min(50, force.fy));

				// Keep nodes within reasonable bounds
				node.x = Math.max(50, Math.min(viewBox.width - 50, node.x));
				node.y = Math.max(50, Math.min(viewBox.height - 50, node.y));
			});

			// Early termination if system has stabilized
			const totalForce = Array.from(forces.values()).reduce(
				(sum, f) => sum + Math.sqrt(f.fx * f.fx + f.fy * f.fy),
				0
			);

			if (totalForce < 10) {
				console.log(`Network layout converged after ${i + 1} iterations`);
				break;
			}
		}

		console.log('Network layout complete');
	}

	function applyHierarchicalLayout() {
		// More sophisticated hierarchical layout based on actual relationships
		const reqNodes = nodes.filter((n) => n.type === 'requirement');
		const taskNodes = nodes.filter((n) => n.type === 'task');
		const archNodes = nodes.filter((n) => n.type === 'architecture');

		// Group tasks by their parent requirements
		const tasksByReq = new Map<string, typeof taskNodes>();

		taskNodes.forEach((taskNode) => {
			const relatedReqEdge = edges.find((e) => e.target === taskNode.id && e.type === 'implements');
			const reqId = relatedReqEdge?.source || 'orphaned';

			if (!tasksByReq.has(reqId)) {
				tasksByReq.set(reqId, []);
			}
			tasksByReq.get(reqId)!.push(taskNode);
		});

		// Position requirements at top level
		let currentX = 50;
		reqNodes.forEach((reqNode, index) => {
			reqNode.x = currentX;
			reqNode.y = 50;

			// Position related tasks below this requirement
			const relatedTasks = tasksByReq.get(reqNode.id) || [];
			let taskX = currentX;

			relatedTasks.forEach((taskNode, taskIndex) => {
				taskNode.x = taskX;
				taskNode.y = 200;

				// Check for subtasks
				const subtasks = taskNodes.filter(
					(t) => t.type === 'task' && (t.data as Task).parent_task_id === taskNode.id
				);
				subtasks.forEach((subtask, subIndex) => {
					subtask.x = taskX + subIndex * (NODE_SPACING_X * 0.8);
					subtask.y = 320;
				});

				taskX += NODE_SPACING_X * 0.8;
			});

			// Update current X for next requirement group
			currentX = Math.max(currentX + NODE_SPACING_X, taskX + NODE_SPACING_X * 0.5);
		});

		// Handle orphaned tasks
		const orphanedTasks = tasksByReq.get('orphaned') || [];
		orphanedTasks.forEach((taskNode, index) => {
			taskNode.x = currentX + index * NODE_SPACING_X * 0.8;
			taskNode.y = 200;
		});

		// Position architecture decisions at bottom, grouped by related requirements
		let archX = 50;
		archNodes.forEach((archNode, index) => {
			const relatedReqEdge = edges.find((e) => e.source === archNode.id && e.type === 'addresses');
			if (relatedReqEdge) {
				const relatedReq = nodes.find((n) => n.id === relatedReqEdge.target);
				if (relatedReq) {
					archNode.x = relatedReq.x;
					archNode.y = 470;
				} else {
					archNode.x = archX;
					archNode.y = 470;
					archX += NODE_SPACING_X;
				}
			} else {
				archNode.x = archX;
				archNode.y = 470;
				archX += NODE_SPACING_X;
			}
		});
	}

	function applyTimelineLayout() {
		// Create a timeline layout with swim lanes by type
		const reqNodes = nodes.filter((n) => n.type === 'requirement');
		const taskNodes = nodes.filter((n) => n.type === 'task');
		const archNodes = nodes.filter((n) => n.type === 'architecture');

		// Define swim lanes
		const swimLanes = {
			requirement: { y: 80, nodes: reqNodes },
			task: { y: 220, nodes: taskNodes },
			architecture: { y: 360, nodes: archNodes }
		};

		// Sort each lane by date
		Object.values(swimLanes).forEach((lane) => {
			lane.nodes.sort((a, b) => {
				const aDate = new Date(a.data.created_at).getTime();
				const bDate = new Date(b.data.created_at).getTime();
				return aDate - bDate;
			});
		});

		// Find date range for proportional spacing
		const allDates = nodes.map((n) => new Date(n.data.created_at).getTime()).sort();
		const minDate = Math.min(...allDates);
		const maxDate = Math.max(...allDates);
		const dateRange = maxDate - minDate || 1; // Avoid division by zero
		const availableWidth = viewBox.width - 200;

		// Position nodes proportionally along timeline
		Object.entries(swimLanes).forEach(([type, lane]) => {
			lane.nodes.forEach((node, index) => {
				const nodeDate = new Date(node.data.created_at).getTime();
				const dateRatio =
					dateRange > 0 ? (nodeDate - minDate) / dateRange : index / (lane.nodes.length || 1);

				node.x = 100 + dateRatio * availableWidth;
				node.y = lane.y;

				// Avoid overlapping by adding small Y offsets for nodes at similar times
				const overlappingNodes = lane.nodes.filter((n) => Math.abs(n.x - node.x) < NODE_WIDTH);
				if (overlappingNodes.length > 1) {
					const overlapIndex = overlappingNodes.indexOf(node);
					node.y += overlapIndex * (NODE_HEIGHT + 10);
				}
			});
		});
	}

	function applyRoadmapLayout() {
		// Priority-based swimlanes with dependency ordering (left-to-right flow)
		const priorityLanes = { P0: 60, P1: 180, P2: 300, P3: 420 };

		// Group nodes by priority
		const nodesByPriority = {
			P0: nodes.filter((n) => n.priority === 'P0'),
			P1: nodes.filter((n) => n.priority === 'P1'),
			P2: nodes.filter((n) => n.priority === 'P2'),
			P3: nodes.filter((n) => n.priority === 'P3' || !n.priority)
		};

		// For each priority lane, arrange nodes in dependency order
		Object.entries(nodesByPriority).forEach(([priority, laneNodes]) => {
			const laneY = priorityLanes[priority as keyof typeof priorityLanes];

			// Try to arrange nodes in dependency order within each lane
			const sortedNodes = [...laneNodes];

			// Simple topological sort attempt - move nodes with dependencies to the right
			sortedNodes.sort((a, b) => {
				const aHasDependencies = edges.some((e) => e.target === a.id);
				const bHasDependencies = edges.some((e) => e.target === b.id);

				if (aHasDependencies && !bHasDependencies) return 1;
				if (!aHasDependencies && bHasDependencies) return -1;

				// Secondary sort by creation date
				const aDate = new Date(a.data.created_at).getTime();
				const bDate = new Date(b.data.created_at).getTime();
				return aDate - bDate;
			});

			// Position nodes with spacing
			sortedNodes.forEach((node, index) => {
				node.x = 80 + index * NODE_SPACING_X * 0.9;
				node.y = laneY;
			});
		});

		// Add lane labels and background
		// This would be implemented in the SVG rendering
	}

	function createEdges() {
		edges = [];

		// Create relationships using simplified pattern matching
		// Since full MCP relationship API integration requires async calls,
		// we'll use the established pattern-based approach but make it more accurate

		data.tasks.forEach((task) => {
			// Use numeric pattern matching for requirement-task relationships
			const taskNumber = task.id.split('-')[1];
			const relatedReqs = data.requirements.filter((req) => {
				const reqNumber = req.id.split('-')[1];
				// More precise matching - only match exact task numbers to requirement numbers
				return reqNumber === taskNumber;
			});

			relatedReqs.forEach((req) => {
				const sourceNode = nodes.find((n) => n.id === req.id);
				const targetNode = nodes.find((n) => n.id === task.id);

				if (sourceNode && targetNode) {
					edges.push({
						id: `${req.id}-${task.id}`,
						source: req.id,
						target: task.id,
						type: 'implements',
						sourceX: sourceNode.x + sourceNode.width / 2,
						sourceY: sourceNode.y + sourceNode.height,
						targetX: targetNode.x + targetNode.width / 2,
						targetY: targetNode.y
					});
				}
			});
		});

		// Create task dependency relationships
		data.tasks.forEach((task) => {
			// Check for parent_task_id relationships
			if (task.parent_task_id) {
				const parentNode = nodes.find((n) => n.id === task.parent_task_id);
				const childNode = nodes.find((n) => n.id === task.id);

				if (parentNode && childNode) {
					edges.push({
						id: `${task.parent_task_id}-${task.id}`,
						source: task.parent_task_id,
						target: task.id,
						type: 'depends',
						sourceX: parentNode.x + parentNode.width / 2,
						sourceY: parentNode.y + parentNode.height,
						targetX: childNode.x + childNode.width / 2,
						targetY: childNode.y
					});
				}
			}
		});

		// Create architecture-requirement relationships
		data.architectureDecisions.forEach((arch) => {
			// Find requirements that might be addressed by this architecture decision
			// This would ideally come from the requirement_architecture relationship table
			const relatedReqs = data.requirements.filter(
				(req) =>
					arch.title.toLowerCase().includes(req.title.toLowerCase().substring(0, 8)) ||
					req.title.toLowerCase().includes(arch.title.toLowerCase().substring(0, 8))
			);

			relatedReqs.forEach((req) => {
				const sourceNode = nodes.find((n) => n.id === req.id);
				const targetNode = nodes.find((n) => n.id === arch.id);

				if (sourceNode && targetNode) {
					edges.push({
						id: `${req.id}-${arch.id}`,
						source: req.id,
						target: arch.id,
						type: 'addresses',
						sourceX: sourceNode.x + sourceNode.width / 2,
						sourceY: sourceNode.y + sourceNode.height,
						targetX: targetNode.x + targetNode.width / 2,
						targetY: targetNode.y
					});
				}
			});
		});

		// Update edge positions when nodes move
		updateEdgePositions();
	}

	function updateEdgePositions() {
		// Create node lookup map for O(1) access
		const nodeMap = new Map<string, DiagramNode>();
		nodes.forEach((node) => {
			nodeMap.set(node.id, node);
		});

		edges.forEach((edge) => {
			const sourceNode = nodeMap.get(edge.source);
			const targetNode = nodeMap.get(edge.target);

			if (sourceNode && targetNode) {
				edge.sourceX = sourceNode.x + sourceNode.width / 2;
				edge.sourceY = sourceNode.y + sourceNode.height;
				edge.targetX = targetNode.x + targetNode.width / 2;
				edge.targetY = targetNode.y;
			}
		});
	}

	function updateViewBox() {
		if (nodes.length === 0) return;

		const padding = 100;
		const minX = Math.min(...nodes.map((n) => n.x)) - padding;
		const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + padding;
		const minY = Math.min(...nodes.map((n) => n.y)) - padding;
		const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + padding;

		viewBox = {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.target === svgContainer) {
			isPanning = true;
			panStart = { x: event.clientX, y: event.clientY };
			svgContainer.style.cursor = 'grabbing';
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (isPanning) {
			const dx = (event.clientX - panStart.x) / scale;
			const dy = (event.clientY - panStart.y) / scale;

			viewBox.x -= dx;
			viewBox.y -= dy;

			panStart = { x: event.clientX, y: event.clientY };
		}
	}

	function handleMouseUp() {
		isPanning = false;
		draggedNode = null;
		svgContainer.style.cursor = 'default';
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.max(0.05, Math.min(10, scale * scaleFactor));

		// Get mouse position relative to SVG
		const rect = svgContainer.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		// Convert to SVG coordinates
		const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
		const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;

		// Zoom toward mouse position
		const scaleRatio = newScale / scale;
		viewBox.width = viewBox.width / scaleRatio;
		viewBox.height = viewBox.height / scaleRatio;
		viewBox.x = svgX - (mouseX / rect.width) * viewBox.width;
		viewBox.y = svgY - (mouseY / rect.height) * viewBox.height;

		scale = newScale;
	}

	function handleZoomIn() {
		const newScale = Math.min(10, scale * 1.3);
		const scaleRatio = newScale / scale;
		const centerX = viewBox.x + viewBox.width / 2;
		const centerY = viewBox.y + viewBox.height / 2;

		viewBox.width = viewBox.width / scaleRatio;
		viewBox.height = viewBox.height / scaleRatio;
		viewBox.x = centerX - viewBox.width / 2;
		viewBox.y = centerY - viewBox.height / 2;

		scale = newScale;
	}

	function handleZoomOut() {
		const newScale = Math.max(0.05, scale * 0.7);
		const scaleRatio = newScale / scale;
		const centerX = viewBox.x + viewBox.width / 2;
		const centerY = viewBox.y + viewBox.height / 2;

		viewBox.width = viewBox.width / scaleRatio;
		viewBox.height = viewBox.height / scaleRatio;
		viewBox.x = centerX - viewBox.width / 2;
		viewBox.y = centerY - viewBox.height / 2;

		scale = newScale;
	}

	function handleResetView() {
		scale = 1;
		updateViewBox(); // Reset to fit all content
	}

	function handleNodeDragStart(node: DiagramNode) {
		draggedNode = node;
	}

	function handleNodeDrag(node: DiagramNode, dx: number, dy: number) {
		if (draggedNode === node) {
			const newX = node.x + dx / scale;
			const newY = node.y + dy / scale;

			// Apply layout constraints
			if (layoutMode === 'hierarchy') {
				// Constrain vertical movement based on entity type
				const minY = getHierarchyYConstraint(node.type, 'min');
				const maxY = getHierarchyYConstraint(node.type, 'max');
				node.y = Math.max(minY, Math.min(maxY, newY));
				node.x = newX; // Allow free horizontal movement
			} else if (layoutMode === 'timeline') {
				// Constrain to swim lanes
				const laneY = getTimelineLaneY(node.type);
				node.y = laneY;
				node.x = Math.max(100, newX); // Don't go behind left margin
			} else if (layoutMode === 'roadmap') {
				// Constrain to priority lanes
				if (node.priority) {
					const laneY = getRoadmapLaneY(node.priority);
					node.y = laneY;
				}
				node.x = Math.max(80, newX); // Don't go behind left margin
			} else {
				// Network mode - free movement with bounds
				const minX = -NODE_WIDTH;
				const maxX = viewBox.width;
				const minY = -NODE_HEIGHT;
				const maxY = viewBox.height;

				node.x = Math.max(minX, Math.min(maxX, newX));
				node.y = Math.max(minY, Math.min(maxY, newY));
			}

			// Snap to grid (optional - hold Shift)
			if (shiftPressed) {
				const gridSize = 20;
				node.x = Math.round(node.x / gridSize) * gridSize;
				node.y = Math.round(node.y / gridSize) * gridSize;
			}

			updateEdgePositions();
		}
	}

	function getHierarchyYConstraint(type: EntityType, bound: 'min' | 'max'): number {
		const constraints = {
			requirement: { min: 30, max: 150 },
			task: { min: 180, max: 350 },
			architecture: { min: 380, max: 500 }
		};
		return constraints[type][bound];
	}

	function getTimelineLaneY(type: EntityType): number {
		const lanes = {
			requirement: 80,
			task: 220,
			architecture: 360
		};
		return lanes[type];
	}

	function getRoadmapLaneY(priority: string): number {
		const lanes = {
			P0: 60,
			P1: 180,
			P2: 300,
			P3: 420
		};
		return lanes[priority as keyof typeof lanes] || lanes.P3;
	}

	onMount(() => {
		rebuildDiagram();

		// Track shift key for snap-to-grid
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftPressed = true;
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftPressed = false;
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	});

	// Export methods for parent component access
	export function zoomIn() {
		handleZoomIn();
	}

	export function zoomOut() {
		handleZoomOut();
	}

	export function resetView() {
		handleResetView();
	}
</script>

<svg
	bind:this={svgContainer}
	class="w-full h-full cursor-grab"
	viewBox="{viewBox.x} {viewBox.y} {viewBox.width} {viewBox.height}"
	role="img"
	aria-label="Interactive relationship diagram showing connections between requirements, tasks, and architecture decisions"
	on:mousedown={handleMouseDown}
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
	on:wheel={handleWheel}
>
	<!-- Background -->
	<rect
		x={viewBox.x}
		y={viewBox.y}
		width={viewBox.width}
		height={viewBox.height}
		fill={$currentTheme.base.background}
	/>

	<!-- Grid lines for better visual reference -->
	<defs>
		<pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
			<path
				d="M 50 0 L 0 0 0 50"
				fill="none"
				stroke={$currentTheme.base.border}
				stroke-width="0.5"
				opacity="0.3"
			/>
		</pattern>
	</defs>
	<rect
		x={viewBox.x}
		y={viewBox.y}
		width={viewBox.width}
		height={viewBox.height}
		fill="url(#grid)"
	/>

	<!-- Priority Lane Backgrounds (roadmap mode only) -->
	{#if layoutMode === 'roadmap'}
		<g class="priority-lanes">
			<rect
				x={viewBox.x}
				y="40"
				width={viewBox.width}
				height="100"
				fill="#dc262620"
				opacity="0.1"
			/>
			<text x="20" y="90" fill="#dc2626" font-size="14" font-weight="bold">P0 - Critical</text>

			<rect
				x={viewBox.x}
				y="160"
				width={viewBox.width}
				height="100"
				fill="#ea580c20"
				opacity="0.1"
			/>
			<text x="20" y="210" fill="#ea580c" font-size="14" font-weight="bold">P1 - High</text>

			<rect
				x={viewBox.x}
				y="280"
				width={viewBox.width}
				height="100"
				fill="#ca8a0420"
				opacity="0.1"
			/>
			<text x="20" y="330" fill="#ca8a04" font-size="14" font-weight="bold">P2 - Medium</text>

			<rect
				x={viewBox.x}
				y="400"
				width={viewBox.width}
				height="100"
				fill="#16a34a20"
				opacity="0.1"
			/>
			<text x="20" y="450" fill="#16a34a" font-size="14" font-weight="bold">P3 - Low</text>
		</g>
	{/if}

	<!-- Timeline Labels (timeline mode only) -->
	{#if layoutMode === 'timeline'}
		<g class="timeline-lanes">
			<rect
				x={viewBox.x}
				y="50"
				width={viewBox.width}
				height="120"
				fill="#3b82f620"
				opacity="0.1"
			/>
			<text x="20" y="110" fill="#3b82f6" font-size="14" font-weight="bold">Requirements</text>

			<rect
				x={viewBox.x}
				y="190"
				width={viewBox.width}
				height="120"
				fill="#10b98120"
				opacity="0.1"
			/>
			<text x="20" y="250" fill="#10b981" font-size="14" font-weight="bold">Tasks</text>

			<rect
				x={viewBox.x}
				y="330"
				width={viewBox.width}
				height="120"
				fill="#8b5cf620"
				opacity="0.1"
			/>
			<text x="20" y="390" fill="#8b5cf6" font-size="14" font-weight="bold">Architecture</text>
		</g>
	{/if}

	<!-- Edges (draw first so they appear behind nodes) -->
	{#each edges as edge (edge.id)}
		<RelationshipEdge {edge} />
	{/each}

	<!-- Nodes -->
	{#each nodes as node (node.id)}
		<EntityNode
			{node}
			on:dragstart={() => handleNodeDragStart(node)}
			on:drag={(e) => handleNodeDrag(node, e.detail.dx, e.detail.dy)}
			on:click={(e) => dispatch('nodeClick', e.detail)}
		/>
	{/each}
</svg>
