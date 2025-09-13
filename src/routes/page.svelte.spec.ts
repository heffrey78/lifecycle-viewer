import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import Page from './+page.svelte';

// Mock the MCP client
vi.mock('$lib/services/lifecycle-mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn().mockReturnValue(true),
		connect: vi.fn().mockResolvedValue(undefined),
		project: {
			getProjectMetrics: vi.fn().mockResolvedValue({
				success: true,
				data: {
					requirements: {
						total: 10,
						by_status: {
							Draft: 3,
							'Under Review': 2,
							Approved: 5,
							Architecture: 0,
							Ready: 0,
							Implemented: 0,
							Validated: 0,
							Deprecated: 0
						},
						by_priority: {
							P0: 2,
							P1: 3,
							P2: 3,
							P3: 2
						},
						completion_percentage: 50
					},
					tasks: {
						total: 8,
						by_status: {
							'Not Started': 4,
							'In Progress': 2,
							Blocked: 1,
							Complete: 1,
							Abandoned: 0
						},
						by_assignee: {
							'John Doe': 3,
							'Jane Smith': 2,
							Unassigned: 3
						},
						completion_percentage: 25
					},
					architecture: {
						total: 2,
						by_status: {
							Proposed: 1,
							Accepted: 1,
							Rejected: 0,
							Deprecated: 0,
							Superseded: 0,
							Draft: 0,
							'Under Review': 0,
							Approved: 0,
							Implemented: 0
						},
						by_type: {
							ADR: 1,
							TDD: 1,
							RFC: 0
						}
					}
				}
			})
		}
	}
}));

describe('/+page.svelte', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render dashboard content', async () => {
		render(Page);

		// Wait for the component to load
		await waitFor(() => {
			// Check for Requirements heading
			expect(screen.getByRole('heading', { level: 3, name: 'Requirements' })).toBeInTheDocument();
		});

		// Check for other expected headings
		expect(screen.getByRole('heading', { level: 3, name: 'Tasks' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 3, name: 'Architecture' })).toBeInTheDocument();
	});
});
