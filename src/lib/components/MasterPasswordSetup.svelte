<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import { masterPasswordService } from '$lib/services/master-password-service';

	interface Props {
		isOpen: boolean;
		isFirstTime?: boolean;
	}

	let { isOpen, isFirstTime = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		success: { backupCodes?: string[] };
		unlock: {};
		close: {};
	}>();

	let password = $state('');
	let confirmPassword = $state('');
	let backupCode = $state('');
	let rememberMe = $state(false);
	let isSubmitting = $state(false);
	let error = $state('');
	let mode = $state<'setup' | 'unlock' | 'backup'>(isFirstTime ? 'setup' : 'unlock');

	// Debug logging
	console.log('🔐 MasterPasswordSetup - isFirstTime:', isFirstTime, 'mode:', mode);

	// Make mode reactive to isFirstTime prop changes
	$effect(() => {
		const newMode = isFirstTime ? 'setup' : 'unlock';
		if (mode !== newMode) {
			mode = newMode;
			console.log(
				'🔐 MasterPasswordSetup - mode updated to:',
				newMode,
				'based on isFirstTime:',
				isFirstTime
			);
		}
	});
	let backupCodes = $state<string[]>([]);
	let showBackupCodes = $state(false);

	async function handleSetup() {
		if (!password.trim()) {
			error = 'Please enter a master password';
			return;
		}

		if (password.length < 8) {
			error = 'Master password must be at least 8 characters';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const result = await masterPasswordService.setupMasterPassword(password, rememberMe);
			backupCodes = result.backupCodes;
			showBackupCodes = true;
			password = '';
			confirmPassword = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Setup failed';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleUnlock() {
		if (!password.trim()) {
			error = 'Please enter your master password';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const success = await masterPasswordService.unlock(password, rememberMe);
			if (success) {
				password = '';
				dispatch('unlock');
			} else {
				error = 'Incorrect master password';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unlock failed';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleBackupCodeUnlock() {
		if (!backupCode.trim()) {
			error = 'Please enter a backup code';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const success = await masterPasswordService.unlockWithBackupCode(backupCode);
			if (success) {
				backupCode = '';
				dispatch('unlock');
			} else {
				error = 'Invalid or used backup code';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Backup code unlock failed';
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (mode === 'setup') {
				handleSetup();
			} else if (mode === 'unlock') {
				handleUnlock();
			} else if (mode === 'backup') {
				handleBackupCodeUnlock();
			}
		}
	}

	function handleBackupCodesAcknowledged() {
		showBackupCodes = false;
		dispatch('success', { backupCodes });
	}

	function copyBackupCodes() {
		const codesText = backupCodes.join('\n');
		navigator.clipboard.writeText(codesText);
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div
			class="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6"
			style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base
				.border};"
		>
			{#if showBackupCodes}
				<!-- Backup Codes Display -->
				<div class="text-center">
					<h2 class="text-lg font-semibold mb-4" style="color: {$currentTheme.base.foreground};">
						🔐 Save Your Backup Codes
					</h2>
					<p class="text-sm mb-4" style="color: {$currentTheme.base.muted};">
						Store these backup codes in a safe place. You can use them to recover access if you
						forget your master password.
					</p>

					<div
						class="bg-gray-50 p-4 rounded-lg mb-4 font-mono text-sm"
						style="background-color: {$currentTheme.base.border}; color: {$currentTheme.base
							.foreground};"
					>
						{#each backupCodes as code}
							<div class="mb-1">{code}</div>
						{/each}
					</div>

					<div class="flex justify-center space-x-3">
						<button
							onclick={copyBackupCodes}
							class="px-4 py-2 text-sm border rounded-lg transition-colors hover:bg-opacity-10"
							style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base.muted};"
						>
							📋 Copy Codes
						</button>
						<button
							onclick={handleBackupCodesAcknowledged}
							class="px-4 py-2 text-sm rounded-lg transition-colors bg-blue-600 hover:bg-blue-700 text-white"
						>
							I've Saved These
						</button>
					</div>
				</div>
			{:else}
				<!-- Master Password Form -->
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-lg font-semibold" style="color: {$currentTheme.base.foreground};">
						{#if mode === 'setup'}
							🔐 Set Up Master Password
						{:else if mode === 'unlock'}
							🔓 Unlock Secure Storage
						{:else}
							🆘 Use Backup Code
						{/if}
					</h2>
					{#if !isFirstTime}
						<button
							onclick={() => dispatch('close')}
							class="text-gray-500 hover:text-gray-700"
							aria-label="Close"
						>
							✕
						</button>
					{/if}
				</div>

				<div class="space-y-4">
					{#if mode === 'setup'}
						<div>
							<p class="text-sm mb-4" style="color: {$currentTheme.base.muted};">
								Create a master password to securely store your API key. This password will be
								required to access your stored credentials.
							</p>
						</div>

						<div>
							<label
								for="password"
								class="block text-sm font-medium mb-2"
								style="color: {$currentTheme.base.foreground};"
							>
								Master Password
							</label>
							<input
								id="password"
								type="password"
								bind:value={password}
								onkeydown={handleKeydown}
								placeholder="Enter a secure password..."
								disabled={isSubmitting}
								class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
								style="background-color: {$currentTheme.base.background};
									   color: {$currentTheme.base.foreground};
									   border-color: {error ? '#ef4444' : $currentTheme.base.border};"
							/>
						</div>

						<div>
							<label
								for="confirm-password"
								class="block text-sm font-medium mb-2"
								style="color: {$currentTheme.base.foreground};"
							>
								Confirm Password
							</label>
							<input
								id="confirm-password"
								type="password"
								bind:value={confirmPassword}
								onkeydown={handleKeydown}
								placeholder="Confirm your password..."
								disabled={isSubmitting}
								class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
								style="background-color: {$currentTheme.base.background};
									   color: {$currentTheme.base.foreground};
									   border-color: {error ? '#ef4444' : $currentTheme.base.border};"
							/>
						</div>

						<div class="flex items-center">
							<input
								id="remember-me"
								type="checkbox"
								bind:checked={rememberMe}
								class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
							/>
							<label
								for="remember-me"
								class="ml-2 text-sm"
								style="color: {$currentTheme.base.foreground};"
							>
								Remember me for 7 days
							</label>
						</div>
					{:else if mode === 'unlock'}
						<div>
							<p class="text-sm mb-4" style="color: {$currentTheme.base.muted};">
								Enter your master password to access your securely stored API key.
							</p>
						</div>

						<div>
							<label
								for="password"
								class="block text-sm font-medium mb-2"
								style="color: {$currentTheme.base.foreground};"
							>
								Master Password
							</label>
							<input
								id="password"
								type="password"
								bind:value={password}
								onkeydown={handleKeydown}
								placeholder="Enter your master password..."
								disabled={isSubmitting}
								class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
								style="background-color: {$currentTheme.base.background};
									   color: {$currentTheme.base.foreground};
									   border-color: {error ? '#ef4444' : $currentTheme.base.border};"
							/>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center">
								<input
									id="remember-me"
									type="checkbox"
									bind:checked={rememberMe}
									class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<label
									for="remember-me"
									class="ml-2 text-sm"
									style="color: {$currentTheme.base.foreground};"
								>
									Remember me for 7 days
								</label>
							</div>
							<button
								onclick={() => (mode = 'backup')}
								class="text-sm text-blue-600 hover:text-blue-800 underline"
							>
								Use backup code
							</button>
						</div>
					{:else if mode === 'backup'}
						<div>
							<p class="text-sm mb-4" style="color: {$currentTheme.base.muted};">
								Enter one of your backup codes to recover access to your secure storage.
							</p>
						</div>

						<div>
							<label
								for="backup-code"
								class="block text-sm font-medium mb-2"
								style="color: {$currentTheme.base.foreground};"
							>
								Backup Code
							</label>
							<input
								id="backup-code"
								type="text"
								bind:value={backupCode}
								onkeydown={handleKeydown}
								placeholder="XX-XX-XX-XX"
								disabled={isSubmitting}
								class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
								style="background-color: {$currentTheme.base.background};
									   color: {$currentTheme.base.foreground};
									   border-color: {error ? '#ef4444' : $currentTheme.base.border};"
							/>
						</div>

						<div class="flex justify-start">
							<button
								onclick={() => (mode = 'unlock')}
								class="text-sm text-blue-600 hover:text-blue-800 underline"
							>
								← Back to password
							</button>
						</div>
					{/if}

					{#if error}
						<p class="text-sm text-red-500">{error}</p>
					{/if}

					<div class="flex justify-end space-x-3 pt-4">
						{#if !isFirstTime && mode !== 'setup'}
							<button
								onclick={() => dispatch('close')}
								disabled={isSubmitting}
								class="px-4 py-2 text-sm border rounded-lg transition-colors hover:bg-opacity-10 disabled:opacity-50"
								style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base
									.muted};"
							>
								Cancel
							</button>
						{/if}
						<button
							onclick={() => {
								if (mode === 'setup') handleSetup();
								else if (mode === 'unlock') handleUnlock();
								else if (mode === 'backup') handleBackupCodeUnlock();
							}}
							disabled={isSubmitting ||
								(mode === 'setup' && (!password.trim() || !confirmPassword.trim())) ||
								(mode === 'unlock' && !password.trim()) ||
								(mode === 'backup' && !backupCode.trim())}
							class="px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 {((mode ===
								'setup' &&
								password.trim() &&
								confirmPassword.trim()) ||
								(mode === 'unlock' && password.trim()) ||
								(mode === 'backup' && backupCode.trim())) &&
							!isSubmitting
								? 'bg-blue-600 hover:bg-blue-700 text-white'
								: 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
						>
							{#if isSubmitting}
								{mode === 'setup'
									? 'Setting up...'
									: mode === 'unlock'
										? 'Unlocking...'
										: 'Checking...'}
							{:else}
								{mode === 'setup' ? 'Set Up' : mode === 'unlock' ? 'Unlock' : 'Use Code'}
							{/if}
						</button>
					</div>

					<div class="text-xs" style="color: {$currentTheme.base.muted};">
						<p>
							🔒 Your master password is used to encrypt your API key locally. We never see or store
							your master password.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
