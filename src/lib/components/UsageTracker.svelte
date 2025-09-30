<script lang="ts">
	import { usageTracker } from '$lib/services/usage-tracker';
	import { currentTheme } from '$lib/theme';

	const usage = usageTracker.getUsageStore();

	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	function formatCost(cost: number): string {
		return `$${cost.toFixed(4)}`;
	}
</script>

<div
	class="text-xs space-y-1 p-3 rounded-lg border"
	style="border-color: {$currentTheme.base.border}; background-color: {$currentTheme.base
		.background};"
>
	<div class="font-medium mb-2" style="color: {$currentTheme.base.foreground};">API Usage</div>

	<div class="grid grid-cols-2 gap-3 text-xs">
		<!-- Session Stats -->
		<div>
			<div class="font-medium mb-1" style="color: {$currentTheme.base.foreground};">Session</div>
			<div style="color: {$currentTheme.base.muted};">
				<div>Tokens: {formatNumber($usage.sessionTokens.total)}</div>
				<div>Messages: {$usage.messageCount.session}</div>
				<div>Cost: {formatCost($usage.estimatedCost.session)}</div>
			</div>
		</div>

		<!-- Total Stats -->
		<div>
			<div class="font-medium mb-1" style="color: {$currentTheme.base.foreground};">Total</div>
			<div style="color: {$currentTheme.base.muted};">
				<div>Tokens: {formatNumber($usage.totalTokens.total)}</div>
				<div>Messages: {$usage.messageCount.total}</div>
				<div>Cost: {formatCost($usage.estimatedCost.total)}</div>
			</div>
		</div>
	</div>

	{#if $usage.sessionTokens.total > 0}
		<div
			class="mt-2 pt-2 border-t text-xs"
			style="border-color: {$currentTheme.base.border}; color: {$currentTheme.base.muted};"
		>
			Input: {formatNumber($usage.sessionTokens.input)} | Output: {formatNumber(
				$usage.sessionTokens.output
			)}
		</div>
	{/if}
</div>
