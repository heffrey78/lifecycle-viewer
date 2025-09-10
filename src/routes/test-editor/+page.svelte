<script lang="ts">
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import { currentTheme } from '$lib/theme';

	let content = $state('');
</script>

<div class="container mx-auto p-6">
	<h1 class="text-2xl font-bold mb-6" style="color: {$currentTheme.base.foreground};">
		Rich Text Editor Test Page
	</h1>

	<div class="space-y-4">
		<div
			id="current_state_label"
			class="block text-sm font-medium"
			style="color: {$currentTheme.base.foreground};"
		>
			Test Editor
		</div>

		<RichTextEditor
			id="test_editor"
			{content}
			placeholder="Start typing to test the rich text editor..."
			minHeight="200px"
			maxHeight="400px"
			aria-labelledby="current_state_label"
			onUpdate={(newContent) => {
				content = newContent;
			}}
		/>

		<div class="mt-4">
			<h2 class="text-lg font-semibold mb-2" style="color: {$currentTheme.base.foreground};">
				Content Preview:
			</h2>
			<div
				class="p-4 border rounded-lg"
				style="border-color: {$currentTheme.base.border}; background-color: {$currentTheme.base
					.surface};"
			>
				{@html content || '<em>No content yet...</em>'}
			</div>
		</div>
	</div>
</div>
