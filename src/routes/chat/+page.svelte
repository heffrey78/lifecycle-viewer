<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentTheme } from '$lib/theme';
	import ChatInterface from '$lib/components/ChatInterface.svelte';
	import ConversationManager from '$lib/components/ConversationManager.svelte';
	import { chatService } from '$lib/services/chat-service';
	import type { ChatMessage, ConversationThread } from '$lib/types/chat';

	// Reactive stores from chat service
	let messages = $state<ChatMessage[]>([]);
	let connectionStatus = $state<'connected' | 'disconnected' | 'checking'>('checking');
	let isStreaming = $derived(messages.some((m) => m.isStreaming));
	let currentThread = $state<ConversationThread | null>(null);
	let showConversationManager = $state(false);
	let apiKeyCheckComplete = $state(false);

	// Subscribe to chat service stores
	onMount(() => {
		// Async function to handle API key check and redirect
		const checkApiKeyAndInitialize = async () => {
			// Check API key configuration first to prevent redirect loops
			if (!apiKeyCheckComplete) {
				try {
					const response = await fetch('/api/config');
					const data = await response.json();
					const isConfigured = data.data?.isApiKeyConfigured || false;
					apiKeyCheckComplete = true;

					if (!isConfigured) {
						console.log('No API key configured, redirecting to settings...');
						// Redirect to settings with reason
						await goto('/settings?redirect=chat&reason=api-key-required');
						return; // Exit early to prevent further initialization
					}
				} catch (err) {
					console.error('Failed to check API key status:', err);
					apiKeyCheckComplete = true;
					// Continue initialization even if check fails
				}
			}

			// Initialize chat service subscriptions
			const unsubscribeMessages = chatService.messagesStore.subscribe((msgs) => {
				messages = msgs;
			});

			const unsubscribeStatus = chatService.connectionStatusStore.subscribe((status) => {
				connectionStatus = status;
			});

			// Get current thread
			currentThread = chatService.getCurrentThread();

			// Store cleanup functions
			return () => {
				unsubscribeMessages();
				unsubscribeStatus();
			};
		};

		// Start async initialization
		let cleanup: (() => void) | undefined;
		checkApiKeyAndInitialize().then((cleanupFn) => {
			cleanup = cleanupFn;
		});

		// Return cleanup function
		return () => {
			if (cleanup) {
				cleanup();
			}
		};
	});

	// Handle chat events
	async function handleSendMessage(event: CustomEvent<{ content: string; files?: File[] }>) {
		try {
			const { content, files } = event.detail;
			// Pass files directly to chat service for proper processing
			await chatService.sendMessage(content, files);
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	async function handleClearChat() {
		await chatService.clearHistory();
		currentThread = chatService.getCurrentThread();
	}

	async function handleRetryMessage(event: CustomEvent<{ messageId: string }>) {
		try {
			await chatService.retryMessage(event.detail.messageId);
		} catch (error) {
			console.error('Failed to retry message:', error);
		}
	}

	function handleConversationManagerClose() {
		showConversationManager = false;
		// Refresh current thread in case it changed
		currentThread = chatService.getCurrentThread();
	}
</script>

<svelte:head>
	<title>Chat - Lifecycle Viewer</title>
</svelte:head>

<div class="flex flex-col h-full max-w-4xl mx-auto">
	<!-- Page Header -->
	<div class="p-6 border-b" style="border-color: {$currentTheme.base.border};">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-3">
					<div>
						<h1 class="text-2xl font-bold mb-2" style="color: {$currentTheme.base.foreground};">
							Project Chat Assistant
						</h1>
						<p style="color: {$currentTheme.base.muted};">
							{#if currentThread}
								{currentThread.title}
							{:else}
								Have natural conversations about your project requirements, tasks, and architecture.
							{/if}
						</p>
					</div>
					<button
						onclick={() => (showConversationManager = true)}
						class="p-2 rounded-lg transition-colors hover:bg-opacity-10"
						style="color: {$currentTheme.base.muted};"
						title="Manage conversations"
					>
						💬
					</button>
				</div>
			</div>

			<!-- Chat Stats and Configuration -->
			<div class="flex items-center gap-6">
				<div class="flex gap-4 text-sm">
					<div class="text-center">
						<div class="text-lg font-semibold" style="color: {$currentTheme.base.foreground};">
							{messages.length}
						</div>
						<div style="color: {$currentTheme.base.muted};">Messages</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-semibold" style="color: {$currentTheme.base.foreground};">
							{messages.filter((m) => m.role === 'user').length}
						</div>
						<div style="color: {$currentTheme.base.muted};">Questions</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Chat Interface -->
	<div class="flex-1 min-h-0">
		<ChatInterface
			{messages}
			{isStreaming}
			{connectionStatus}
			maxHeight="100%"
			placeholder="Ask about your requirements, tasks, or architecture..."
			on:sendMessage={handleSendMessage}
			on:clearChat={handleClearChat}
			on:retryMessage={handleRetryMessage}
		/>
	</div>

	<!-- Help Section -->
	{#if messages.length === 0}
		<div class="p-6 border-t" style="border-color: {$currentTheme.base.border};">
			<div class="grid md:grid-cols-3 gap-4">
				<div class="p-4 rounded-lg border" style="border-color: {$currentTheme.base.border};">
					<h3 class="font-semibold mb-2" style="color: {$currentTheme.base.foreground};">
						💡 Ask about Requirements
					</h3>
					<p class="text-sm" style="color: {$currentTheme.base.muted};">
						"Show me all high priority requirements" or "What requirements are still in draft?"
					</p>
				</div>

				<div class="p-4 rounded-lg border" style="border-color: {$currentTheme.base.border};">
					<h3 class="font-semibold mb-2" style="color: {$currentTheme.base.foreground};">
						📋 Manage Tasks
					</h3>
					<p class="text-sm" style="color: {$currentTheme.base.muted};">
						"Create a task for REQ-001" or "What tasks are blocked?"
					</p>
				</div>

				<div class="p-4 rounded-lg border" style="border-color: {$currentTheme.base.border};">
					<h3 class="font-semibold mb-2" style="color: {$currentTheme.base.foreground};">
						🏗️ Explore Architecture
					</h3>
					<p class="text-sm" style="color: {$currentTheme.base.muted};">
						"What architectural decisions have been made?" or "Show me the project overview"
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Conversation Manager Modal -->
<ConversationManager isOpen={showConversationManager} onClose={handleConversationManagerClose} />
