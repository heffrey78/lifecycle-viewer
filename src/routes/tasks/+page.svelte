<script lang="ts">
  import { onMount } from 'svelte';
  import { mcpClient } from '$lib/services/mcp-client.js';
  import type { Task, TaskFilters, TaskStatus, Priority, EffortSize } from '$lib/types/lifecycle.js';
  import { Search, Filter, Plus, Eye, Edit, Trash2, AlertTriangle, User, Clock } from 'lucide-svelte';
  import ErrorNotification from '$lib/components/ErrorNotification.svelte';

  let tasks: Task[] = [];
  let filteredTasks: Task[] = [];
  let loading = true;
  let error = '';
  
  // Filters
  let searchText = '';
  let statusFilter: TaskStatus | '' = '';
  let priorityFilter: Priority | '' = '';
  let assigneeFilter = '';


  onMount(async () => {
    try {
      // Connect to MCP server if not already connected
      if (!mcpClient.isConnected()) {
        await mcpClient.connect();
      }
      
      const response = await mcpClient.getTasksJson();
      if (response.success) {
        tasks = response.data!;
      } else {
        throw new Error(response.error || 'Failed to fetch tasks');
      }
      
      filteredTasks = tasks;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      tasks = [];
      filteredTasks = [];
    } finally {
      loading = false;
    }
  });

  // Filter tasks based on current filters
  $: {
    filteredTasks = tasks.filter(task => {
      const matchesSearch = !searchText || 
        task.title.toLowerCase().includes(searchText.toLowerCase()) ||
        task.user_story?.toLowerCase().includes(searchText.toLowerCase()) ||
        task.id.toLowerCase().includes(searchText.toLowerCase());
      
      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesPriority = !priorityFilter || task.priority === priorityFilter;
      const matchesAssignee = !assigneeFilter || task.assignee?.includes(assigneeFilter);
      
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });
  }

  function getStatusColor(status: TaskStatus): string {
    const colors: Record<TaskStatus, string> = {
      'Not Started': 'bg-red-100 text-red-800 border-red-200',
      'In Progress': 'bg-orange-100 text-orange-800 border-orange-200',
      'Blocked': 'bg-red-200 text-red-900 border-red-300',
      'Complete': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Abandoned': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  }

  function getPriorityColor(priority: Priority): string {
    const colors: Record<Priority, string> = {
      'P0': 'bg-red-100 text-red-800 border-red-200',
      'P1': 'bg-orange-100 text-orange-800 border-orange-200',
      'P2': 'bg-blue-100 text-blue-800 border-blue-200',
      'P3': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[priority];
  }

  function getEffortColor(effort: EffortSize): string {
    const colors: Record<EffortSize, string> = {
      'XS': 'bg-green-100 text-green-800',
      'S': 'bg-blue-100 text-blue-800',
      'M': 'bg-yellow-100 text-yellow-800',
      'L': 'bg-orange-100 text-orange-800',
      'XL': 'bg-red-100 text-red-800'
    };
    return colors[effort] || 'bg-gray-100 text-gray-800';
  }

  function formatAssignee(email?: string): string {
    if (!email) return 'Unassigned';
    return email.split('@')[0].replace(/\./g, ' ');
  }

  function getDaysAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  function clearFilters(): void {
    searchText = '';
    statusFilter = '';
    priorityFilter = '';
    assigneeFilter = '';
  }

  // Get unique assignees for filter
  $: uniqueAssignees = [...new Set(tasks.map(t => t.assignee).filter(Boolean))];

  async function viewTask(id: string): Promise<void> {
    console.log('Viewing task:', id);
  }

  async function editTask(id: string): Promise<void> {
    console.log('Editing task:', id);
  }

  async function deleteTask(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this task?')) {
      console.log('Deleting task:', id);
    }
  }
</script>

<svelte:head>
  <title>Tasks - Lifecycle Viewer</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header with Actions -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Tasks</h1>
      <p class="text-gray-600">Track and manage implementation tasks</p>
    </div>
    <button class="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
      <Plus class="w-4 h-4 mr-2" />
      New Task
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search tasks..."
          bind:value={searchText}
          class="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <!-- Status Filter -->
      <select
        bind:value={statusFilter}
        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="">All Statuses</option>
        <option value="Not Started">Not Started</option>
        <option value="In Progress">In Progress</option>
        <option value="Blocked">Blocked</option>
        <option value="Complete">Complete</option>
        <option value="Abandoned">Abandoned</option>
      </select>

      <!-- Priority Filter -->
      <select
        bind:value={priorityFilter}
        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="">All Priorities</option>
        <option value="P0">P0 - Critical</option>
        <option value="P1">P1 - High</option>
        <option value="P2">P2 - Medium</option>
        <option value="P3">P3 - Low</option>
      </select>

      <!-- Assignee Filter -->
      <select
        bind:value={assigneeFilter}
        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="">All Assignees</option>
        {#each uniqueAssignees as assignee}
          <option value={assignee}>{formatAssignee(assignee)}</option>
        {/each}
        <option value="unassigned">Unassigned</option>
      </select>
    </div>

    {#if searchText || statusFilter || priorityFilter || assigneeFilter}
      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm text-gray-600">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
        <button 
          on:click={clearFilters}
          class="text-sm text-emerald-600 hover:text-emerald-800"
        >
          Clear Filters
        </button>
      </div>
    {/if}
  </div>

  <!-- Tasks List -->
  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  {:else if error && tasks.length === 0}
    <ErrorNotification 
      {error} 
      onRetry={async () => { 
        loading = true; 
        error = '';
        try {
          if (!mcpClient.isConnected()) {
            await mcpClient.connect();
          }
          const response = await mcpClient.getTasksJson();
          if (response.success) {
            tasks = response.data!;
            filteredTasks = tasks;
          } else {
            throw new Error(response.error || 'Failed to fetch tasks');
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        } finally {
          loading = false;
        }
      }} 
      onDismiss={() => error = ''} 
    />
  {:else if filteredTasks.length === 0}
    <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
      <Filter class="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
      <p class="text-gray-500">
        {tasks.length === 0 
          ? 'No tasks have been created yet.' 
          : 'Try adjusting your filters to see more results.'}
      </p>
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Effort
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignee
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredTasks as task}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <div class="flex items-center space-x-2">
                      <span class="text-xs font-mono text-gray-500">{task.id}</span>
                      {#if task.github_issue_number}
                        <a 
                          href={task.github_issue_url} 
                          target="_blank"
                          class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          title="View GitHub Issue"
                        >
                          #{task.github_issue_number}
                        </a>
                      {/if}
                    </div>
                    <h4 class="text-sm font-medium text-gray-900 mt-1">{task.title}</h4>
                    {#if task.user_story}
                      <p class="text-sm text-gray-600 mt-1 line-clamp-2">{task.user_story}</p>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded border {getStatusColor(task.status)}">
                    {task.status}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded border {getPriorityColor(task.priority)}">
                    {task.priority}
                  </span>
                </td>
                <td class="px-6 py-4">
                  {#if task.effort}
                    <span class="inline-flex px-2 py-1 text-xs font-medium rounded {getEffortColor(task.effort)}">
                      {task.effort}
                    </span>
                  {:else}
                    <span class="text-gray-400">-</span>
                  {/if}
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center">
                    <User class="w-4 h-4 text-gray-400 mr-2" />
                    <span class="text-sm text-gray-900">
                      {formatAssignee(task.assignee)}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center text-sm text-gray-500">
                    <Clock class="w-4 h-4 mr-1" />
                    {getDaysAgo(task.updated_at)}
                  </div>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end space-x-2">
                    <button 
                      on:click={() => viewTask(task.id)}
                      class="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                      title="View Details"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button 
                      on:click={() => editTask(task.id)}
                      class="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                      title="Edit"
                    >
                      <Edit class="w-4 h-4" />
                    </button>
                    <button 
                      on:click={() => deleteTask(task.id)}
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
  {#if filteredTasks.length > 0}
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Task Summary</h3>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
        <div>
          <p class="text-2xl font-bold text-emerald-600">
            {filteredTasks.length}
          </p>
          <p class="text-sm text-gray-600">Total Tasks</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-green-600">
            {filteredTasks.filter(t => t.status === 'Complete').length}
          </p>
          <p class="text-sm text-gray-600">Complete</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-orange-600">
            {filteredTasks.filter(t => t.status === 'In Progress').length}
          </p>
          <p class="text-sm text-gray-600">In Progress</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-red-600">
            {filteredTasks.filter(t => t.status === 'Blocked').length}
          </p>
          <p class="text-sm text-gray-600">Blocked</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-red-600">
            {filteredTasks.filter(t => t.priority === 'P0').length}
          </p>
          <p class="text-sm text-gray-600">Critical</p>
        </div>
      </div>
    </div>
  {/if}
</div>
