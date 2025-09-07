<script lang="ts">
	import { onMount } from 'svelte';
	import { Wifi, WifiOff, AlertCircle } from 'lucide-svelte';
	import { mcpClient } from '$lib/services/mcp-client.js';

	export let connected = false;
	export let error = '';

	let connectionChecking = false;

	async function checkConnection() {
		connectionChecking = true;
		try {
			if (!mcpClient.isConnected()) {
				await mcpClient.connect();
			}
			connected = mcpClient.isConnected();
			if (connected) {
				error = '';
			}
		} catch (e) {
			connected = false;
			error = e instanceof Error ? e.message : String(e);
		} finally {
			connectionChecking = false;
		}
	}

	onMount(() => {
		connected = mcpClient.isConnected();

		// Check connection periodically
		const interval = setInterval(() => {
			connected = mcpClient.isConnected();
			if (!connected) {
				error = 'Connection lost to MCP server';
			} else {
				error = '';
			}
		}, 2000);

		return () => clearInterval(interval);
	});

	function getStatusColor() {
		if (connectionChecking) return 'text-yellow-500';
		if (connected) return 'text-green-500';
		return 'text-red-500';
	}

	function getStatusText() {
		if (connectionChecking) return 'Connecting...';
		if (connected) return 'Connected';
		return 'Disconnected';
	}

	function getStatusIcon() {
		if (connectionChecking) return AlertCircle;
		if (connected) return Wifi;
		return WifiOff;
	}
</script>

<div class="flex items-center space-x-2 px-3 py-2 text-sm">
	<svelte:component this={getStatusIcon()} class="w-4 h-4 {getStatusColor()}" />
	<span class="text-gray-600">{getStatusText()}</span>
	{#if !connected && !connectionChecking}
		<button
			type="button"
			on:click={checkConnection}
			class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
		>
			Retry
		</button>
	{/if}
</div>

{#if error && !connected}
	<div class="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200">
		<div class="flex items-start space-x-1">
			<AlertCircle class="w-3 h-3 mt-0.5 flex-shrink-0" />
			<span class="leading-tight">{error}</span>
		</div>
	</div>
{/if}
