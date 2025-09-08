<script lang="ts">
	import { onMount } from 'svelte';
	import { Database, FolderOpen, Save, AlertCircle, CheckCircle } from 'lucide-svelte';
	import { mcpClient } from '$lib/services/lifecycle-mcp-client.js';
	import ErrorNotification from '$lib/components/ErrorNotification.svelte';

	let currentDatabase = '';
	let selectedDatabase = '';
	let error = '';
	let loading = false;
	let success = false;
	let connectionStatus = 'disconnected';

	onMount(async () => {
		await loadCurrentDatabase();
		checkConnection();
	});

	async function loadCurrentDatabase() {
		try {
			const response = await mcpClient.database.getCurrentDatabase();
			if (response.success && response.data) {
				currentDatabase = response.data;
				selectedDatabase = response.data;
			}
		} catch (err) {
			console.warn('Failed to get current database:', err);
		}
	}

	function checkConnection() {
		connectionStatus = mcpClient.isConnected() ? 'connected' : 'disconnected';
	}

	async function browseForDatabase() {
		try {
			loading = true;
			const response = await mcpClient.database.pickDatabase();

			if (response.success && response.data) {
				selectedDatabase = response.data;
				console.log('Selected database file:', response.data);
			} else if (response.error === 'File selection cancelled') {
				console.log('File selection cancelled by user');
			} else {
				error = response.error || 'Failed to open file picker';
			}
		} catch (err) {
			console.error('Browse database error:', err);
			error = 'File picker unavailable. Please manually enter the full path to your database file.';
		} finally {
			loading = false;
		}
	}

	async function switchDatabase() {
		if (!selectedDatabase) {
			error = 'Please select a database file';
			return;
		}

		loading = true;
		error = '';
		success = false;

		try {
			console.log('🔄 Attempting database switch to:', selectedDatabase);
			const response = await mcpClient.database.switchDatabase(selectedDatabase);
			console.log('📥 Switch database response:', JSON.stringify(response, null, 2));

			if (response.success) {
				currentDatabase = selectedDatabase;
				success = true;
				setTimeout(() => (success = false), 3000);

				// Notify other components of database switch
				window.dispatchEvent(new CustomEvent('database-switched', { 
					detail: { databasePath: selectedDatabase } 
				}));

				// Refresh connection status
				setTimeout(() => {
					checkConnection();
				}, 1000);
			} else {
				// Handle object errors properly
				if (typeof response.error === 'object' && response.error !== null) {
					console.error('❌ Switch database object error:', response.error);
					error = (response.error as any).message || JSON.stringify(response.error);
				} else {
					error = response.error || 'Failed to switch database';
				}
				console.error('❌ Switch database failed:', error);
			}
		} catch (err) {
			console.error('❌ Switch database exception:', err);
			error = String(err);
		} finally {
			loading = false;
		}
	}

	function clearError() {
		error = '';
	}

	function retryConnection() {
		checkConnection();
		loadCurrentDatabase();
	}
</script>

<div class="max-w-4xl">
	<div class="bg-white rounded-lg shadow-md p-6">
		<div class="mb-8">
			<h1 class="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
			<p class="text-gray-600">Configure your lifecycle management system</p>
		</div>

		<!-- Connection Status -->
		<div
			class="mb-8 p-4 rounded-lg border {connectionStatus === 'connected'
				? 'border-green-200 bg-green-50'
				: 'border-red-200 bg-red-50'}"
		>
			<div class="flex items-center space-x-2">
				{#if connectionStatus === 'connected'}
					<CheckCircle class="w-5 h-5 text-green-600" />
					<span class="text-green-800 font-medium">Connected to MCP Server</span>
				{:else}
					<AlertCircle class="w-5 h-5 text-red-600" />
					<span class="text-red-800 font-medium">Disconnected from MCP Server</span>
				{/if}
			</div>
		</div>

		<!-- Error Display -->
		<ErrorNotification {error} onRetry={retryConnection} onDismiss={clearError} />

		<!-- Success Message -->
		{#if success}
			<div class="mb-6 p-4 rounded-lg border border-green-200 bg-green-50">
				<div class="flex items-center space-x-2">
					<CheckCircle class="w-5 h-5 text-green-600" />
					<span class="text-green-800">Database switched successfully</span>
				</div>
			</div>
		{/if}

		<!-- Database Configuration -->
		<div class="space-y-6">
			<h2 class="text-xl font-semibold text-gray-900 flex items-center">
				<Database class="w-6 h-6 mr-2" />
				Project Database
			</h2>

			<!-- Current Database -->
			<div class="space-y-2">
				<span class="block text-sm font-medium text-gray-700"> Current Database </span>
				<div
					class="p-3 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 font-mono"
				>
					{currentDatabase || 'No database selected'}
				</div>
			</div>

			<!-- Database Selection -->
			<div class="space-y-4">
				<label class="block text-sm font-medium text-gray-700" for="database-path">
					Select Database File
				</label>

				<div class="flex space-x-3">
					<input
						id="database-path"
						type="text"
						bind:value={selectedDatabase}
						placeholder="/path/to/lifecycle.db"
						class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
					/>
					<button
						type="button"
						on:click={browseForDatabase}
						class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					>
						<FolderOpen class="w-4 h-4 mr-1" />
						Browse
					</button>
				</div>

				<p class="text-sm text-gray-500">
					Select a lifecycle.db file to switch between different projects. The file will be
					validated before switching.
				</p>
			</div>

			<!-- Switch Button -->
			<div class="flex justify-end">
				<button
					type="button"
					on:click={switchDatabase}
					disabled={loading || !selectedDatabase || selectedDatabase === currentDatabase}
					class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if loading}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
						Switching...
					{:else}
						<Save class="w-4 h-4 mr-1" />
						Switch Database
					{/if}
				</button>
			</div>

			<!-- Information -->
			<div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
				<h3 class="text-sm font-medium text-blue-800 mb-2">How Database Switching Works</h3>
				<ul class="text-sm text-blue-700 space-y-1">
					<li>• Each database file represents a separate project</li>
					<li>• Switching will restart the MCP server with the new database</li>
					<li>• All requirements, tasks, and architecture decisions are project-specific</li>
					<li>• The file must exist and be a valid SQLite database</li>
				</ul>
			</div>
		</div>
	</div>
</div>
