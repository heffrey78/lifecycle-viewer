<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Wifi, WifiOff, Activity, Clock } from 'lucide-svelte';
	import { webSocketPushService } from '$lib/services/websocket-push-service.js';
	import { toolRegistryIntegration } from '$lib/services/tool-registry-integration.js';

	let pushStatus = $state({
		available: false,
		initialized: false,
		timeSinceLastHeartbeat: 0,
		activeListeners: 0,
		subscribedEvents: []
	});

	let connectionEvents = $state<Array<{ type: string; timestamp: Date; data?: any }>>([]);
	let showDetails = $state(false);

	// Unsubscribe functions for cleanup
	let unsubscribers: Array<() => void> = [];

	onMount(async () => {
		// Initialize the integration service which will setup push notifications
		await toolRegistryIntegration.initialize();

		// Subscribe to push notification events for demonstration
		const unsubscribeServerStatus = webSocketPushService.on('serverStatusChanged', (data) => {
			connectionEvents = [
				{ type: 'server_status', timestamp: new Date(), data },
				...connectionEvents.slice(0, 9) // Keep last 10 events
			];
		});
		unsubscribers.push(unsubscribeServerStatus);

		const unsubscribeToolsDiscovered = webSocketPushService.on('toolsDiscovered', (data) => {
			connectionEvents = [
				{ type: 'tools_discovered', timestamp: new Date(), data },
				...connectionEvents.slice(0, 9)
			];
		});
		unsubscribers.push(unsubscribeToolsDiscovered);

		const unsubscribeProjectData = webSocketPushService.on('projectDataChanged', (data) => {
			connectionEvents = [
				{ type: 'project_data', timestamp: new Date(), data },
				...connectionEvents.slice(0, 9)
			];
		});
		unsubscribers.push(unsubscribeProjectData);

		const unsubscribeConnectionLost = webSocketPushService.on('connectionLost', (data) => {
			connectionEvents = [
				{ type: 'connection_lost', timestamp: new Date(), data },
				...connectionEvents.slice(0, 9)
			];
		});
		unsubscribers.push(unsubscribeConnectionLost);

		const unsubscribeConnectionRestored = webSocketPushService.on('connectionRestored', (data) => {
			connectionEvents = [
				{ type: 'connection_restored', timestamp: new Date(), data },
				...connectionEvents.slice(0, 9)
			];
		});
		unsubscribers.push(unsubscribeConnectionRestored);

		// Update status periodically
		const statusInterval = setInterval(() => {
			pushStatus = webSocketPushService.getStats();
		}, 1000);

		// Cleanup interval on destroy
		unsubscribers.push(() => clearInterval(statusInterval));

		// Initial status update
		pushStatus = webSocketPushService.getStats();
	});

	onDestroy(() => {
		// Clean up all subscriptions
		unsubscribers.forEach((unsubscribe) => unsubscribe());
	});

	function formatTimestamp(date: Date): string {
		return date.toLocaleTimeString();
	}

	function getEventTypeColor(type: string): string {
		switch (type) {
			case 'server_status':
				return 'text-blue-600';
			case 'tools_discovered':
				return 'text-green-600';
			case 'project_data':
				return 'text-purple-600';
			case 'connection_lost':
				return 'text-red-600';
			case 'connection_restored':
				return 'text-emerald-600';
			default:
				return 'text-gray-600';
		}
	}

	function getStatusColor(): string {
		if (!pushStatus.available) return 'text-gray-500';
		if (!pushStatus.initialized) return 'text-yellow-500';
		if (pushStatus.timeSinceLastHeartbeat > 60000) return 'text-red-500';
		return 'text-green-500';
	}

	function getStatusText(): string {
		if (!pushStatus.available) return 'Push notifications not available';
		if (!pushStatus.initialized) return 'Initializing push notifications...';
		if (pushStatus.timeSinceLastHeartbeat > 60000) return 'Connection may be lost';
		return 'Push notifications active';
	}
</script>

<div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
	<div class="flex items-center justify-between">
		<div class="flex items-center space-x-3">
			<div class="flex-shrink-0">
				{#if pushStatus.initialized && pushStatus.timeSinceLastHeartbeat <= 60000}
					<Wifi class="h-5 w-5 {getStatusColor()}" />
				{:else}
					<WifiOff class="h-5 w-5 {getStatusColor()}" />
				{/if}
			</div>
			<div>
				<h3 class="text-sm font-medium text-gray-900">Push Notifications</h3>
				<p class="text-sm {getStatusColor()}">{getStatusText()}</p>
			</div>
		</div>

		<button
			type="button"
			onclick={() => (showDetails = !showDetails)}
			class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
		>
			{showDetails ? 'Hide Details' : 'Show Details'}
		</button>
	</div>

	{#if showDetails}
		<div class="mt-4 border-t border-gray-200 pt-4 space-y-4">
			<!-- Status Details -->
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<div class="text-gray-500">Status</div>
					<div class="font-medium">
						{pushStatus.initialized ? 'Initialized' : 'Not Initialized'}
					</div>
				</div>
				<div>
					<div class="text-gray-500">Active Listeners</div>
					<div class="font-medium">{pushStatus.activeListeners}</div>
				</div>
				<div>
					<div class="text-gray-500">Last Heartbeat</div>
					<div class="font-medium flex items-center space-x-1">
						<Clock class="h-4 w-4" />
						<span>{Math.round(pushStatus.timeSinceLastHeartbeat / 1000)}s ago</span>
					</div>
				</div>
				<div>
					<div class="text-gray-500">Subscribed Events</div>
					<div class="font-medium">{pushStatus.subscribedEvents.length}</div>
				</div>
			</div>

			<!-- Subscribed Events -->
			{#if pushStatus.subscribedEvents.length > 0}
				<div>
					<div class="text-sm text-gray-500 mb-2">Subscribed Events:</div>
					<div class="flex flex-wrap gap-2">
						{#each pushStatus.subscribedEvents as event}
							<span
								class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
							>
								{event}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Recent Events -->
			{#if connectionEvents.length > 0}
				<div>
					<div class="text-sm text-gray-500 mb-2 flex items-center space-x-1">
						<Activity class="h-4 w-4" />
						<span>Recent Events:</span>
					</div>
					<div class="space-y-2 max-h-48 overflow-y-auto">
						{#each connectionEvents as event}
							<div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-xs">
								<div class="flex items-center space-x-2">
									<span class="font-medium {getEventTypeColor(event.type)}">
										{event.type.replace('_', ' ')}
									</span>
									{#if event.data}
										<span class="text-gray-600">
											{JSON.stringify(event.data).slice(0, 50)}...
										</span>
									{/if}
								</div>
								<span class="text-gray-500">{formatTimestamp(event.timestamp)}</span>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="text-sm text-gray-500 italic">No push notification events received yet.</div>
			{/if}
		</div>
	{/if}
</div>
