<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import { masterPasswordService } from '$lib/services/master-password-service';
	import MasterPasswordSetup from './MasterPasswordSetup.svelte';

	interface Props {
		isConfigured: boolean;
		onConfigure?: (apiKey: string) => void;
	}

	let { isConfigured, onConfigure }: Props = $props();

	const dispatch = createEventDispatcher<{
		configure: { apiKey: string };
	}>();

	let apiKey = $state('');
	let showConfig = $state(!isConfigured);
	let isSubmitting = $state(false);
	let error = $state('');
	let showMasterPasswordSetup = $state(false);
	let masterPasswordIsFirstTime = $state(false);
	let pendingApiKey = $state('');

	async function handleSubmit() {
		if (!apiKey.trim()) {
			error = 'Please enter your Claude API key';
			return;
		}

		if (!apiKey.startsWith('sk-ant-')) {
			error = 'Invalid API key format. Should start with "sk-ant-"';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			// Check if master password is available
			const isUnlocked = await masterPasswordService.isUnlocked();

			if (!isUnlocked) {
				// Store the API key temporarily and show master password setup
				pendingApiKey = apiKey.trim();
				apiKey = ''; // Clear for security

				// Check if this is first time setup by checking if settings exist
				const hasSettings = await masterPasswordService.hasSettingsConfigured();
				masterPasswordIsFirstTime = !hasSettings;
				console.log(
					'🔐 hasSettings:',
					hasSettings,
					'masterPasswordIsFirstTime:',
					masterPasswordIsFirstTime
				);
				showMasterPasswordSetup = true;
				return;
			}

			// Master password is unlocked, proceed with API key storage
			await proceedWithApiKeyStorage(apiKey.trim());
		} catch (err) {
			error = err instanceof Error ? err.message : 'Configuration failed';
		} finally {
			isSubmitting = false;
		}
	}

	async function proceedWithApiKeyStorage(keyToStore: string) {
		try {
			onConfigure?.(keyToStore);
			dispatch('configure', { apiKey: keyToStore });
			showConfig = false;
			apiKey = ''; // Clear for security
			pendingApiKey = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Configuration failed';
		}
	}

	async function handleMasterPasswordSuccess(event: CustomEvent) {
		showMasterPasswordSetup = false;

		if (pendingApiKey) {
			// Master password is now set up/unlocked, proceed with API key storage
			await proceedWithApiKeyStorage(pendingApiKey);
		}
	}

	function handleMasterPasswordUnlock() {
		showMasterPasswordSetup = false;

		if (pendingApiKey) {
			// Master password is now unlocked, proceed with API key storage
			proceedWithApiKeyStorage(pendingApiKey);
		}
	}

	function handleMasterPasswordClose() {
		showMasterPasswordSetup = false;
		pendingApiKey = '';
		// Restore the API key to the input for user to try again
		if (pendingApiKey) {
			apiKey = pendingApiKey;
			pendingApiKey = '';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}
</script>

{#if showConfig}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div
			class="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6"
			style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base
				.border};"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold" style="color: {$currentTheme.base.foreground};">
					Configure Claude API
				</h2>
				{#if isConfigured}
					<button
						onclick={() => (showConfig = false)}
						class="text-gray-500 hover:text-gray-700"
						aria-label="Close"
					>
						✕
					</button>
				{/if}
			</div>

			<div class="space-y-4">
				<div>
					<p class="text-sm mb-2" style="color: {$currentTheme.base.muted};">
						Enter your Claude API key to enable AI chat functionality.
					</p>
					<p class="text-xs mb-4" style="color: {$currentTheme.base.muted};">
						Get your API key from the <a
							href="https://console.anthropic.com/"
							target="_blank"
							class="text-blue-600 hover:text-blue-800 underline">Anthropic Console</a
						>
					</p>
				</div>

				<div>
					<label
						for="api-key"
						class="block text-sm font-medium mb-2"
						style="color: {$currentTheme.base.foreground};"
					>
						API Key
					</label>
					<input
						id="api-key"
						type="password"
						bind:value={apiKey}
						onkeydown={handleKeydown}
						placeholder="sk-ant-..."
						disabled={isSubmitting}
						class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
						style="background-color: {$currentTheme.base.background};
							   color: {$currentTheme.base.foreground};
							   border-color: {error ? '#ef4444' : $currentTheme.base.border};"
					/>
					{#if error}
						<p class="text-sm text-red-500 mt-1">{error}</p>
					{/if}
				</div>

				<div class="flex justify-end space-x-3 pt-4">
					{#if isConfigured}
						<button
							onclick={() => (showConfig = false)}
							disabled={isSubmitting}
							class="px-4 py-2 text-sm border rounded-lg transition-colors hover:bg-opacity-10 disabled:opacity-50"
							style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base.muted};"
						>
							Cancel
						</button>
					{/if}
					<button
						onclick={handleSubmit}
						disabled={!apiKey.trim() || isSubmitting}
						class="px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 {apiKey.trim() &&
						!isSubmitting
							? 'bg-blue-600 hover:bg-blue-700 text-white'
							: 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
					>
						{isSubmitting ? 'Configuring...' : 'Configure'}
					</button>
				</div>

				<div class="text-xs" style="color: {$currentTheme.base.muted};">
					<p>
						🔒 Your API key is encrypted with a master password and stored securely in the database.
					</p>
				</div>
			</div>
		</div>
	</div>
{:else if isConfigured}
	<button
		onclick={() => (showConfig = true)}
		class="text-sm text-blue-600 hover:text-blue-800 underline"
		title="Reconfigure Claude API"
	>
		⚙️ API Settings
	</button>
{/if}

<!-- Master Password Setup Modal -->
<MasterPasswordSetup
	isOpen={showMasterPasswordSetup}
	isFirstTime={masterPasswordIsFirstTime}
	on:success={handleMasterPasswordSuccess}
	on:unlock={handleMasterPasswordUnlock}
	on:close={handleMasterPasswordClose}
/>
