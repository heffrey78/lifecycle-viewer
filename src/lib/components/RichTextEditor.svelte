<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';
	import { currentTheme } from '$lib/theme';
	import { sanitizeHtml } from '$lib/utils/html-sanitizer.js';

	// Props
	interface Props {
		content?: string;
		placeholder?: string;
		disabled?: boolean;
		minHeight?: string;
		maxHeight?: string;
		onUpdate?: (content: string) => void;
		required?: boolean;
		id?: string;
		'aria-label'?: string;
		'aria-labelledby'?: string;
	}

	let {
		content = '',
		placeholder = 'Start typing...',
		disabled = false,
		minHeight = '200px',
		maxHeight = '400px',
		onUpdate,
		required = false,
		id,
		'aria-label': ariaLabel,
		'aria-labelledby': ariaLabelledBy
	}: Props = $props();

	let editorElement: HTMLDivElement = $state(null as any);
	let editor: Editor | null = $state(null);
	let isFocused = $state(false);
	let editorError = $state<string | null>(null);
	let fallbackMode = $state(false);

	// Initialize editor on mount
	onMount(() => {
		try {
			editor = new Editor({
				element: editorElement,
				extensions: [
					StarterKit.configure({
						heading: {
							levels: [1, 2, 3]
						},
						bulletList: {
							keepMarks: true,
							keepAttributes: false
						},
						orderedList: {
							keepMarks: true,
							keepAttributes: false
						}
					}),
					Placeholder.configure({
						placeholder: placeholder,
						emptyEditorClass: 'is-editor-empty'
					})
				],
				content: content,
				editable: !disabled,
				onTransaction: () => {
					// Force reactivity
					editor = editor;
				},
				onUpdate: ({ editor: editorInstance }) => {
					try {
						const rawHtml = editorInstance.getHTML();
						const sanitizedHtml = sanitizeHtml(rawHtml);
						onUpdate?.(sanitizedHtml);
					} catch (error) {
						console.warn('Rich text editor update failed:', error);
						editorError = 'Editor update failed';
					}
				},
				onCreate: () => {
					editorError = null; // Clear any previous errors
				},
				onDestroy: () => {
					editorError = null;
				},
				onFocus: () => {
					isFocused = true;
				},
				onBlur: () => {
					isFocused = false;
				}
			});
		} catch (error) {
			console.error('Failed to initialize rich text editor:', error);
			editorError = 'Rich text editor failed to load';
			fallbackMode = true;
		}
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});

	// Update content when prop changes
	$effect(() => {
		if (editor && typeof editor.getHTML === 'function' && content !== editor.getHTML()) {
			if (typeof editor.commands?.setContent === 'function') {
				editor.commands.setContent(content);
			}
		}
	});

	// Update disabled state
	$effect(() => {
		if (editor && typeof editor.setEditable === 'function') {
			editor.setEditable(!disabled);
		}
	});

	// Format commands
	function toggleBold() {
		editor?.chain().focus().toggleBold().run();
	}

	function toggleItalic() {
		editor?.chain().focus().toggleItalic().run();
	}

	function toggleStrike() {
		editor?.chain().focus().toggleStrike().run();
	}

	function toggleHeading(level: 1 | 2 | 3) {
		editor?.chain().focus().toggleHeading({ level }).run();
	}

	function toggleBulletList() {
		editor?.chain().focus().toggleBulletList().run();
	}

	function toggleOrderedList() {
		editor?.chain().focus().toggleOrderedList().run();
	}

	function toggleBlockquote() {
		editor?.chain().focus().toggleBlockquote().run();
	}

	function undo() {
		editor?.chain().focus().undo().run();
	}

	function redo() {
		editor?.chain().focus().redo().run();
	}

	// Helper functions for toolbar state
	const isActive = $derived((format: string, options?: object) => {
		return (typeof editor?.isActive === 'function') ? editor.isActive(format, options) : false;
	});

	const canUndo = $derived.by(() => (typeof editor?.can === 'function') ? editor.can().undo() : false);
	const canRedo = $derived.by(() => (typeof editor?.can === 'function') ? editor.can().redo() : false);
</script>

<!-- Fallback textarea if editor fails -->
{#if fallbackMode || editorError}
	<div class="border border-yellow-300 bg-yellow-50 p-3 rounded-lg">
		<p class="text-sm text-yellow-800 mb-2">Rich text editor unavailable. Using plain text mode.</p>
		<textarea
			{id}
			bind:value={content}
			{placeholder}
			{disabled}
			{required}
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledBy}
			class="w-full px-3 py-2 border rounded-md resize-vertical"
			style="min-height: {minHeight}; max-height: {maxHeight};"
			oninput={(e) => onUpdate?.((e.target as HTMLTextAreaElement)?.value || '')}
		></textarea>
	</div>
{:else}
	<div
		class="rich-text-editor rounded-lg border transition-colors {isFocused
			? 'ring-2 ring-blue-500 border-blue-500'
			: ''}"
		style="border-color: {isFocused
			? ''
			: $currentTheme.base.border}; background-color: {$currentTheme.base.background};"
	>
		<!-- Toolbar -->
		<div
			class="flex flex-wrap items-center gap-1 p-2 border-b"
			style="border-color: {$currentTheme.base.border}; background-color: {$currentTheme.base.background};"
			role="toolbar"
			aria-label="Rich text formatting toolbar"
		>
			<!-- Text formatting -->
			<div
				class="flex items-center gap-1 border-r pr-2 mr-2"
				style="border-color: {$currentTheme.base.border};"
			>
				<button
					type="button"
					onclick={toggleBold}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('bold') ? 'active' : ''}"
					aria-pressed={isActive('bold')}
					title="Bold (Ctrl+B)"
				>
					<strong>B</strong>
				</button>
				<button
					type="button"
					onclick={toggleItalic}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('italic') ? 'active' : ''}"
					aria-pressed={isActive('italic')}
					title="Italic (Ctrl+I)"
				>
					<em>I</em>
				</button>
				<button
					type="button"
					onclick={toggleStrike}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('strike') ? 'active' : ''}"
					aria-pressed={isActive('strike')}
					title="Strikethrough"
				>
					<span style="text-decoration: line-through;">S</span>
				</button>
			</div>

			<!-- Headings -->
			<div
				class="flex items-center gap-1 border-r pr-2 mr-2"
				style="border-color: {$currentTheme.base.border};"
			>
				<button
					type="button"
					onclick={() => toggleHeading(1)}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('heading', { level: 1 }) ? 'active' : ''}"
					aria-pressed={isActive('heading', { level: 1 })}
					title="Heading 1"
				>
					H1
				</button>
				<button
					type="button"
					onclick={() => toggleHeading(2)}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('heading', { level: 2 }) ? 'active' : ''}"
					aria-pressed={isActive('heading', { level: 2 })}
					title="Heading 2"
				>
					H2
				</button>
				<button
					type="button"
					onclick={() => toggleHeading(3)}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('heading', { level: 3 }) ? 'active' : ''}"
					aria-pressed={isActive('heading', { level: 3 })}
					title="Heading 3"
				>
					H3
				</button>
			</div>

			<!-- Lists -->
			<div
				class="flex items-center gap-1 border-r pr-2 mr-2"
				style="border-color: {$currentTheme.base.border};"
			>
				<button
					type="button"
					onclick={toggleBulletList}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('bulletList') ? 'active' : ''}"
					aria-pressed={isActive('bulletList')}
					title="Bullet List"
				>
					•
				</button>
				<button
					type="button"
					onclick={toggleOrderedList}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('orderedList') ? 'active' : ''}"
					aria-pressed={isActive('orderedList')}
					title="Numbered List"
				>
					1.
				</button>
				<button
					type="button"
					onclick={toggleBlockquote}
					disabled={!editor || disabled}
					class="toolbar-btn {isActive('blockquote') ? 'active' : ''}"
					aria-pressed={isActive('blockquote')}
					title="Quote"
				>
					"
				</button>
			</div>

			<!-- Undo/Redo -->
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={undo}
					disabled={!editor || disabled || !canUndo}
					class="toolbar-btn"
					title="Undo (Ctrl+Z)"
				>
					↶
				</button>
				<button
					type="button"
					onclick={redo}
					disabled={!editor || disabled || !canRedo}
					class="toolbar-btn"
					title="Redo (Ctrl+Y)"
				>
					↷
				</button>
			</div>
		</div>

		<!-- Editor Content -->
		<div
			bind:this={editorElement}
			{id}
			class="prose prose-sm max-w-none p-4 focus:outline-none min-h-[{minHeight}] max-h-[{maxHeight}] overflow-y-auto"
			style="color: {$currentTheme.base
				.foreground}; min-height: {minHeight}; max-height: {maxHeight};"
			role="textbox"
			aria-multiline="true"
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledBy}
			aria-required={required}
			aria-describedby={id ? `${id}-description` : undefined}
			contenteditable="true"
		></div>
	</div>
{/if}

<!-- Add description for screen readers -->
{#if id && (required || ariaLabel || ariaLabelledBy)}
	<div id="{id}-description" class="sr-only">
		{#if required}Required field.
		{/if}
		Rich text editor for {ariaLabel || placeholder}. Use toolbar buttons to format text.
	</div>
{/if}

<style>
	.toolbar-btn {
		@apply px-2 py-1 text-sm font-medium rounded border transition-colors hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1;
		background-color: transparent;
		border-color: var(--border-color, #d1d5db);
		color: var(--text-color, #374151);
	}

	.toolbar-btn:hover:not(:disabled) {
		background-color: rgba(59, 130, 246, 0.1);
	}

	.toolbar-btn:disabled {
		@apply opacity-50 cursor-not-allowed;
	}

	.toolbar-btn.active {
		@apply bg-blue-100 border-blue-300 text-blue-700;
	}

	/* Editor content styles */
	:global(.rich-text-editor .ProseMirror) {
		outline: none;
	}

	:global(.rich-text-editor .ProseMirror.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #adb5bd;
		pointer-events: none;
		height: 0;
	}

	/* Prose styles for content */
	:global(.rich-text-editor .prose h1) {
		@apply text-2xl font-bold mb-4 mt-6 first:mt-0;
	}

	:global(.rich-text-editor .prose h2) {
		@apply text-xl font-bold mb-3 mt-5 first:mt-0;
	}

	:global(.rich-text-editor .prose h3) {
		@apply text-lg font-bold mb-2 mt-4 first:mt-0;
	}

	:global(.rich-text-editor .prose p) {
		@apply mb-3 last:mb-0;
	}

	:global(.rich-text-editor .prose ul) {
		@apply list-disc pl-6 mb-3 space-y-1;
	}

	:global(.rich-text-editor .prose ol) {
		@apply list-decimal pl-6 mb-3 space-y-1;
	}

	:global(.rich-text-editor .prose li) {
		@apply leading-relaxed;
	}

	:global(.rich-text-editor .prose blockquote) {
		@apply border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-3;
	}

	:global(.rich-text-editor .prose strong) {
		@apply font-semibold;
	}

	:global(.rich-text-editor .prose em) {
		@apply italic;
	}

	:global(.rich-text-editor .prose s) {
		@apply line-through;
	}
</style>
