<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import type { Requirement, Task, ArchitectureDecision } from '$lib/types/lifecycle';

	export let node: {
		id: string;
		type: 'requirement' | 'task' | 'architecture';
		title: string;
		status: string;
		priority?: string;
		x: number;
		y: number;
		width: number;
		height: number;
		data: Requirement | Task | ArchitectureDecision;
	};

	const dispatch = createEventDispatcher<{
		dragstart: void;
		drag: { dx: number; dy: number };
		click: { node: typeof node };
	}>();

	let isDragging = false;
	let dragStart = { x: 0, y: 0 };

	function getStatusColor(status: string): string {
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

	function getTypeColor(type: string): string {
		const typeColorMap: Record<string, string> = {
			requirement: '#3b82f6', // blue
			task: '#10b981', // emerald
			architecture: '#8b5cf6' // violet
		};
		return typeColorMap[type] || '#6b7280';
	}

	function getPriorityColor(priority?: string): string {
		if (!priority) return '#6b7280';
		const priorityColorMap: Record<string, string> = {
			P0: '#dc2626', // red-600
			P1: '#ea580c', // orange-600
			P2: '#ca8a04', // yellow-600
			P3: '#16a34a' // green-600
		};
		return priorityColorMap[priority] || '#6b7280';
	}

	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength - 3) + '...';
	}

	function handleMouseDown(event: MouseEvent) {
		isDragging = true;
		dragStart = { x: event.clientX, y: event.clientY };
		dispatch('dragstart');
		event.stopPropagation();
	}

	function handleMouseMove(event: MouseEvent) {
		if (isDragging) {
			const dx = event.clientX - dragStart.x;
			const dy = event.clientY - dragStart.y;
			dragStart = { x: event.clientX, y: event.clientY };

			// Throttle drag updates for better performance
			requestAnimationFrame(() => {
				dispatch('drag', { dx, dy });
			});
		}
	}

	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
		}
	}

	function handleClick() {
		if (!isDragging) {
			dispatch('click', { node });
		}
	}
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<!-- Node Container -->
<g
	transform="translate({node.x}, {node.y})"
	class="cursor-pointer"
	role="button"
	tabindex="0"
	aria-label="{node.type}: {node.title} - {node.status}"
	on:mousedown={handleMouseDown}
	on:click={handleClick}
	on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
	<!-- Node Background -->
	<rect
		width={node.width}
		height={node.height}
		rx="8"
		fill={$currentTheme.base.background}
		stroke={getTypeColor(node.type)}
		stroke-width="2"
		class="transition-all duration-200"
		class:shadow-lg={isDragging}
	/>

	<!-- Status Indicator Bar -->
	<rect x="0" y="0" width={node.width} height="4" rx="8" fill={getStatusColor(node.status)} />

	<!-- Priority Indicator (if applicable) -->
	{#if node.priority}
		<circle cx={node.width - 15} cy="15" r="6" fill={getPriorityColor(node.priority)} />
		<text
			x={node.width - 15}
			y="19"
			text-anchor="middle"
			fill="white"
			font-size="10"
			font-weight="bold"
		>
			{node.priority.substring(1)}
		</text>
	{/if}

	<!-- Type Icon/Indicator -->
	<rect x="8" y="12" width="20" height="16" rx="4" fill={getTypeColor(node.type)} opacity="0.2" />
	<text
		x="18"
		y="23"
		text-anchor="middle"
		fill={getTypeColor(node.type)}
		font-size="10"
		font-weight="bold"
	>
		{node.type === 'requirement' ? 'REQ' : node.type === 'task' ? 'TSK' : 'ADR'}
	</text>

	<!-- Title -->
	<text x="35" y="23" fill={$currentTheme.base.foreground} font-size="14" font-weight="600">
		{truncateText(node.title, 20)}
	</text>

	<!-- ID -->
	<text x="8" y="42" fill={$currentTheme.base.muted} font-size="11" font-family="monospace">
		{node.id}
	</text>

	<!-- Status -->
	<text x="8" y="58" fill={getStatusColor(node.status)} font-size="11" font-weight="500">
		{node.status}
	</text>

	<!-- Additional metadata for different entity types -->
	{#if node.type === 'requirement'}
		<text
			x={node.width - 8}
			y="58"
			text-anchor="end"
			fill={$currentTheme.base.muted}
			font-size="10"
		>
			{(node.data as Requirement).type}
		</text>
	{:else if node.type === 'task'}
		{#if (node.data as Task).effort}
			<text
				x={node.width - 8}
				y="58"
				text-anchor="end"
				fill={$currentTheme.base.muted}
				font-size="10"
			>
				{(node.data as Task).effort}
			</text>
		{/if}
	{:else if node.type === 'architecture'}
		<text
			x={node.width - 8}
			y="58"
			text-anchor="end"
			fill={$currentTheme.base.muted}
			font-size="10"
		>
			{(node.data as ArchitectureDecision).type}
		</text>
	{/if}

	<!-- Hover Effect -->
	<rect
		width={node.width}
		height={node.height}
		rx="8"
		fill="transparent"
		class="hover:fill-gray-100 hover:fill-opacity-10 transition-all duration-200"
	/>
</g>
