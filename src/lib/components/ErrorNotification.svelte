<script lang="ts">
	import { AlertTriangle, X, RefreshCw } from 'lucide-svelte';

	export let error: string = '';
	export let onRetry: (() => void) | null = null;
	export let onDismiss: (() => void) | null = null;
	export let type: 'error' | 'warning' = 'error';

	function getErrorMessage(error: string): {
		title: string;
		message: string;
		suggestions: string[];
	} {
		if (error.includes('Not connected to MCP server')) {
			return {
				title: 'MCP Server Connection Failed',
				message: 'Cannot connect to the lifecycle-mcp server.',
				suggestions: [
					'Ensure the lifecycle-mcp server is running',
					'Check that the server is listening on the correct port',
					'Verify your network connection'
				]
			};
		}

		if (error.includes('WebSocket connection') || error.includes('ws://')) {
			return {
				title: 'WebSocket Connection Error',
				message: 'Failed to establish WebSocket connection to MCP server.',
				suggestions: [
					'Start the lifecycle-mcp server: uv run server.py',
					'Check if port 3000 is available',
					'Ensure firewall is not blocking the connection'
				]
			};
		}

		if (error.includes('net::ERR_CONNECTION_REFUSED')) {
			return {
				title: 'Connection Refused',
				message: 'The MCP server is not accepting connections.',
				suggestions: [
					'Start the MCP server: cd lifecycle-mcp && uv run server.py',
					'Check server logs for startup errors',
					'Verify server configuration'
				]
			};
		}

		if (error.includes('404') || error.includes('Not Found')) {
			return {
				title: 'Resource Not Found',
				message: 'The requested resource could not be found.',
				suggestions: [
					'Check if the correct API endpoint is configured',
					'Verify the MCP server is running the expected version',
					'Review server routing configuration'
				]
			};
		}

		if (error.includes('timeout') || error.includes('Request timeout')) {
			return {
				title: 'Request Timeout',
				message: 'The request took too long to complete.',
				suggestions: [
					'Check network connectivity',
					'Verify server is responsive',
					'Try again in a few moments'
				]
			};
		}

		return {
			title: 'Unexpected Error',
			message: error,
			suggestions: [
				'Try refreshing the page',
				'Check browser console for more details',
				'Contact support if the problem persists'
			]
		};
	}

	$: errorInfo = getErrorMessage(error);
	$: bgColor = type === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
	$: textColor = type === 'error' ? 'text-red-800' : 'text-yellow-800';
	$: iconColor = type === 'error' ? 'text-red-500' : 'text-yellow-500';
</script>

{#if error}
	<div class="rounded-lg border p-4 mb-6 {bgColor}">
		<div class="flex items-start">
			<div class="flex-shrink-0">
				<AlertTriangle class="h-5 w-5 {iconColor}" />
			</div>
			<div class="ml-3 flex-1">
				<h3 class="text-lg font-semibold {textColor}">{errorInfo.title}</h3>
				<p class="{textColor} mt-2">{errorInfo.message}</p>

				{#if errorInfo.suggestions.length > 0}
					<div class="mt-4">
						<h4 class="text-sm font-medium {textColor}">Troubleshooting Steps:</h4>
						<ul class="mt-2 list-disc list-inside text-sm {textColor} space-y-1">
							{#each errorInfo.suggestions as suggestion}
								<li>{suggestion}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="mt-4 flex space-x-3">
					{#if onRetry}
						<button
							type="button"
							class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
							on:click={onRetry}
						>
							<RefreshCw class="w-4 h-4 mr-1" />
							Retry
						</button>
					{/if}
					{#if onDismiss}
						<button
							type="button"
							class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
							on:click={onDismiss}
						>
							Dismiss
						</button>
					{/if}
				</div>
			</div>

			{#if onDismiss}
				<div class="flex-shrink-0 ml-4">
					<button
						type="button"
						class="rounded-md {bgColor} {textColor} hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
						on:click={onDismiss}
					>
						<span class="sr-only">Close</span>
						<X class="h-5 w-5" />
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
