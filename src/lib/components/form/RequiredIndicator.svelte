<script lang="ts">
	export let inline: boolean = true;
</script>

<span
	class="required-indicator text-red-500 font-medium"
	class:inline
	class:ml-1={inline}
	aria-label="required"
	title="This field is required"
>
	*
</span>

<style>
	.required-indicator {
		user-select: none;
	}

	.inline {
		display: inline;
	}

	:global(.theme-dark) .text-red-500 {
		color: #f87171;
	}

	:global(.theme-high-contrast) .text-red-500 {
		color: #dc2626;
		font-weight: 800;
		font-size: 1.1em;
	}
</style>
