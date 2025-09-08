<script lang="ts">
	import { page } from '$app/stores';
	import { Home, FileText, CheckSquare, GitBranch, Settings, Palette } from 'lucide-svelte';
	import ProjectName from '$lib/components/ProjectName.svelte';
	import { currentTheme, setTheme, defaultThemes } from '$lib/theme';

	const navItems = [
		{ href: '/', icon: Home, label: 'Dashboard' },
		{ href: '/requirements', icon: FileText, label: 'Requirements' },
		{ href: '/tasks', icon: CheckSquare, label: 'Tasks' },
		{ href: '/architecture', icon: GitBranch, label: 'Architecture' },
		{ href: '/settings', icon: Settings, label: 'Settings' }
	];

	let showThemeDropdown = false;

	function handleThemeChange(themeId: string) {
		setTheme(themeId);
		showThemeDropdown = false;
	}
</script>

<div class="min-h-screen" style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base.foreground};">
	<!-- Navigation Sidebar -->
	<div class="fixed inset-y-0 left-0 w-64 shadow-lg" style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base.border};">
		<div class="flex flex-col h-full">
			<!-- Logo/Title -->
			<div class="flex items-center justify-center h-16 px-4" style="background-color: {$currentTheme.base.accent}; color: {$currentTheme.id === 'high-contrast' ? 'black' : 'white'};">
				<h1 class="text-xl font-bold">Lifecycle Viewer</h1>
			</div>

			<!-- Navigation Links -->
			<nav class="flex-1 px-4 py-4 space-y-2">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors
                   {$page.url.pathname === item.href
							? 'border-r-2'
							: ''}"
						style="color: {$currentTheme.base.foreground}; 
							{$page.url.pathname === item.href 
								? `background-color: ${$currentTheme.semantic.primary.background}20; color: ${$currentTheme.base.accent}; border-color: ${$currentTheme.base.accent};`
								: ''}"
						on:mouseenter={(e) => {
							if ($page.url.pathname !== item.href) {
								e.currentTarget.style.backgroundColor = $currentTheme.base.muted + '20';
							}
						}}
						on:mouseleave={(e) => {
							if ($page.url.pathname !== item.href) {
								e.currentTarget.style.backgroundColor = 'transparent';
							}
						}}
					>
						<svelte:component this={item.icon} class="w-5 h-5" />
						<span class="font-medium">{item.label}</span>
					</a>
				{/each}
			</nav>

			<!-- Footer -->
			<div class="px-4 py-2 border-t" style="border-color: {$currentTheme.base.border};">
				<p class="text-xs text-center" style="color: {$currentTheme.base.muted};">Lifecycle Management System</p>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="ml-64">
		<!-- Top Bar -->
		<header class="shadow-sm border-b" style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base.border};">
			<div class="px-6 py-4">
				<div class="flex items-center justify-between">
					<h2 class="text-2xl font-semibold" style="color: {$currentTheme.base.foreground};">
						{#if $page.url.pathname === '/'}
							Dashboard
						{:else if $page.url.pathname === '/requirements'}
							Requirements
						{:else if $page.url.pathname === '/tasks'}
							Tasks
						{:else if $page.url.pathname === '/architecture'}
							Architecture
						{:else if $page.url.pathname === '/settings'}
							Settings
						{:else}
							Lifecycle Viewer
						{/if}
					</h2>

					<div class="flex items-center space-x-4">
						<ProjectName />
						
						<!-- Theme Switcher -->
						<div class="relative">
							<button
								on:click={() => showThemeDropdown = !showThemeDropdown}
								class="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
								style="color: {$currentTheme.base.foreground};"
								on:mouseenter={(e) => e.currentTarget.style.backgroundColor = $currentTheme.base.muted + '20'}
								on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
								aria-haspopup="true"
								aria-expanded={showThemeDropdown}
							>
								<Palette class="w-4 h-4" />
								<span>{$currentTheme.name}</span>
							</button>

							{#if showThemeDropdown}
								<div class="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border py-1 z-50" style="background-color: {$currentTheme.base.background}; border-color: {$currentTheme.base.border};">
									{#each Object.values(defaultThemes) as theme}
										<button
											on:click={() => handleThemeChange(theme.id)}
											class="w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors"
											style="color: {$currentTheme.base.foreground}; 
												{theme.id === $currentTheme.id ? `background-color: ${$currentTheme.base.accent}20; color: ${$currentTheme.base.accent};` : ''}"
											on:mouseenter={(e) => {
												if (theme.id !== $currentTheme.id) {
													e.currentTarget.style.backgroundColor = $currentTheme.base.muted + '20';
												}
											}}
											on:mouseleave={(e) => {
												if (theme.id !== $currentTheme.id) {
													e.currentTarget.style.backgroundColor = 'transparent';
												}
											}}
										>
											<div 
												class="w-3 h-3 rounded-full border"
												style="background-color: {theme.base.accent}; border-color: {$currentTheme.base.border};"
											></div>
											<div>
												<div class="font-medium">{theme.name}</div>
												<div class="text-xs" style="color: {$currentTheme.base.muted};">{theme.description}</div>
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</header>

		<!-- Page Content -->
		<main class="p-6" style="background-color: {$currentTheme.base.background}; color: {$currentTheme.base.foreground};">
			<slot />
		</main>
	</div>
</div>
