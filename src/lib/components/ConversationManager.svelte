<script lang="ts">
	import { onMount } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import { chatService } from '$lib/services/chat-service';
	import type { ConversationThread, ConversationSearchFilter } from '$lib/types/chat';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let threads = $state<ConversationThread[]>([]);
	let searchQuery = $state('');
	let isLoading = $state(false);
	let currentThread = $state<ConversationThread | null>(null);
	let showSearch = $state(false);

	onMount(async () => {
		await loadThreads();
		currentThread = chatService.getCurrentThread();
	});

	async function loadThreads() {
		isLoading = true;
		try {
			if (searchQuery.trim()) {
				const filter: ConversationSearchFilter = {
					query: searchQuery.trim()
				};
				threads = await chatService.searchConversations(filter);
			} else {
				threads = await chatService.getAllThreads();
			}
		} catch (error) {
			console.error('Failed to load conversation threads:', error);
		} finally {
			isLoading = false;
		}
	}

	async function switchToThread(thread: ConversationThread) {
		try {
			await chatService.switchToThread(thread.id);
			currentThread = thread;
			onClose();
		} catch (error) {
			console.error('Failed to switch thread:', error);
		}
	}

	async function createNewThread() {
		try {
			const newThread = await chatService.createNewThread();
			currentThread = newThread;
			await loadThreads();
			onClose();
		} catch (error) {
			console.error('Failed to create new thread:', error);
		}
	}

	async function deleteThread(threadId: string, event: Event) {
		event.stopPropagation();

		if (!confirm('Are you sure you want to delete this conversation?')) {
			return;
		}

		try {
			await chatService.deleteThread(threadId);
			await loadThreads();
			currentThread = chatService.getCurrentThread();
		} catch (error) {
			console.error('Failed to delete thread:', error);
		}
	}

	async function exportThread(threadId: string, format: 'markdown' | 'json', event: Event) {
		event.stopPropagation();

		try {
			const content = await chatService.exportThread(threadId, format);
			const blob = new Blob([content], {
				type: format === 'markdown' ? 'text/markdown' : 'application/json'
			});

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `conversation-${threadId}.${format === 'markdown' ? 'md' : 'json'}`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to export thread:', error);
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} else if (diffDays === 1) {
			return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} else if (diffDays < 7) {
			return (
				date.toLocaleDateString([], { weekday: 'short' }) +
				' ' +
				date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			);
		} else {
			return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
		}
	}

	// Reactive search
	$effect(() => {
		if (searchQuery !== undefined) {
			const timeoutId = setTimeout(loadThreads, 300);
			return () => clearTimeout(timeoutId);
		}
	});
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div
			class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] m-4 flex flex-col"
			style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base
				.border};"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between p-6 border-b"
				style="border-color: {$currentTheme.base.border};"
			>
				<div>
					<h2 class="text-xl font-semibold" style="color: {$currentTheme.base.foreground};">
						Conversations
					</h2>
					<p class="text-sm mt-1" style="color: {$currentTheme.base.muted};">
						{threads.length} conversation{threads.length !== 1 ? 's' : ''}
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						onclick={() => (showSearch = !showSearch)}
						class="p-2 rounded-lg transition-colors"
						style="color: {$currentTheme.base.muted};"
						title="Search conversations"
					>
						🔍
					</button>
					<button
						onclick={createNewThread}
						class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
					>
						New Chat
					</button>
					<button
						onclick={onClose}
						class="p-2 rounded-lg transition-colors"
						style="color: {$currentTheme.base.muted};"
						aria-label="Close"
					>
						✕
					</button>
				</div>
			</div>

			<!-- Search -->
			{#if showSearch}
				<div class="p-4 border-b" style="border-color: {$currentTheme.base.border};">
					<input
						bind:value={searchQuery}
						placeholder="Search conversations..."
						class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
						style="background-color: {$currentTheme.base.background};
							   color: {$currentTheme.base.foreground};
							   border-color: {$currentTheme.base.border};"
					/>
				</div>
			{/if}

			<!-- Thread List -->
			<div class="flex-1 overflow-y-auto p-4 space-y-2">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<div class="text-sm" style="color: {$currentTheme.base.muted};">
							Loading conversations...
						</div>
					</div>
				{:else if threads.length === 0}
					<div class="flex items-center justify-center py-8">
						<div class="text-center">
							<div class="text-sm" style="color: {$currentTheme.base.muted};">
								{searchQuery ? 'No conversations found' : 'No conversations yet'}
							</div>
							{#if !searchQuery}
								<button
									onclick={createNewThread}
									class="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
								>
									Start your first conversation
								</button>
							{/if}
						</div>
					</div>
				{:else}
					{#each threads as thread (thread.id)}
						<div
							class="group p-3 rounded-lg border cursor-pointer transition-colors {currentThread?.id ===
							thread.id
								? 'ring-2 ring-blue-500'
								: 'hover:bg-opacity-50'}"
							style="border-color: {$currentTheme.base.border};
								   background-color: {currentThread?.id === thread.id
								? $currentTheme.base.muted + '20'
								: 'transparent'};"
							onclick={() => switchToThread(thread)}
							onkeydown={(e) => e.key === 'Enter' && switchToThread(thread)}
							role="button"
							tabindex="0"
							aria-label="Switch to conversation: {thread.title}"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1 min-w-0">
									<h3 class="font-medium truncate" style="color: {$currentTheme.base.foreground};">
										{thread.title}
									</h3>
									<div
										class="flex items-center gap-2 mt-1 text-xs"
										style="color: {$currentTheme.base.muted};"
									>
										<span
											>{thread.messages.length} message{thread.messages.length !== 1
												? 's'
												: ''}</span
										>
										<span>•</span>
										<span>{formatDate(thread.updatedAt)}</span>
										{#if thread.metadata?.totalTokens}
											<span>•</span>
											<span>{thread.metadata.totalTokens} tokens</span>
										{/if}
									</div>
									{#if thread.messages.length > 0}
										<p class="text-xs mt-1 truncate" style="color: {$currentTheme.base.muted};">
											{thread.messages[thread.messages.length - 1]?.content?.substring(0, 100)}...
										</p>
									{/if}
								</div>

								<div
									class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
								>
									<button
										onclick={(e) => exportThread(thread.id, 'markdown', e)}
										class="p-1 rounded text-xs hover:bg-gray-200 transition-colors"
										style="color: {$currentTheme.base.muted};"
										title="Export as Markdown"
									>
										📄
									</button>
									<button
										onclick={(e) => exportThread(thread.id, 'json', e)}
										class="p-1 rounded text-xs hover:bg-gray-200 transition-colors"
										style="color: {$currentTheme.base.muted};"
										title="Export as JSON"
									>
										📋
									</button>
									<button
										onclick={(e) => deleteThread(thread.id, e)}
										class="p-1 rounded text-xs hover:bg-red-200 transition-colors text-red-600"
										title="Delete conversation"
									>
										🗑️
									</button>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="p-4 border-t text-xs"
				style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base.muted};"
			>
				<p>💾 Conversations are saved locally in your browser</p>
			</div>
		</div>
	</div>
{/if}
