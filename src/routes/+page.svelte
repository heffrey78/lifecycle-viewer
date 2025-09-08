<script lang="ts">
	import { onMount } from 'svelte';
	import { mcpClient } from '$lib/services/lifecycle-mcp-client.js';
	import type { ProjectMetrics, RequirementProgress } from '$lib/types/lifecycle.js';
	import { FileText, CheckSquare, GitBranch, TrendingUp, AlertTriangle } from 'lucide-svelte';
	import ErrorNotification from '$lib/components/ErrorNotification.svelte';

	let projectMetrics: ProjectMetrics | null = null;
	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			// Connect to MCP server if not already connected
			if (!mcpClient.isConnected()) {
				await mcpClient.connect();
			}

			const response = await mcpClient.project.getProjectMetrics();
			if (response.success) {
				projectMetrics = response.data!;
			} else {
				throw new Error(response.error || 'Failed to fetch project metrics');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			projectMetrics = null;
		} finally {
			loading = false;
		}
	});

	function getStatusColor(status: string): string {
		const statusColors: Record<string, string> = {
			// Requirement statuses
			Draft: 'bg-red-500',
			'Under Review': 'bg-orange-500',
			Approved: 'bg-blue-500',
			Architecture: 'bg-purple-500',
			Ready: 'bg-emerald-500',
			Implemented: 'bg-emerald-600',
			Validated: 'bg-emerald-700',
			Deprecated: 'bg-gray-500',

			// Task statuses
			'Not Started': 'bg-red-500',
			'In Progress': 'bg-orange-500',
			Blocked: 'bg-red-800',
			Complete: 'bg-emerald-500',
			Abandoned: 'bg-gray-500',

			// Architecture statuses
			Proposed: 'bg-orange-500',
			Accepted: 'bg-emerald-500',
			Rejected: 'bg-red-500'
		};
		return statusColors[status] || 'bg-gray-400';
	}

	function getPriorityColor(priority: string): string {
		const priorityColors: Record<string, string> = {
			P0: 'bg-red-600',
			P1: 'bg-orange-500',
			P2: 'bg-blue-500',
			P3: 'bg-gray-500'
		};
		return priorityColors[priority] || 'bg-gray-400';
	}
</script>

<svelte:head>
	<title>Dashboard - Lifecycle Viewer</title>
</svelte:head>

{#if loading}
	<div class="flex items-center justify-center h-64">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
	</div>
{:else if error && !projectMetrics}
	<ErrorNotification
		{error}
		onRetry={async () => {
			loading = true;
			error = '';
			try {
				if (!mcpClient.isConnected()) {
					await mcpClient.connect();
				}
				const response = await mcpClient.project.getProjectMetrics();
				if (response.success) {
					projectMetrics = response.data!;
				} else {
					throw new Error(response.error || 'Failed to fetch project metrics');
				}
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
				projectMetrics = null;
			} finally {
				loading = false;
			}
		}}
		onDismiss={() => (error = '')}
	/>
{:else if projectMetrics}
	<div class="space-y-6">
		<!-- Overview Cards -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<!-- Requirements Card -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<FileText class="h-8 w-8 text-blue-600" />
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-gray-900">Requirements</h3>
						<p class="text-2xl font-bold text-gray-900">{projectMetrics.requirements.total}</p>
						<p class="text-sm text-gray-500">
							{projectMetrics.requirements.completion_percentage.toFixed(1)}% Complete
						</p>
					</div>
				</div>
				<div class="mt-4">
					<div class="bg-gray-200 rounded-full h-2">
						<div
							class="bg-blue-600 h-2 rounded-full"
							style="width: {projectMetrics.requirements.completion_percentage}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Tasks Card -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<CheckSquare class="h-8 w-8 text-emerald-600" />
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-gray-900">Tasks</h3>
						<p class="text-2xl font-bold text-gray-900">{projectMetrics.tasks.total}</p>
						<p class="text-sm text-gray-500">
							{projectMetrics.tasks.completion_percentage.toFixed(1)}% Complete
						</p>
					</div>
				</div>
				<div class="mt-4">
					<div class="bg-gray-200 rounded-full h-2">
						<div
							class="bg-emerald-600 h-2 rounded-full"
							style="width: {projectMetrics.tasks.completion_percentage}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Architecture Card -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<GitBranch class="h-8 w-8 text-purple-600" />
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-gray-900">Architecture</h3>
						<p class="text-2xl font-bold text-gray-900">{projectMetrics.architecture.total}</p>
						<p class="text-sm text-gray-500">
							{Object.entries(projectMetrics.architecture.by_status).filter(
								([, count]) => ['Accepted', 'Implemented'].includes(status) && count > 0
							).length} Decisions
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Detailed Status Breakdown -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Requirements Status -->
			<div class="bg-white rounded-lg shadow">
				<div class="px-6 py-4 border-b border-gray-200">
					<h3 class="text-lg font-medium text-gray-900">Requirements by Status</h3>
				</div>
				<div class="p-6">
					<div class="space-y-3">
						{#each Object.entries(projectMetrics.requirements.by_status) as [status, count]}
							{#if count > 0}
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div class="w-3 h-3 rounded-full {getStatusColor(status)} mr-3"></div>
										<span class="text-sm font-medium text-gray-900">{status}</span>
									</div>
									<span class="text-sm text-gray-500">{count}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<!-- Tasks Status -->
			<div class="bg-white rounded-lg shadow">
				<div class="px-6 py-4 border-b border-gray-200">
					<h3 class="text-lg font-medium text-gray-900">Tasks by Status</h3>
				</div>
				<div class="p-6">
					<div class="space-y-3">
						{#each Object.entries(projectMetrics.tasks.by_status) as [status, count]}
							{#if count > 0}
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div class="w-3 h-3 rounded-full {getStatusColor(status)} mr-3"></div>
										<span class="text-sm font-medium text-gray-900">{status}</span>
									</div>
									<span class="text-sm text-gray-500">{count}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<!-- Priority Distribution -->
			<div class="bg-white rounded-lg shadow">
				<div class="px-6 py-4 border-b border-gray-200">
					<h3 class="text-lg font-medium text-gray-900">Requirements by Priority</h3>
				</div>
				<div class="p-6">
					<div class="space-y-3">
						{#each Object.entries(projectMetrics.requirements.by_priority) as [priority, count]}
							{#if count > 0}
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div class="w-3 h-3 rounded-full {getPriorityColor(priority)} mr-3"></div>
										<span class="text-sm font-medium text-gray-900">{priority}</span>
									</div>
									<span class="text-sm text-gray-500">{count}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<!-- Team Workload -->
			<div class="bg-white rounded-lg shadow">
				<div class="px-6 py-4 border-b border-gray-200">
					<h3 class="text-lg font-medium text-gray-900">Task Assignment</h3>
				</div>
				<div class="p-6">
					<div class="space-y-3">
						{#each Object.entries(projectMetrics.tasks.by_assignee) as [assignee, count]}
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-gray-900">
									{assignee === 'unassigned' ? 'Unassigned' : assignee.split('@')[0]}
								</span>
								<span class="text-sm text-gray-500">{count} tasks</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="bg-white rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-medium text-gray-900">Quick Actions</h3>
			</div>
			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<a
						href="/requirements"
						class="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
					>
						<FileText class="w-6 h-6 text-blue-600 mr-3" />
						<div>
							<p class="font-medium text-blue-900">Manage Requirements</p>
							<p class="text-sm text-blue-700">View and edit project requirements</p>
						</div>
					</a>

					<a
						href="/tasks"
						class="flex items-center p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
					>
						<CheckSquare class="w-6 h-6 text-emerald-600 mr-3" />
						<div>
							<p class="font-medium text-emerald-900">Track Tasks</p>
							<p class="text-sm text-emerald-700">Monitor task progress and assignments</p>
						</div>
					</a>

					<a
						href="/architecture"
						class="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
					>
						<GitBranch class="w-6 h-6 text-purple-600 mr-3" />
						<div>
							<p class="font-medium text-purple-900">Review Architecture</p>
							<p class="text-sm text-purple-700">View architecture decisions and designs</p>
						</div>
					</a>
				</div>
			</div>
		</div>
	</div>
{/if}
