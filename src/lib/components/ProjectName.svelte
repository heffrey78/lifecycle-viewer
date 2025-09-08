<script lang="ts">
	import { onMount } from 'svelte';
	import { Database } from 'lucide-svelte';
	import { mcpClient } from '$lib/services/lifecycle-mcp-client.js';
	import { extractProjectName, getDisplayPath } from '$lib/utils/project-name.js';

	let currentDatabase: string | null = null;
	let loading = true;
	let error = '';

	$: projectName = extractProjectName(currentDatabase);
	$: displayPath = getDisplayPath(currentDatabase);

	async function fetchCurrentDatabase() {
		loading = true;
		error = '';

		try {
			if (!mcpClient.isConnected()) {
				await mcpClient.connect();
			}

			const response = await mcpClient.database.getCurrentDatabase();
			if (response.success) {
				currentDatabase = response.data;
			} else {
				error = response.error || 'Failed to get current database';
				currentDatabase = null;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			currentDatabase = null;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchCurrentDatabase();

		// Listen for database switch events (custom event)
		const handleDatabaseSwitch = () => {
			fetchCurrentDatabase();
		};

		// Add event listener for database switches
		window.addEventListener('database-switched', handleDatabaseSwitch);

		return () => {
			window.removeEventListener('database-switched', handleDatabaseSwitch);
		};
	});
</script>

<div class="flex items-center space-x-2 text-sm">
	<Database class="w-4 h-4 text-gray-400" />
	
	{#if loading}
		<span class="text-gray-500">Loading...</span>
	{:else if error}
		<span class="text-red-600" title="Error: {error}">Database Error</span>
	{:else if currentDatabase}
		<span 
			class="text-gray-700 font-medium cursor-help" 
			title="Database: {displayPath}"
		>
			{projectName}
		</span>
	{:else}
		<span class="text-gray-500">No Project</span>
	{/if}
</div>