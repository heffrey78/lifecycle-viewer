<script lang="ts">
	import { currentTheme } from '$lib/theme';

	export let edge: {
		id: string;
		source: string;
		target: string;
		type: 'implements' | 'depends' | 'addresses';
		sourceX: number;
		sourceY: number;
		targetX: number;
		targetY: number;
	};

	function getEdgeColor(type: string): string {
		const edgeColorMap: Record<string, string> = {
			implements: '#10b981', // emerald
			depends: '#f59e0b', // amber
			addresses: '#8b5cf6' // violet
		};
		return edgeColorMap[type] || '#6b7280';
	}

	function getEdgeStyle(type: string): string {
		switch (type) {
			case 'implements':
				return 'solid';
			case 'depends':
				return 'dashed';
			case 'addresses':
				return 'dotted';
			default:
				return 'solid';
		}
	}

	function calculatePath(
		sourceX: number,
		sourceY: number,
		targetX: number,
		targetY: number
	): string {
		// Create a smooth curved path
		const dx = targetX - sourceX;
		const dy = targetY - sourceY;

		// Control points for bezier curve
		const cp1x = sourceX;
		const cp1y = sourceY + Math.abs(dy) * 0.5;
		const cp2x = targetX;
		const cp2y = targetY - Math.abs(dy) * 0.5;

		return `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`;
	}

	// Calculate arrowhead position and angle
	$: arrowX = edge.targetX;
	$: arrowY = edge.targetY;
	$: angle = Math.atan2(edge.targetY - edge.sourceY, edge.targetX - edge.sourceX) * (180 / Math.PI);

	// Calculate midpoint for label
	$: midX = (edge.sourceX + edge.targetX) / 2;
	$: midY = (edge.sourceY + edge.targetY) / 2;
</script>

<g class="relationship-edge">
	<!-- Edge path -->
	<path
		d={calculatePath(edge.sourceX, edge.sourceY, edge.targetX, edge.targetY)}
		fill="none"
		stroke={getEdgeColor(edge.type)}
		stroke-width="2"
		stroke-dasharray={getEdgeStyle(edge.type) === 'dashed'
			? '5,5'
			: getEdgeStyle(edge.type) === 'dotted'
				? '2,2'
				: 'none'}
		opacity="0.7"
		class="hover:opacity-100 transition-opacity duration-200"
	/>

	<!-- Arrowhead -->
	<g transform="translate({arrowX}, {arrowY}) rotate({angle})">
		<polygon points="-8,0 -16,-4 -16,4" fill={getEdgeColor(edge.type)} opacity="0.8" />
	</g>

	<!-- Edge label (relationship type) -->
	<g>
		<!-- Label background -->
		<rect
			x={midX - 25}
			y={midY - 8}
			width="50"
			height="16"
			rx="8"
			fill={$currentTheme.base.background}
			stroke={getEdgeColor(edge.type)}
			stroke-width="1"
			opacity="0.9"
		/>

		<!-- Label text -->
		<text
			x={midX}
			y={midY + 4}
			text-anchor="middle"
			fill={getEdgeColor(edge.type)}
			font-size="10"
			font-weight="500"
		>
			{edge.type}
		</text>
	</g>
</g>
