<script lang="ts">
  import { page } from '$app/stores';
  import { Home, FileText, CheckSquare, GitBranch, Settings } from 'lucide-svelte';
  import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';

  let connected = false;
  let connectionError = '';

  const navItems = [
    { href: '/', icon: Home, label: 'Dashboard' },
    { href: '/requirements', icon: FileText, label: 'Requirements' },
    { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { href: '/architecture', icon: GitBranch, label: 'Architecture' },
    { href: '/settings', icon: Settings, label: 'Settings' }
  ];
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Navigation Sidebar -->
  <div class="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
    <div class="flex flex-col h-full">
      <!-- Logo/Title -->
      <div class="flex items-center justify-center h-16 px-4 bg-blue-600 text-white">
        <h1 class="text-xl font-bold">Lifecycle Viewer</h1>
      </div>

      <!-- Connection Status -->
      <div class="border-b border-gray-200">
        <ConnectionStatus bind:connected bind:error={connectionError} />
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-4 py-4 space-y-2">
        {#each navItems as item}
          <a
            href={item.href}
            class="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors
                   {$page.url.pathname === item.href ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' : ''}"
          >
            <svelte:component this={item.icon} class="w-5 h-5" />
            <span class="font-medium">{item.label}</span>
          </a>
        {/each}
      </nav>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-gray-200">
        <p class="text-xs text-gray-500 text-center">
          Lifecycle Management System
        </p>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="ml-64">
    <!-- Top Bar -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="px-6 py-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-semibold text-gray-900">
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
            {#if !connected}
              <div class="text-sm text-red-600">
                Not connected to MCP server
              </div>
            {/if}
          </div>
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <main class="p-6">
      <slot />
    </main>
  </div>
</div>
