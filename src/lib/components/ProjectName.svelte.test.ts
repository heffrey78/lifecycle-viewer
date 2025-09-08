import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectName from './ProjectName.svelte';

// Mock the MCP client
vi.mock('$lib/services/lifecycle-mcp-client.js', () => ({
	mcpClient: {
		isConnected: vi.fn().mockReturnValue(true),
		connect: vi.fn().mockResolvedValue(undefined),
		database: {
			getCurrentDatabase: vi.fn()
		}
	}
}));

// Mock the project name utilities
vi.mock('$lib/utils/project-name.js', () => ({
	extractProjectName: vi.fn((path: string | null) => {
		if (!path) return 'No Project';
		if (path.includes('my-app')) return 'My App';
		if (path.includes('test-project')) return 'Test Project';
		return 'Sample Project';
	}),
	getDisplayPath: vi.fn((path: string | null) => {
		if (!path) return 'No database selected';
		return path.length > 30 ? `.../${path.slice(-20)}` : path;
	})
}));

describe('ProjectName Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset DOM event listeners
		window.removeEventListener('database-switched', () => {});
	});

	it('should render loading state initially', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		vi.mocked(mcpClient.database.getCurrentDatabase).mockImplementation(
			() => new Promise(() => {}) // Never resolves to keep loading state
		);

		const { container } = render(ProjectName);

		expect(container.textContent).toContain('Loading...');
		expect(container.querySelector('svg')).toBeTruthy(); // Database icon
	});

	it('should display project name when database is loaded', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		
		// Mock connection methods
		vi.mocked(mcpClient.isConnected).mockReturnValue(true);
		vi.mocked(mcpClient.connect).mockResolvedValue(undefined);
		
		vi.mocked(mcpClient.database.getCurrentDatabase).mockResolvedValue({
			success: true,
			data: '/path/to/my-app/lifecycle.db'
		});

		const { container } = render(ProjectName);

		// Wait for async operation
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(container.textContent).toContain('My App');
		expect(container.querySelector('[title*="Database:"]')).toBeTruthy();
	});

	it('should display "No Project" when no database is set', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		
		// Mock connection methods
		vi.mocked(mcpClient.isConnected).mockReturnValue(true);
		vi.mocked(mcpClient.connect).mockResolvedValue(undefined);
		
		vi.mocked(mcpClient.database.getCurrentDatabase).mockResolvedValue({
			success: true,
			data: null
		});

		const { container } = render(ProjectName);

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(container.textContent).toContain('No Project');
	});

	it('should display error state when database fetch fails', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		
		// Mock connection methods
		vi.mocked(mcpClient.isConnected).mockReturnValue(true);
		vi.mocked(mcpClient.connect).mockResolvedValue(undefined);
		
		vi.mocked(mcpClient.database.getCurrentDatabase).mockResolvedValue({
			success: false,
			error: 'Connection failed'
		});

		const { container } = render(ProjectName);

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(container.textContent).toContain('Database Error');
		expect(container.querySelector('[title*="Error:"]')).toBeTruthy();
	});

	it('should handle MCP client connection errors', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		vi.mocked(mcpClient.isConnected).mockReturnValue(false);
		vi.mocked(mcpClient.connect).mockRejectedValue(new Error('Connection failed'));

		const { container } = render(ProjectName);

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(container.textContent).toContain('Database Error');
	});

	it('should update when database-switched event is fired', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');

		// Mock connection methods for both calls
		vi.mocked(mcpClient.isConnected).mockReturnValue(true);
		vi.mocked(mcpClient.connect).mockResolvedValue(undefined);

		// Initial database
		vi.mocked(mcpClient.database.getCurrentDatabase).mockResolvedValueOnce({
			success: true,
			data: '/path/to/my-app/lifecycle.db'
		});

		const { container } = render(ProjectName);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(container.textContent).toContain('My App');

		// Mock for second call
		vi.mocked(mcpClient.database.getCurrentDatabase).mockResolvedValueOnce({
			success: true,
			data: '/path/to/test-project/data.db'
		});

		// Trigger the database-switched event
		window.dispatchEvent(
			new CustomEvent('database-switched', {
				detail: { databasePath: '/path/to/test-project/data.db' }
			})
		);

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(container.textContent).toContain('Test Project');
	});

	it('should include database icon', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		vi.mocked(mcpClient.database.getCurrentDatabase).mockImplementation(() => new Promise(() => {}));

		const { container } = render(ProjectName);

		const icon = container.querySelector('svg');
		expect(icon).toBeTruthy();
		expect(icon?.parentElement?.textContent).toContain('Loading...');
	});

	it('should show tooltip with database path', async () => {
		const { mcpClient } = await import('$lib/services/lifecycle-mcp-client.js');
		
		// Mock connection methods
		vi.mocked(mcpClient.isConnected).mockReturnValue(true);
		vi.mocked(mcpClient.connect).mockResolvedValue(undefined);
		
		vi.mocked(mcpClient.database.getCurrentDatabase).mockResolvedValue({
			success: true,
			data: '/path/to/my-app/lifecycle.db'
		});

		const { container } = render(ProjectName);
		await new Promise((resolve) => setTimeout(resolve, 50));

		const projectElement = container.querySelector('[title*="Database:"]');
		expect(projectElement).toBeTruthy();
		expect(projectElement?.getAttribute('title')).toContain('/path/to/my-app/lifecycle.db');
	});
});