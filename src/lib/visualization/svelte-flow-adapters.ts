/**
 * Data Transformation Layer for Svelte-Flow Integration
 * Converts lifecycle entities to svelte-flow nodes and edges
 */

import type { Node, Edge, Position } from '@xyflow/svelte';
import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';

export type EntityType = 'requirement' | 'task' | 'architecture';

export interface NodeData {
	entity: Requirement | Task | ArchitectureDecision;
	entityType: EntityType;
	label: string;
	status: string;
	priority?: string;
	effort?: string;
}

export interface EdgeData {
	relationshipType: 'implements' | 'depends' | 'addresses' | 'blocks' | 'informs';
	source: string;
	target: string;
}

// Entity type detection
function getEntityType(entity: Requirement | Task | ArchitectureDecision): EntityType {
	if ('current_state' in entity) return 'requirement';
	if ('effort' in entity) return 'task';
	return 'architecture';
}

// Node position calculation for different layout modes
export function calculateNodePosition(
	entity: Requirement | Task | ArchitectureDecision,
	index: number,
	entityType: EntityType,
	layoutMode: 'network' | 'hierarchy' | 'timeline' | 'roadmap',
	totalEntities: { requirements: number; tasks: number; architecture: number },
	allEntities?: (Requirement | Task | ArchitectureDecision)[] // For timeline baseline calculation
): { x: number; y: number } {
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 80;
	const SPACING_X = 250;
	const SPACING_Y = 120;

	switch (layoutMode) {
		case 'network':
			// Simple grid layout for network view
			const cols = 5;
			return {
				x: (index % cols) * SPACING_X,
				y: Math.floor(index / cols) * SPACING_Y
			};

		case 'hierarchy':
			// Vertical hierarchy with entity type separation
			let baseY = 0;
			if (entityType === 'requirement') baseY = 0;
			else if (entityType === 'task') baseY = Math.ceil(totalEntities.requirements / 4) * SPACING_Y + 100;
			else baseY = Math.ceil(totalEntities.requirements / 4) * SPACING_Y + Math.ceil(totalEntities.tasks / 4) * SPACING_Y + 200;

			return {
				x: (index % 4) * SPACING_X,
				y: baseY + Math.floor(index / 4) * SPACING_Y
			};

		case 'timeline':
			// Chronological timeline layout based on created_at
			try {
				const entityDate = new Date(entity.created_at).getTime();

				// Handle invalid dates
				if (isNaN(entityDate)) {
					console.warn('Invalid created_at date for entity:', entity.id, entity.created_at);
					return { x: index * SPACING_X, y: entityType === 'requirement' ? 0 : entityType === 'task' ? SPACING_Y + 50 : (SPACING_Y + 50) * 2 };
				}

				// Calculate dynamic baseline from earliest entity if available
				let baselineDate = new Date('2025-01-01').getTime();
				if (allEntities && allEntities.length > 0) {
					const validDates = allEntities
						.map(e => new Date(e.created_at).getTime())
						.filter(date => !isNaN(date));

					if (validDates.length > 0) {
						baselineDate = Math.min(...validDates);
					}
				}

				const daysSinceBaseline = Math.floor((entityDate - baselineDate) / (1000 * 60 * 60 * 24));
				const timelineX = Math.max(0, daysSinceBaseline) * 15; // Ensure non-negative, 15px per day

				return {
					x: timelineX + 50, // Add 50px left margin
					y: entityType === 'requirement' ? 0 : entityType === 'task' ? SPACING_Y + 50 : (SPACING_Y + 50) * 2
				};
			} catch (error) {
				console.warn('Timeline layout error for entity:', entity.id, error);
				return { x: index * SPACING_X, y: entityType === 'requirement' ? 0 : entityType === 'task' ? SPACING_Y + 50 : (SPACING_Y + 50) * 2 };
			}

		case 'roadmap':
			// Priority-based swim lanes with status progression
			try {
				const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
				const priority = 'priority' in entity && entity.priority ? entity.priority : 'P3';
				const priorityY = priorityOrder[priority as keyof typeof priorityOrder] * (SPACING_Y + 30);

				// X-axis based on status progression (timeline within priority)
				const statusOrder: Record<string, number> = {
					// Requirements
					'Draft': 0, 'Under Review': 1, 'Approved': 2, 'Architecture': 3, 'Ready': 4, 'Implemented': 5, 'Validated': 6, 'Deprecated': 7,
					// Tasks
					'Not Started': 0, 'In Progress': 2, 'Blocked': 1, 'Complete': 5, 'Abandoned': 7,
					// Architecture
					'Proposed': 0, 'Accepted': 2, 'Rejected': 7, 'Superseded': 7
				};

				const statusX = (statusOrder[entity.status] || 0) * SPACING_X;

				return {
					x: statusX + (index % 3) * 50, // Add slight offset for entities at same status
					y: priorityY + 40 // Add header space for priority labels
				};
			} catch (error) {
				console.warn('Roadmap layout error for entity:', entity.id, error);
				return { x: index * SPACING_X, y: 0 };
			}

		default:
			return { x: index * SPACING_X, y: 0 };
	}
}

// Transform lifecycle entity to svelte-flow node
export function transformToSvelteFlowNode(
	entity: Requirement | Task | ArchitectureDecision,
	index: number,
	layoutMode: 'network' | 'hierarchy' | 'timeline' | 'roadmap' = 'network',
	totalEntities: { requirements: number; tasks: number; architecture: number } = { requirements: 0, tasks: 0, architecture: 0 },
	allEntities?: (Requirement | Task | ArchitectureDecision)[]
): Node<NodeData> {
	const entityType = getEntityType(entity);
	const position = calculateNodePosition(entity, index, entityType, layoutMode, totalEntities, allEntities);

	// Determine node color based on entity type and status
	const getNodeStyle = () => {
		let baseColor: string;

		// Base color by entity type
		switch (entityType) {
			case 'requirement':
				baseColor = '#3b82f6'; // blue
				break;
			case 'task':
				baseColor = '#10b981'; // green
				break;
			case 'architecture':
				baseColor = '#8b5cf6'; // purple
				break;
		}

		// Simple style string like working test nodes
		return `background: ${baseColor}; color: white; padding: 20px; border: 2px solid ${baseColor}; border-radius: 8px; width: 200px; height: 80px;`;
	};

	// Node data structure for Svelte-Flow with full entity reference
	const nodeData = {
		label: entity.title,
		entityType,
		status: entity.status,
		priority: 'priority' in entity ? entity.priority : undefined,
		entityId: entity.id,
		entity: entity // Store full entity object for detail viewing
	};

	return {
		id: entity.id,
		type: 'default', // Will use custom node types later
		position,
		data: nodeData,
		style: getNodeStyle(),
		sourcePosition: 'right' as Position,
		targetPosition: 'left' as Position
	};
}

// Transform relationship to svelte-flow edge
export function transformToSvelteFlowEdge(
	sourceId: string,
	targetId: string,
	relationshipType: EdgeData['relationshipType'] = 'implements'
): Edge<EdgeData> {
	return {
		id: `${sourceId}-${targetId}`,
		source: sourceId,
		target: targetId,
		type: 'default',
		data: {
			relationshipType,
			source: sourceId,
			target: targetId
		},
		// Simplified high-visibility styling
		style: 'stroke: #10b981; stroke-width: 3px;',
		animated: false
	};
}

// Build complete graph from lifecycle data
export function buildSvelteFlowGraph(
	data: {
		requirements: Requirement[];
		tasks: Task[];
		architectureDecisions: ArchitectureDecision[];
	},
	layoutMode: 'network' | 'hierarchy' | 'timeline' | 'roadmap' = 'network',
	visibleEntityTypes: Set<'requirements' | 'tasks' | 'architecture'> = new Set(['requirements', 'tasks', 'architecture'])
) {
	const startTime = performance.now();

	const nodes: Node<NodeData>[] = [];
	const edges: Edge<EdgeData>[] = [];

	const totalEntities = {
		requirements: data.requirements.length,
		tasks: data.tasks.length,
		architecture: data.architectureDecisions.length
	};

	// Create combined entities array for timeline baseline calculation
	const allEntities: (Requirement | Task | ArchitectureDecision)[] = [
		...data.requirements,
		...data.tasks,
		...data.architectureDecisions
	];

	let globalIndex = 0;

	// Create nodes for requirements
	if (visibleEntityTypes.has('requirements')) {
		data.requirements.forEach((req) => {
			nodes.push(transformToSvelteFlowNode(req, globalIndex++, layoutMode, totalEntities, allEntities));
		});
	}

	// Create nodes for tasks
	if (visibleEntityTypes.has('tasks')) {
		data.tasks.forEach((task) => {
			nodes.push(transformToSvelteFlowNode(task, globalIndex++, layoutMode, totalEntities, allEntities));
		});
	}

	// Create nodes for architecture decisions
	if (visibleEntityTypes.has('architecture')) {
		data.architectureDecisions.forEach((arch) => {
			nodes.push(transformToSvelteFlowNode(arch, globalIndex++, layoutMode, totalEntities, allEntities));
		});
	}

	// Create edges based on actual relationships from MCP data
	// Tasks contain requirement_ids that link them to requirements
	if (visibleEntityTypes.has('requirements') && visibleEntityTypes.has('tasks')) {
		data.tasks.forEach((task) => {
			// Check if task has requirement relationships
			// Note: The MCP system stores relationships, but we need to extract them from the entity data
			// For now, we'll need to implement a proper relationship extraction method
			// TODO: Implement proper relationship data fetching from MCP trace methods
		});
	}

	// Parent-child task relationships
	if (visibleEntityTypes.has('tasks')) {
		data.tasks.forEach((task) => {
			if (task.parent_task_id) {
				// Create edge from parent task to child task
				edges.push(transformToSvelteFlowEdge(task.parent_task_id, task.id, 'depends'));
			}
		});
	}

	const endTime = performance.now();
	const buildTime = endTime - startTime;

	return {
		nodes,
		edges,
		buildTime,
		nodeCount: nodes.length,
		edgeCount: edges.length
	};
}