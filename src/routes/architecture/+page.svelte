<script lang="ts">
  import { onMount } from 'svelte';
  import { mcpClient } from '$lib/services/mcp-client.js';
  import { Search, Filter, Plus, Eye, Edit, Trash2, FileText } from 'lucide-svelte';
  import ErrorNotification from '$lib/components/ErrorNotification.svelte';

  let architectureDecisions: any[] = [];
  let filteredDecisions: any[] = [];
  let loading = true;
  let error = '';
  
  // Filters
  let searchText = '';

  onMount(async () => {
    try {
      // Connect to MCP server if not already connected
      if (!mcpClient.isConnected()) {
        await mcpClient.connect();
      }
      
      const response = await mcpClient.getArchitectureDecisionsJson();
      if (response.success) {
        architectureDecisions = response.data!;
      } else {
        throw new Error(response.error || 'Failed to fetch architecture decisions');
      }
      
      filteredDecisions = architectureDecisions;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      architectureDecisions = [];
      filteredDecisions = [];
    } finally {
      loading = false;
    }
  });

  // Filter decisions based on current filters
  $: {
    filteredDecisions = architectureDecisions.filter(decision => {
      const matchesSearch = !searchText || 
        decision.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        decision.context?.toLowerCase().includes(searchText.toLowerCase()) ||
        decision.id?.toLowerCase().includes(searchText.toLowerCase());
      
      return matchesSearch;
    });
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'Draft': 'bg-red-100 text-red-800 border-red-200',
      'Proposed': 'bg-orange-100 text-orange-800 border-orange-200',
      'Accepted': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Deprecated': 'bg-gray-100 text-gray-800 border-gray-200',
      'Superseded': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  }

  function clearFilters(): void {
    searchText = '';
  }

  async function viewDecision(id: string): Promise<void> {
    console.log('Viewing architecture decision:', id);
  }

  async function editDecision(id: string): Promise<void> {
    console.log('Editing architecture decision:', id);
  }

  async function deleteDecision(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this architecture decision?')) {
      console.log('Deleting architecture decision:', id);
    }
  }
</script>

<svelte:head>
  <title>Architecture - Lifecycle Viewer</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header with Actions -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Architecture Decisions</h1>
      <p class="text-gray-600">Manage and track architectural decision records (ADRs)</p>
    </div>
    <button class="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
      <Plus class="w-4 h-4 mr-2" />
      New ADR
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search architecture decisions..."
          bind:value={searchText}
          class="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      <div class="flex justify-end">
        {#if searchText}
          <button 
            on:click={clearFilters}
            class="text-sm text-purple-600 hover:text-purple-800"
          >
            Clear Filters
          </button>
        {/if}
      </div>
    </div>

    {#if searchText}
      <div class="mt-4">
        <p class="text-sm text-gray-600">
          Showing {filteredDecisions.length} of {architectureDecisions.length} architecture decisions
        </p>
      </div>
    {/if}
  </div>

  <!-- Architecture Decisions List -->
  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error && architectureDecisions.length === 0}
    <ErrorNotification 
      {error} 
      onRetry={async () => { 
        loading = true; 
        error = '';
        try {
          if (!mcpClient.isConnected()) {
            await mcpClient.connect();
          }
          const response = await mcpClient.getArchitectureDecisionsJson();
          if (response.success) {
            architectureDecisions = response.data!;
            filteredDecisions = architectureDecisions;
          } else {
            throw new Error(response.error || 'Failed to fetch architecture decisions');
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        } finally {
          loading = false;
        }
      }} 
      onDismiss={() => error = ''} 
    />
  {:else if filteredDecisions.length === 0}
    <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
      <FileText class="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No architecture decisions found</h3>
      <p class="text-gray-500">
        {architectureDecisions.length === 0 
          ? 'No architecture decisions have been created yet.' 
          : 'Try adjusting your search to see more results.'}
      </p>
      <div class="mt-6">
        <button class="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mx-auto">
          <Plus class="w-4 h-4 mr-2" />
          Create First ADR
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Architecture Decision
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Authors
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredDecisions as decision}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <span class="text-xs font-mono text-gray-500 mb-1">{decision.id}</span>
                    <h4 class="text-sm font-medium text-gray-900">{decision.title}</h4>
                    {#if decision.context}
                      <p class="text-sm text-gray-600 mt-1 line-clamp-2">{decision.context}</p>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded border {getStatusColor(decision.status)}">
                    {decision.status}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">
                    {#if decision.authors && decision.authors.length > 0}
                      {decision.authors.join(', ')}
                    {:else}
                      <span class="text-gray-400">No authors</span>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {new Date(decision.created_at).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end space-x-2">
                    <button 
                      on:click={() => viewDecision(decision.id)}
                      class="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                      title="View Details"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button 
                      on:click={() => editDecision(decision.id)}
                      class="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                      title="Edit"
                    >
                      <Edit class="w-4 h-4" />
                    </button>
                    <button 
                      on:click={() => deleteDecision(decision.id)}
                      class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Summary Stats -->
  {#if filteredDecisions.length > 0}
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Architecture Summary</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <p class="text-2xl font-bold text-purple-600">
            {filteredDecisions.length}
          </p>
          <p class="text-sm text-gray-600">Total ADRs</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-emerald-600">
            {filteredDecisions.filter(d => d.status === 'Accepted').length}
          </p>
          <p class="text-sm text-gray-600">Accepted</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-orange-600">
            {filteredDecisions.filter(d => d.status === 'Proposed').length}
          </p>
          <p class="text-sm text-gray-600">Proposed</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-600">
            {filteredDecisions.filter(d => d.status === 'Draft').length}
          </p>
          <p class="text-sm text-gray-600">Draft</p>
        </div>
      </div>
    </div>
  {/if}
</div>