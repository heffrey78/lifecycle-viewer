// API Client for connecting to the MCP Bridge Server
// This client fetches data from the lifecycle MCP server via our bridge

import type { Requirement, Task, ArchitectureDecision, ProjectMetrics } from '$lib/types/lifecycle';

// Simplified interfaces that match the database structure
interface SimpleRequirement {
	id: string;
	title: string;
	state: string;
	priority: string;
	github_repo?: string;
	github_issue_number?: number | null;
	created_at: string;
	updated_at: string;
}

interface SimpleTask {
	id: string;
	title: string;
	status: string;
	priority: string;
	github_repo?: string;
	github_issue_number?: string | null;
	requirement_id?: string | null;
	parent_task_id?: string | null;
	created_at: string;
	updated_at: string;
}

interface SimpleArchitecture {
	id: string;
	component_name: string;
	dependencies?: string;
	requirement_id?: string;
	created_at: string;
	updated_at: string;
}

interface SimpleDashboardStats {
	totals: {
		requirements: number;
		tasks: number;
		architecture: number;
	};
	requirements: Record<string, number>;
	tasks: Record<string, number>;
}

class APIClient {
	private baseUrl = 'http://localhost:3000/api';
	private connected = false;

	async checkConnection(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/health`);
			const data = await response.json();
			this.connected = data.status === 'ok' && data.mcp_connected;
			return this.connected;
		} catch (error) {
			console.log('API connection failed - server not available');
			this.connected = false;
			return false;
		}
	}

	isConnected(): boolean {
		return this.connected;
	}

	async getRequirements(): Promise<SimpleRequirement[]> {
		if (!this.connected) {
			throw new Error('Not connected to MCP server');
		}

		try {
			const response = await fetch(`${this.baseUrl}/requirements`);
			if (!response.ok) {
				throw new Error(`Failed to fetch requirements: ${response.status} ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching requirements:', error);
			throw error;
		}
	}

	async getTasks(): Promise<SimpleTask[]> {
		if (!this.connected) {
			throw new Error('Not connected to MCP server');
		}

		try {
			const response = await fetch(`${this.baseUrl}/tasks`);
			if (!response.ok) {
				throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching tasks:', error);
			throw error;
		}
	}

	async getArchitecture(): Promise<SimpleArchitecture[]> {
		if (!this.connected) {
			throw new Error('Not connected to MCP server');
		}

		try {
			const response = await fetch(`${this.baseUrl}/architecture`);
			if (!response.ok) {
				throw new Error(`Failed to fetch architecture: ${response.status} ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching architecture:', error);
			throw error;
		}
	}

	async getDashboardStats(): Promise<SimpleDashboardStats> {
		if (!this.connected) {
			throw new Error('Not connected to MCP server');
		}

		try {
			const response = await fetch(`${this.baseUrl}/dashboard/stats`);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch dashboard stats: ${response.status} ${response.statusText}`
				);
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching dashboard stats:', error);
			throw error;
		}
	}

	async createSampleData(): Promise<void> {
		try {
			const response = await fetch(`${this.baseUrl}/sample-data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error('Failed to create sample data');
			}
		} catch (error) {
			console.error('Error creating sample data:', error);
			throw error;
		}
	}
}

export const apiClient = new APIClient();
