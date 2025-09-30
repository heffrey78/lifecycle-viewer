<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { currentTheme } from '$lib/theme';
	import type { ChatMessage, ChatInterfaceProps } from '$lib/types/chat';
	import { renderMarkdown } from '$lib/utils/markdown-renderer';
	import UsageTracker from './UsageTracker.svelte';

	interface Props extends ChatInterfaceProps {
		messages?: ChatMessage[];
		isStreaming?: boolean;
		connectionStatus?: 'connected' | 'disconnected' | 'checking';
		placeholder?: string;
		maxHeight?: string;
		disabled?: boolean;
		supportFileUploads?: boolean;
		maxFileSize?: number; // in bytes
		acceptedFileTypes?: string[];
	}

	let {
		messages = [],
		isStreaming = false,
		connectionStatus = 'checking',
		placeholder = 'Ask about your project...',
		maxHeight = '600px',
		disabled = false,
		supportFileUploads = true,
		maxFileSize = 10 * 1024 * 1024, // 10MB default
		acceptedFileTypes = ['.txt', '.md', '.json', '.csv', '.yml', '.yaml', '.log']
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		sendMessage: { content: string; files?: File[] };
		clearChat: void;
		retryMessage: { messageId: string };
		fileUpload: { files: File[] };
	}>();

	// Chat state
	let inputValue = $state('');
	let chatContainer: HTMLDivElement;
	let inputElement: HTMLTextAreaElement;
	let isComposing = $state(false);

	// File upload state
	let fileInputElement: HTMLInputElement;
	let uploadedFiles = $state<File[]>([]);
	let isDragOver = $state(false);
	let uploadError = $state<string | null>(null);

	// Accessibility state
	let statusMessageId = $state(crypto.randomUUID());
	let liveRegionId = $state(crypto.randomUUID());

	// Auto-resize textarea
	function adjustTextareaHeight() {
		if (inputElement) {
			inputElement.style.height = 'auto';
			inputElement.style.height = Math.min(inputElement.scrollHeight, 120) + 'px';
		}
	}

	// Send message
	function handleSendMessage() {
		const content = inputValue.trim();
		if (
			(!content && uploadedFiles.length === 0) ||
			isStreaming ||
			disabled ||
			connectionStatus !== 'connected'
		)
			return;

		const filesToSend = uploadedFiles.length > 0 ? [...uploadedFiles] : undefined;
		dispatch('sendMessage', { content, files: filesToSend });
		inputValue = '';
		uploadedFiles = [];
		uploadError = null;
		adjustTextareaHeight();
	}

	// Handle keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
			event.preventDefault();
			handleSendMessage();
		}
	}

	// Auto-scroll to bottom when new messages arrive
	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	// Scroll to bottom when messages change
	$effect(() => {
		if (messages.length > 0) {
			setTimeout(scrollToBottom, 0);
		}
	});

	onMount(() => {
		adjustTextareaHeight();
	});

	// Format timestamp
	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
		return date.toLocaleDateString();
	}

	// Handle message retry
	function retryMessage(messageId: string) {
		dispatch('retryMessage', { messageId });
	}

	// Enhanced file upload validation with security checks
	function validateFile(file: File): string | null {
		// Security: Check for null/undefined file
		if (!file || !file.name) {
			return 'Invalid file provided.';
		}

		// Security: Check for empty files (potential security risk)
		if (file.size === 0) {
			return `File "${file.name}" is empty and cannot be uploaded.`;
		}

		// Check file size
		if (file.size > maxFileSize) {
			return `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}.`;
		}

		// Security: Check filename for suspicious patterns
		const suspiciousPatterns = [
			/\.\./, // Directory traversal
			/[<>:"|?*]/, // Invalid filename characters
			/^\./, // Hidden files
			/\.(exe|bat|cmd|com|scr|pif|vbs|js|jar|app|deb|rpm)$/i, // Executable files
			/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
			/\x00/ // Null bytes
		];

		for (const pattern of suspiciousPatterns) {
			if (pattern.test(file.name)) {
				return `File "${file.name}" contains invalid characters or patterns. Please rename the file.`;
			}
		}

		// Security: Limit filename length
		if (file.name.length > 255) {
			return `File name is too long. Maximum length is 255 characters.`;
		}

		// Enhanced file type validation
		if (acceptedFileTypes.length > 0) {
			const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
			const mimeType = file.type.toLowerCase();

			// Security: Ensure file has an extension
			if (!fileExt || fileExt === '.') {
				return `File "${file.name}" must have a valid file extension.`;
			}

			const isValidExtension = acceptedFileTypes.some((type) => type.toLowerCase() === fileExt);

			// Enhanced MIME type mapping with security considerations
			const mimeMap: Record<string, string[]> = {
				'.txt': ['text/plain'],
				'.md': ['text/markdown', 'text/plain'],
				'.json': ['application/json', 'text/plain'],
				'.csv': ['text/csv', 'text/plain', 'application/csv'],
				'.yml': ['text/yaml', 'text/plain', 'application/x-yaml'],
				'.yaml': ['text/yaml', 'text/plain', 'application/x-yaml'],
				'.log': ['text/plain']
			};

			const allowedMimes = mimeMap[fileExt.toLowerCase()] || [];
			const isValidMimeType = allowedMimes.includes(mimeType) || mimeType === '';

			if (!isValidExtension) {
				return `File type "${fileExt}" is not supported. Allowed types: ${acceptedFileTypes.join(', ')}.`;
			}

			// Security: Check MIME type consistency if provided
			if (mimeType && !isValidMimeType) {
				return `File "${file.name}" has an inconsistent file type. Expected MIME types: ${allowedMimes.join(', ')}.`;
			}
		}

		// Security: Additional checks for specific file types
		if (
			file.name.toLowerCase().includes('script') ||
			file.name.toLowerCase().includes('executable')
		) {
			return `File "${file.name}" appears to be executable content and cannot be uploaded.`;
		}

		return null;
	}

	// Format file size for display
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Handle file selection with enhanced security
	function handleFileSelect(files: FileList | File[]) {
		uploadError = null;
		const fileArray = Array.from(files);

		// Security: Limit number of files
		const maxFiles = 5;
		if (fileArray.length > maxFiles) {
			uploadError = `Too many files selected. Maximum allowed: ${maxFiles}`;
			return;
		}

		// Security: Check total size of all files
		const currentTotalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
		const newTotalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
		const maxTotalSize = maxFileSize * 3; // Allow up to 3x single file limit for multiple files

		if (currentTotalSize + newTotalSize > maxTotalSize) {
			uploadError = `Total file size too large. Maximum combined size: ${formatFileSize(maxTotalSize)}`;
			return;
		}

		for (const file of fileArray) {
			const error = validateFile(file);
			if (error) {
				uploadError = error;
				return;
			}

			// Security: Check for duplicate names (even with different sizes)
			if (uploadedFiles.some((f) => f.name === file.name)) {
				uploadError = `File "${file.name}" is already selected. Please select files with unique names.`;
				return;
			}

			// Security: Limit total number of uploaded files
			if (uploadedFiles.length >= maxFiles) {
				uploadError = `Cannot upload more than ${maxFiles} files at once.`;
				return;
			}

			uploadedFiles = [...uploadedFiles, file];
		}
	}

	// Remove uploaded file
	function removeFile(index: number) {
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
		uploadError = null;
	}

	// Handle drag and drop with security enhancements
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!supportFileUploads || disabled || isStreaming) return;

		// Security: Only allow file drops, not other content
		if (!event.dataTransfer?.types.includes('Files')) {
			return;
		}

		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Only set to false if leaving the container entirely
		if (
			!event.currentTarget ||
			!event.relatedTarget ||
			!event.currentTarget.contains(event.relatedTarget as Node)
		) {
			isDragOver = false;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;

		if (!supportFileUploads || disabled || isStreaming) return;

		// Security: Validate drop data
		if (!event.dataTransfer) {
			uploadError = 'Invalid drop data';
			return;
		}

		// Security: Only process files, ignore other data types
		const files = event.dataTransfer.files;
		if (!files || files.length === 0) {
			uploadError = 'No valid files dropped';
			return;
		}

		// Security: Check for potential security issues in dataTransfer
		try {
			handleFileSelect(files);
		} catch (error) {
			console.error('Error handling dropped files:', error);
			uploadError = 'Error processing dropped files. Please try again.';
		}
	}

	// Handle file input change with security
	function handleFileInputChange(event: Event) {
		const input = event.target as HTMLInputElement;

		// Security: Validate input element
		if (!input || input.type !== 'file') {
			uploadError = 'Invalid file input';
			return;
		}

		try {
			if (input.files && input.files.length > 0) {
				handleFileSelect(input.files);
			}
		} catch (error) {
			console.error('Error handling selected files:', error);
			uploadError = 'Error processing selected files. Please try again.';
		} finally {
			// Security: Always clear the input to prevent reuse
			input.value = '';
		}
	}
</script>

<div
	class="flex flex-col h-full"
	style="max-height: {maxHeight};"
	role="region"
	aria-label="Chat interface"
>
	<!-- Chat Header -->
	<header
		class="flex items-center justify-between p-4 border-b"
		style="border-color: {$currentTheme.base.border}; background-color: {$currentTheme.base
			.background};"
		role="banner"
	>
		<div class="flex items-center gap-3">
			<h1 class="text-lg font-semibold" style="color: {$currentTheme.base.foreground};">
				Project Assistant
			</h1>

			<!-- Connection Status -->
			<div
				class="flex items-center gap-2 text-sm"
				role="status"
				aria-live="polite"
				id={statusMessageId}
			>
				{#if connectionStatus === 'checking'}
					<div
						class="animate-spin h-3 w-3 border border-gray-300 border-t-blue-600 rounded-full"
						aria-hidden="true"
					></div>
					<span
						style="color: {$currentTheme.base.muted};"
						aria-label="Connection status: Connecting">Connecting...</span
					>
				{:else if connectionStatus === 'connected'}
					<div class="h-3 w-3 bg-green-500 rounded-full" aria-hidden="true"></div>
					<span class="text-green-600" aria-label="Connection status: Connected">Connected</span>
				{:else}
					<div class="h-3 w-3 bg-red-500 rounded-full" aria-hidden="true"></div>
					<span class="text-red-600" aria-label="Connection status: Disconnected">Disconnected</span
					>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-3">
			<!-- Usage Tracker -->
			<UsageTracker />
		</div>

		<button
			onclick={() => dispatch('clearChat')}
			disabled={disabled || messages.length === 0}
			class="px-3 py-1 text-sm rounded-md border transition-colors hover:bg-opacity-10 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base.muted};"
			aria-label="Clear chat history ({messages.length} messages)"
			type="button"
		>
			Clear
		</button>
	</header>

	<!-- Messages Container -->
	<main
		bind:this={chatContainer}
		class="flex-1 overflow-y-auto p-4 space-y-4"
		style="background-color: {$currentTheme.base.background};"
		role="main"
		aria-label="Chat messages"
		aria-live="polite"
		aria-atomic="false"
		id={liveRegionId}
		tabindex="0"
	>
		{#if messages.length === 0}
			<div class="text-center py-8" role="status">
				<div
					class="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center"
					aria-hidden="true"
				>
					<svg
						class="w-8 h-8 text-blue-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</div>
				<p class="text-lg font-medium mb-2" style="color: {$currentTheme.base.foreground};">
					Start a conversation
				</p>
				<p style="color: {$currentTheme.base.muted};">
					Ask me about your requirements, tasks, or project architecture.
				</p>
			</div>
		{/if}

		{#each messages as message, index (message.id)}
			<article
				class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
				role="article"
				aria-label="{message.role === 'user' ? 'User message' : 'Assistant message'} {index +
					1} of {messages.length}"
			>
				<div class="max-w-[80%] {message.role === 'user' ? 'ml-12' : 'mr-12'}">
					<!-- Message bubble -->
					<div
						class="rounded-lg px-4 py-3 {message.role === 'user'
							? 'bg-blue-600 text-white'
							: 'border'}"
						style={message.role === 'assistant'
							? `border-color: ${$currentTheme.base.border}; background-color: ${$currentTheme.base.background}; color: ${$currentTheme.base.foreground};`
							: ''}
						role="region"
						aria-label="{message.role === 'user' ? 'User' : 'Assistant'} message content"
					>
						{#if message.role === 'assistant' && message.isStreaming}
							<!-- Streaming indicator -->
							<div class="flex items-center gap-2 mb-2" role="status" aria-live="polite">
								<div class="flex gap-1" aria-hidden="true">
									<div
										class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
										style="animation-delay: 0ms;"
									></div>
									<div
										class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
										style="animation-delay: 150ms;"
									></div>
									<div
										class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
										style="animation-delay: 300ms;"
									></div>
								</div>
								<span
									class="text-sm"
									style="color: {$currentTheme.base.muted};"
									aria-label="Assistant is currently typing a response"
								>
									Assistant is typing...
								</span>
							</div>
						{/if}

						<!-- File attachments -->
						{#if message.attachments && message.attachments.length > 0}
							<div class="mb-3 space-y-2" role="region" aria-label="File attachments">
								{#each message.attachments as attachment (attachment.id)}
									<div
										class="flex items-start gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg"
									>
										<!-- File Icon -->
										<div class="flex-shrink-0 mt-0.5">
											{#if attachment.processingStatus === 'processing'}
												<div
													class="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
													aria-hidden="true"
												></div>
											{:else if attachment.processingStatus === 'success'}
												<svg
													class="w-5 h-5 text-green-600"
													fill="currentColor"
													viewBox="0 0 20 20"
													aria-hidden="true"
												>
													<path
														fill-rule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
														clip-rule="evenodd"
													/>
												</svg>
											{:else if attachment.processingStatus === 'error'}
												<svg
													class="w-5 h-5 text-red-600"
													fill="currentColor"
													viewBox="0 0 20 20"
													aria-hidden="true"
												>
													<path
														fill-rule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
														clip-rule="evenodd"
													/>
												</svg>
											{:else}
												<svg
													class="w-5 h-5 text-gray-400"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													aria-hidden="true"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
													/>
												</svg>
											{/if}
										</div>

										<!-- File Info -->
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between">
												<p class="text-sm font-medium text-gray-900 truncate">
													{attachment.filename}
												</p>
												<span class="text-xs text-gray-500">
													{formatFileSize(attachment.size)}
												</span>
											</div>

											<!-- Processing Status -->
											<div class="mt-1">
												{#if attachment.processingStatus === 'pending'}
													<span class="text-xs text-gray-500">Pending processing...</span>
												{:else if attachment.processingStatus === 'processing'}
													<span class="text-xs text-blue-600">Reading file content...</span>
												{:else if attachment.processingStatus === 'success'}
													<span class="text-xs text-green-600"
														>✓ Content processed successfully</span
													>
													{#if attachment.content}
														<p class="text-xs text-gray-600 mt-1">
															{attachment.content.split('\n').length} lines, {attachment.content
																.split(/\s+/)
																.filter((w) => w.length > 0).length} words
														</p>
													{/if}
												{:else if attachment.processingStatus === 'error'}
													<span class="text-xs text-red-600">✗ Processing failed</span>
													{#if attachment.error}
														<p class="text-xs text-red-500 mt-1">{attachment.error}</p>
													{/if}
												{/if}

												<!-- Warning if present -->
												{#if attachment.warning}
													<p class="text-xs text-yellow-600 mt-1">⚠ {attachment.warning}</p>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Message content -->
						<div class="prose prose-sm max-w-none">
							{@html renderMarkdown(message.content)}
						</div>

						<!-- Error state -->
						{#if message.error}
							<div
								class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm"
								role="alert"
								aria-live="assertive"
							>
								<div class="flex items-start gap-2">
									<svg
										class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
										fill="currentColor"
										viewBox="0 0 20 20"
										aria-hidden="true"
									>
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
											clip-rule="evenodd"
										/>
									</svg>
									<div class="flex-1">
										<p class="text-red-800" id="error-{message.id}">Error: {message.error}</p>
										<button
											onclick={() => retryMessage(message.id)}
											class="mt-1 text-red-600 hover:text-red-800 underline text-xs focus:ring-2 focus:ring-red-500 focus:outline-none rounded"
											type="button"
											aria-describedby="error-{message.id}"
											aria-label="Retry sending this message"
										>
											Retry
										</button>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Timestamp -->
					<div
						class="mt-1 text-xs {message.role === 'user' ? 'text-right' : 'text-left'}"
						style="color: {$currentTheme.base.muted};"
						aria-label="Message sent {formatTimestamp(message.timestamp)}"
					>
						<time datetime={message.timestamp}>{formatTimestamp(message.timestamp)}</time>
					</div>
				</div>
			</article>
		{/each}
	</main>

	<!-- Input Area -->
	<footer
		class="border-t p-4"
		style="border-color: {$currentTheme.base.border}; background-color: {$currentTheme.base
			.background};"
		role="contentinfo"
	>
		{#if connectionStatus !== 'connected'}
			<div
				class="text-center py-2 text-sm"
				style="color: {$currentTheme.base.muted};"
				role="status"
				aria-live="polite"
			>
				{connectionStatus === 'checking'
					? 'Connecting to assistant...'
					: 'Assistant is unavailable'}
			</div>
		{/if}

		<!-- File Upload Area -->
		{#if supportFileUploads && (uploadedFiles.length > 0 || uploadError)}
			<section class="mb-4" aria-label="File upload status">
				<!-- Upload Error -->
				{#if uploadError}
					<div
						class="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg"
						role="alert"
						aria-live="assertive"
					>
						<div class="flex items-start gap-2">
							<svg
								class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
								fill="currentColor"
								viewBox="0 0 20 20"
								aria-hidden="true"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
							<p class="text-red-800 text-sm">File upload error: {uploadError}</p>
						</div>
					</div>
				{/if}

				<!-- Uploaded Files -->
				{#if uploadedFiles.length > 0}
					<div
						class="space-y-2 mb-3"
						role="list"
						aria-label="Uploaded files ({uploadedFiles.length})"
					>
						{#each uploadedFiles as file, index (file.name + file.size)}
							<div
								class="flex items-center gap-3 p-2 bg-blue-50 border border-blue-200 rounded-lg"
								role="listitem"
							>
								<svg
									class="w-5 h-5 text-blue-600 flex-shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-blue-900 truncate" id="file-name-{index}">
										{file.name}
									</p>
									<p class="text-xs text-blue-600">{formatFileSize(file.size)}</p>
								</div>
								<button
									onclick={() => removeFile(index)}
									class="p-1 rounded hover:bg-blue-100 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
									type="button"
									aria-label="Remove file {file.name}"
									aria-describedby="file-name-{index}"
								>
									<svg
										class="w-4 h-4 text-blue-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Main Input Area with Drag-Drop Support -->
		<section
			class="relative {isDragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			aria-label="Message input area"
			role="group"
		>
			<!-- Drag Overlay -->
			{#if isDragOver && supportFileUploads}
				<div
					class="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center z-10"
					role="status"
					aria-live="polite"
				>
					<div class="text-center">
						<svg
							class="w-12 h-12 text-blue-500 mx-auto mb-2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
						<p class="text-blue-700 font-medium">Drop files here</p>
						<p class="text-blue-600 text-sm">Supported: {acceptedFileTypes.join(', ')}</p>
					</div>
				</div>
			{/if}

			<div class="flex gap-3 items-end">
				<div class="flex-1">
					<label for="chat-input" class="sr-only">
						Type your message to the project assistant
					</label>
					<textarea
						id="chat-input"
						bind:this={inputElement}
						bind:value={inputValue}
						oninput={adjustTextareaHeight}
						onkeydown={handleKeydown}
						oncompositionstart={() => (isComposing = true)}
						oncompositionend={() => (isComposing = false)}
						{placeholder}
						disabled={disabled || isStreaming || connectionStatus !== 'connected'}
						rows="1"
						maxlength="2000"
						class="w-full px-4 py-3 rounded-lg border resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
						style="background-color: {$currentTheme.base.background};
							   color: {$currentTheme.base.foreground};
							   border-color: {$currentTheme.base.border};"
						aria-label="Chat message input"
						aria-describedby="input-help char-count"
						aria-required={uploadedFiles.length === 0}
					></textarea>
					<div
						class="flex justify-between items-center mt-1 text-xs"
						style="color: {$currentTheme.base.muted};"
					>
						<span id="input-help">Press Enter to send, Shift+Enter for new line</span>
						<span
							id="char-count"
							aria-live="polite"
							aria-label="Character count: {inputValue.length} of 2000"
							>{inputValue.length}/2000</span
						>
					</div>
				</div>

				<!-- File Upload Button -->
				{#if supportFileUploads}
					<input
						bind:this={fileInputElement}
						type="file"
						multiple
						accept={acceptedFileTypes.join(',')}
						onchange={handleFileInputChange}
						class="hidden"
						id="file-upload-input"
						aria-label="Select files to upload. Supported formats: {acceptedFileTypes.join(', ')}"
					/>
					<button
						onclick={() => fileInputElement.click()}
						disabled={disabled || isStreaming || connectionStatus !== 'connected'}
						class="p-3 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						style="border-color: {$currentTheme.base.border};"
						type="button"
						aria-label="Attach files (supported: {acceptedFileTypes.join(', ')})"
						aria-describedby="file-upload-help"
					>
						<svg
							class="w-5 h-5"
							style="color: {$currentTheme.base.muted};"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
							/>
						</svg>
					</button>
					<span id="file-upload-help" class="sr-only">
						Maximum file size: {formatFileSize(maxFileSize)}. You can also drag and drop files
						directly onto this area.
					</span>
				{/if}

				<!-- Send Button -->
				<button
					onclick={handleSendMessage}
					disabled={(!inputValue.trim() && uploadedFiles.length === 0) ||
						isStreaming ||
						disabled ||
						connectionStatus !== 'connected'}
					class="p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:outline-none {(inputValue.trim() ||
						uploadedFiles.length > 0) &&
					connectionStatus === 'connected' &&
					!isStreaming
						? 'bg-blue-600 hover:bg-blue-700 text-white'
						: 'bg-gray-200 text-gray-500'}"
					type="submit"
					aria-label={isStreaming
						? 'Sending message...'
						: `Send message${uploadedFiles.length > 0 ? ` with ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'}` : ''}`}
					aria-describedby="send-button-help"
				>
					{#if isStreaming}
						<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					{:else}
						<svg
							class="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
							/>
						</svg>
					{/if}
				</button>
				<span id="send-button-help" class="sr-only">
					{connectionStatus !== 'connected'
						? 'Cannot send messages while disconnected'
						: 'Click to send your message to the assistant'}
				</span>
			</div>
		</section>
	</footer>
</div>

<style>
	/* Custom prose styles for chat messages */
	:global(.prose) {
		color: inherit;
		max-width: none;
	}

	:global(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
		color: inherit;
		margin-top: 0.75em;
		margin-bottom: 0.5em;
		line-height: 1.3;
	}

	:global(.prose h1) {
		font-size: 1.5em;
		font-weight: 700;
	}
	:global(.prose h2) {
		font-size: 1.3em;
		font-weight: 600;
	}
	:global(.prose h3) {
		font-size: 1.1em;
		font-weight: 600;
	}
	:global(.prose h4, .prose h5, .prose h6) {
		font-size: 1em;
		font-weight: 600;
	}

	:global(.prose p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		line-height: 1.6;
	}

	/* Inline code styling */
	:global(.prose code:not(.hljs)) {
		background-color: rgba(0, 0, 0, 0.1);
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
	}

	/* Code block styling */
	:global(.prose pre) {
		background-color: #f8f8f8;
		border: 1px solid #e1e5e9;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 0.75em 0;
		padding: 0;
	}

	:global(.prose pre code.hljs) {
		background: none;
		padding: 1rem;
		border-radius: 0;
		font-size: 0.875em;
		line-height: 1.5;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
	}

	/* List styling */
	:global(.prose ul, .prose ol) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		padding-left: 1.5em;
	}

	:global(.prose li) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
	}

	:global(.prose ul > li) {
		list-style-type: disc;
	}

	:global(.prose ol > li) {
		list-style-type: decimal;
	}

	/* Blockquote styling */
	:global(.prose blockquote) {
		border-left: 4px solid #d1d5db;
		padding-left: 1rem;
		margin: 0.75em 0;
		font-style: italic;
		color: inherit;
		opacity: 0.8;
	}

	/* Table styling */
	:global(.prose table) {
		margin: 0.75em 0;
		font-size: 0.875em;
	}

	:global(.prose th) {
		background-color: rgba(0, 0, 0, 0.05);
		font-weight: 600;
	}

	:global(.prose td, .prose th) {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
	}

	/* Link styling */
	:global(.prose a) {
		color: #2563eb;
		text-decoration: underline;
		transition: color 0.2s;
	}

	:global(.prose a:hover) {
		color: #1d4ed8;
	}

	/* Image styling */
	:global(.prose img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		margin: 0.5em 0;
	}

	/* Horizontal rule */
	:global(.prose hr) {
		border: none;
		border-top: 1px solid #d1d5db;
		margin: 1em 0;
	}

	/* Strong and emphasis */
	:global(.prose strong, .prose b) {
		font-weight: 600;
	}

	:global(.prose em, .prose i) {
		font-style: italic;
	}

	/* Strikethrough */
	:global(.prose del, .prose s) {
		text-decoration: line-through;
		opacity: 0.7;
	}

	/* Task lists */
	:global(.prose input[type='checkbox']) {
		margin-right: 0.5em;
	}

	/* Smooth animations */
	.animate-bounce {
		animation: bounce 1s infinite;
	}

	@keyframes bounce {
		0%,
		20%,
		53%,
		80%,
		100% {
			transform: translate3d(0, 0, 0);
		}
		40%,
		43% {
			transform: translate3d(0, -30%, 0);
		}
		70% {
			transform: translate3d(0, -15%, 0);
		}
		90% {
			transform: translate3d(0, -4%, 0);
		}
	}

	/* Dark mode adjustments */
	@media (prefers-color-scheme: dark) {
		:global(.prose pre) {
			background-color: #1f2937;
			border-color: #374151;
		}

		:global(.prose code:not(.hljs)) {
			background-color: rgba(255, 255, 255, 0.1);
		}

		:global(.prose th) {
			background-color: rgba(255, 255, 255, 0.05);
		}

		:global(.prose td, .prose th) {
			border-color: #374151;
		}

		:global(.prose blockquote) {
			border-left-color: #6b7280;
		}

		:global(.prose hr) {
			border-top-color: #6b7280;
		}
	}

	/* Accessibility enhancements */

	/* Screen reader only content */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		:global(.prose) {
			color: CanvasText;
		}

		:global(.prose a) {
			color: LinkText;
		}

		:global(.prose pre) {
			border: 2px solid ButtonBorder;
		}

		:global(.prose code:not(.hljs)) {
			border: 1px solid ButtonBorder;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.animate-bounce {
			animation: none;
		}

		* {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}

	/* Focus visible enhancements for better keyboard navigation */
	:global(button:focus-visible),
	:global(textarea:focus-visible),
	:global(input:focus-visible) {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
	}

	/* Improved focus styles for buttons */
	:global(button:focus-visible) {
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}
</style>
