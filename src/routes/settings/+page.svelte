<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Database,
		FolderOpen,
		Save,
		AlertCircle,
		CheckCircle,
		Settings,
		Key,
		Eye,
		EyeOff,
		TestTube,
		Trash2
	} from 'lucide-svelte';
	import { mcpClient } from '$lib/services/lifecycle-mcp-client.js';
	import ErrorNotification from '$lib/components/ErrorNotification.svelte';
	import FeatureFlagAdmin from '$lib/components/FeatureFlagAdmin.svelte';

	let currentDatabase = '';
	let selectedDatabase = '';
	let error = '';
	let loading = false;
	let success = false;
	let connectionStatus = 'disconnected';

	// Claude API Key state
	let apiKey = '';
	let isApiKeyConfigured = false;
	let showApiKey = false;
	let savingApiKey = false;
	let testingKey = false;
	let apiKeySuccess = '';
	let apiKeyError = '';

	// Redirect tracking
	let redirectSource: string | null = null;
	let redirectReason: string | null = null;

	onMount(async () => {
		await loadCurrentDatabase();
		await loadApiKeyStatus();
		checkConnection();

		// Check for redirect parameters
		const searchParams = $page.url.searchParams;
		redirectSource = searchParams.get('redirect');
		redirectReason = searchParams.get('reason');

		if (redirectReason === 'api-key-required') {
			// Scroll to API key section
			setTimeout(() => {
				const apiKeySection = document.getElementById('api-key-section');
				if (apiKeySection) {
					apiKeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
		}
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
				window.dispatchEvent(
					new CustomEvent('database-switched', {
						detail: { databasePath: selectedDatabase }
					})
				);

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

	// Claude API Key functions
	async function loadApiKeyStatus() {
		try {
			const response = await fetch('/api/config');
			if (response.ok) {
				const data = await response.json();
				isApiKeyConfigured = data.data.isApiKeyConfigured;
			}
		} catch (err) {
			console.warn('Failed to check API key status:', err);
		}
	}

	function validateApiKey(key: string): string | null {
		if (!key || !key.trim()) {
			return 'Please enter an API key';
		}

		const trimmedKey = key.trim();

		if (!trimmedKey.startsWith('sk-ant-')) {
			return 'Invalid API key format. Should start with "sk-ant-"';
		}

		if (trimmedKey.length < 20) {
			return 'API key appears to be too short';
		}

		return null;
	}

	async function saveApiKey() {
		apiKeyError = '';
		apiKeySuccess = '';

		const validationError = validateApiKey(apiKey);
		if (validationError) {
			apiKeyError = validationError;
			return;
		}

		savingApiKey = true;

		try {
			const response = await fetch('/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to save API key');
			}

			isApiKeyConfigured = true;

			// If user was redirected here, offer to return
			if (redirectSource && isApiKeyConfigured) {
				apiKeySuccess = 'API key saved successfully! You can now return to chat.';
				// Clear redirect parameters from URL
				redirectSource = null;
				redirectReason = null;
				window.history.replaceState({}, '', '/settings');
			} else {
				apiKeySuccess = 'API key saved successfully!';
			}

			apiKey = ''; // Clear the input for security
			showApiKey = false;

			// Auto-hide success message after 5 seconds if not redirected
			if (!redirectSource) {
				setTimeout(() => {
					apiKeySuccess = '';
				}, 3000);
			}
		} catch (err) {
			apiKeyError = `Failed to save API key: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			savingApiKey = false;
		}
	}

	async function testApiKey() {
		if (!apiKey) {
			apiKeyError = 'Please enter an API key to test';
			return;
		}

		const validationError = validateApiKey(apiKey);
		if (validationError) {
			apiKeyError = validationError;
			return;
		}

		testingKey = true;
		apiKeyError = '';
		apiKeySuccess = '';

		try {
			const response = await fetch('/api/config/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey })
			});

			const data = await response.json();

			if (data.success) {
				apiKeySuccess = data.message;
				setTimeout(() => {
					apiKeySuccess = '';
				}, 3000);
			} else {
				apiKeyError = data.message;
			}
		} catch (err) {
			apiKeyError = `API key test failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			testingKey = false;
		}
	}

	async function clearApiKey() {
		if (!confirm('Are you sure you want to remove the Claude API key from configuration?')) {
			return;
		}

		savingApiKey = true;
		apiKeyError = '';
		apiKeySuccess = '';

		try {
			const response = await fetch('/api/config', { method: 'DELETE' });

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to remove API key');
			}

			isApiKeyConfigured = false;
			apiKey = '';
			showApiKey = false;
			apiKeySuccess = 'API key removed successfully';
			setTimeout(() => {
				apiKeySuccess = '';
			}, 3000);
		} catch (err) {
			apiKeyError = `Failed to clear API key: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			savingApiKey = false;
		}
	}

	function toggleShowApiKey() {
		showApiKey = !showApiKey;
	}

	async function returnToRedirectSource() {
		if (redirectSource) {
			// Clear redirect parameters and navigate back
			await goto(`/${redirectSource}`);
		}
	}
</script>

<div class="max-w-4xl">
	<div class="bg-white rounded-lg shadow-md p-6">
		<div class="mb-8">
			<h1 class="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
			<p class="text-gray-600">Configure your lifecycle management system</p>
		</div>

		<!-- API Key Required Alert -->
		{#if redirectReason === 'api-key-required'}
			<div class="mb-6 p-4 rounded-lg border border-orange-200 bg-orange-50">
				<div class="flex items-start space-x-3">
					<AlertCircle class="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
					<div class="flex-1">
						<h3 class="text-sm font-medium text-orange-800 mb-1">
							Claude API Key Required
						</h3>
						<p class="text-sm text-orange-700">
							You need to configure a Claude API key to use the chat feature. Please enter your
							API key below to continue.
						</p>
					</div>
				</div>
			</div>
		{/if}

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

		<!-- Claude API Key Configuration -->
		<div class="mt-12 space-y-6" id="api-key-section">
			<h2 class="text-xl font-semibold text-gray-900 flex items-center">
				<Key class="w-6 h-6 mr-2" />
				Claude API Key
			</h2>

			<!-- Current Status -->
			<div class="space-y-2">
				<span class="block text-sm font-medium text-gray-700"> Configuration Status </span>
				<div
					class="p-3 rounded-md text-sm font-medium {isApiKeyConfigured
						? 'bg-green-50 border border-green-200 text-green-800'
						: 'bg-gray-50 border border-gray-300 text-gray-600'}"
				>
					{#if isApiKeyConfigured}
						<div class="flex items-center">
							<CheckCircle class="w-4 h-4 mr-2" />
							Claude API key is configured
						</div>
					{:else}
						<div class="flex items-center">
							<AlertCircle class="w-4 h-4 mr-2" />
							No Claude API key configured
						</div>
					{/if}
				</div>
			</div>

			<!-- API Key Input -->
			<div class="space-y-4">
				<label class="block text-sm font-medium text-gray-700" for="api-key">
					{isApiKeyConfigured ? 'Update API Key' : 'Enter API Key'}
				</label>

				<div class="flex space-x-3">
					<div class="flex-1 relative">
						<input
							id="api-key"
							type={showApiKey ? 'text' : 'password'}
							bind:value={apiKey}
							placeholder="sk-ant-..."
							class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
						/>
						<button
							type="button"
							on:click={toggleShowApiKey}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
							aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
						>
							{#if showApiKey}
								<EyeOff class="w-4 h-4" />
							{:else}
								<Eye class="w-4 h-4" />
							{/if}
						</button>
					</div>
				</div>

				<p class="text-sm text-gray-500">
					Your Claude API key will be encrypted and stored securely in your local configuration. Get
					your API key from
					<a
						href="https://console.anthropic.com/settings/keys"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-600 hover:text-blue-700 underline"
					>
						Anthropic Console
					</a>
				</p>
			</div>

			<!-- Action Buttons -->
			<div class="flex space-x-3">
				<button
					type="button"
					on:click={saveApiKey}
					disabled={savingApiKey || !apiKey}
					class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if savingApiKey}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
						Saving...
					{:else}
						<Save class="w-4 h-4 mr-1" />
						Save API Key
					{/if}
				</button>

				<button
					type="button"
					on:click={testApiKey}
					disabled={testingKey || !apiKey}
					class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if testingKey}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
						Testing...
					{:else}
						<TestTube class="w-4 h-4 mr-1" />
						Test API Key
					{/if}
				</button>

				{#if isApiKeyConfigured}
					<button
						type="button"
						on:click={clearApiKey}
						disabled={savingApiKey}
						class="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Trash2 class="w-4 h-4 mr-1" />
						Remove Key
					</button>
				{/if}
			</div>

			<!-- Success Message -->
			{#if apiKeySuccess}
				<div class="p-4 rounded-lg border border-green-200 bg-green-50">
					<div class="flex items-center space-x-2">
						<CheckCircle class="w-5 h-5 text-green-600" />
						<span class="text-green-800">{apiKeySuccess}</span>
					</div>
				</div>
			{/if}

			<!-- Return to Chat Button (shown after successful API key configuration) -->
			{#if redirectSource === 'chat' && isApiKeyConfigured}
				<div class="mt-4">
					<button
						type="button"
						on:click={returnToRedirectSource}
						class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
					>
						<CheckCircle class="w-4 h-4 mr-2" />
						Return to Chat
					</button>
				</div>
			{/if}

			<!-- Error Message -->
			{#if apiKeyError}
				<div class="p-4 rounded-lg border border-red-200 bg-red-50">
					<div class="flex items-center space-x-2">
						<AlertCircle class="w-5 h-5 text-red-600" />
						<span class="text-red-800">{apiKeyError}</span>
					</div>
				</div>
			{/if}

			<!-- Information Box -->
			<div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
				<h3 class="text-sm font-medium text-blue-800 mb-2">About Claude API Keys</h3>
				<ul class="text-sm text-blue-700 space-y-1">
					<li>• API keys enable the application to use Claude AI for various features</li>
					<li>• Your key is encrypted and stored locally - never sent to external servers</li>
					<li>• Keys should start with "sk-ant-" to be valid</li>
					<li>• Use the Test button to verify your key works before saving</li>
					<li>• You can get your API key from the Anthropic Console</li>
				</ul>
			</div>
		</div>

		<!-- Feature Flags Section -->
		<div class="mt-8">
			<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
				<Settings class="w-5 h-5 mr-2" />
				Feature Flags
			</h2>
			<div class="border border-gray-200 rounded-lg p-4">
				<FeatureFlagAdmin />
			</div>
		</div>
	</div>
</div>
