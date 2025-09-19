<script lang="ts">
	import RelationshipVisualization from '$lib/components/RelationshipVisualization.svelte';
</script>

<div class="relationships-container">
	<RelationshipVisualization />
</div>

<style>
	.relationships-container {
		/* Calculate height: full viewport minus sidebar header and main layout header */
		height: calc(100vh - 9rem);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* Responsive design */
	@media (max-width: 1024px) {
		.relationships-container {
			/* Adjust for smaller header on tablet/mobile */
			height: calc(100vh - 7rem);
		}
	}

	@media (max-width: 640px) {
		.relationships-container {
			/* Account for mobile layout differences */
			height: calc(100vh - 6rem);
		}
	}
</style>
