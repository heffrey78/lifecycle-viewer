import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SortableTable from './SortableTable.svelte';
import type { SortableTableColumn } from './SortableTable.svelte';

describe('SortableTable', () => {
	// Test data fixtures
	const sampleData = [
		{ id: '1', name: 'Alice', priority: 'P1', count: 10, date: '2024-01-15', status: 'Active' },
		{ id: '2', name: 'Bob', priority: 'P0', count: 5, date: '2024-01-10', status: 'Inactive' },
		{ id: '3', name: 'Charlie', priority: 'P2', count: 15, date: '2024-01-20', status: 'Active' }
	];

	const basicColumns: SortableTableColumn[] = [
		{ key: 'name', label: 'Name', type: 'string', defaultSort: 'asc' },
		{ key: 'priority', label: 'Priority', type: 'enum' },
		{ key: 'count', label: 'Count', type: 'number' },
		{ key: 'date', label: 'Date', type: 'date' },
		{ key: 'status', label: 'Status', type: 'string', sortable: false }
	];

	describe('Core Rendering', () => {
		it('should render table with provided data and columns', () => {
			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: basicColumns }
			});

			// Check table structure exists
			const table = container.querySelector('table');
			expect(table).toBeTruthy();
			
			// Check column headers are rendered
			const headers = container.querySelectorAll('th');
			expect(headers.length).toBe(5); // 5 columns defined
			
			// Check data rows are rendered
			const rows = container.querySelectorAll('tbody tr');
			expect(rows.length).toBe(3); // 3 data items
		});

		it('should handle empty data array', () => {
			const { container } = render(SortableTable, { 
				props: { data: [], columns: basicColumns }
			});

			const table = container.querySelector('table');
			expect(table).toBeTruthy();
			
			// Should still show headers
			const headers = container.querySelectorAll('th');
			expect(headers.length).toBe(5);
			
			// But no data rows
			const rows = container.querySelectorAll('tbody tr');
			expect(rows.length).toBe(0);
		});

		it('should handle empty columns array', () => {
			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: [] }
			});

			const table = container.querySelector('table');
			expect(table).toBeTruthy();
			
			// No columns should be rendered
			const headers = container.querySelectorAll('th');
			expect(headers.length).toBe(0);
		});
	});

	describe('Accessibility Features', () => {
		it('should include proper ARIA attributes', () => {
			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: basicColumns }
			});

			const headers = container.querySelectorAll('th[role="columnheader"]');
			expect(headers.length).toBeGreaterThan(0);

			// Check sortable headers have aria-sort
			const sortableHeaders = container.querySelectorAll('th[aria-sort]');
			expect(sortableHeaders.length).toBe(4); // 4 sortable columns

			// Check non-sortable headers don't have tabindex
			const statusHeader = Array.from(headers).find(h => h.textContent?.includes('Status'));
			if (statusHeader) {
				expect(statusHeader.getAttribute('tabindex')).toBe('-1');
			}
		});

		it('should have proper tabindex for keyboard navigation', () => {
			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: basicColumns }
			});

			// Sortable columns should have tabindex="0"
			const sortableHeaders = container.querySelectorAll('th[tabindex="0"]');
			expect(sortableHeaders.length).toBe(4); // 4 sortable columns

			// Non-sortable columns should have tabindex="-1"
			const nonSortableHeaders = container.querySelectorAll('th[tabindex="-1"]');
			expect(nonSortableHeaders.length).toBe(1); // 1 non-sortable column
		});
	});

	describe('Visual Sort Indicators', () => {
		it('should show sort icons for sortable columns', () => {
			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: basicColumns }
			});

			// Count SVG icons (sort indicators)
			const sortIcons = container.querySelectorAll('th svg');
			expect(sortIcons.length).toBe(4); // 4 sortable columns should have icons
		});

		it('should not show sort icons for non-sortable columns', () => {
			const columns = [
				{ key: 'name', label: 'Name', type: 'string' as const },
				{ key: 'status', label: 'Status', type: 'string' as const, sortable: false }
			];

			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns }
			});

			// Should have only 1 icon (for the sortable column)
			const sortIcons = container.querySelectorAll('th svg');
			expect(sortIcons.length).toBe(1);
		});
	});

	describe('Custom Render Functions', () => {
		it('should use custom render function when provided', () => {
			const columnsWithRender: SortableTableColumn[] = [
				{ 
					key: 'name', 
					label: 'Name', 
					type: 'string',
					render: (value) => `Mr. ${value}`
				},
				{ key: 'count', label: 'Count', type: 'number' }
			];

			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: columnsWithRender }
			});

			// Should use custom render function
			const renderedText = container.textContent;
			expect(renderedText).toContain('Mr. Alice');
			expect(renderedText).toContain('Mr. Bob');
			expect(renderedText).toContain('Mr. Charlie');
		});

		it('should fall back to default rendering when render function not provided', () => {
			const { container } = render(SortableTable, { 
				props: { data: sampleData, columns: basicColumns }
			});

			// Should show raw values
			const renderedText = container.textContent;
			expect(renderedText).toContain('Alice');
			expect(renderedText).toContain('10'); // count value
		});
	});

	describe('Type Safety', () => {
		it('should handle different data types correctly', () => {
			const typedData = [
				{ name: 'Test', count: 42, active: true, date: '2024-01-01' }
			];
			
			const typedColumns: SortableTableColumn[] = [
				{ key: 'name', label: 'Name', type: 'string' },
				{ key: 'count', label: 'Count', type: 'number' },
				{ key: 'date', label: 'Date', type: 'date' }
			];

			expect(() => {
				render(SortableTable, { 
					props: { data: typedData, columns: typedColumns }
				});
			}).not.toThrow();
		});

		it('should handle null and undefined values gracefully', () => {
			const dataWithNulls = [
				{ name: 'Alice', count: 10 },
				{ name: null, count: 5 },
				{ name: undefined, count: null }
			];

			const columns: SortableTableColumn[] = [
				{ key: 'name', label: 'Name', type: 'string' },
				{ key: 'count', label: 'Count', type: 'number' }
			];

			expect(() => {
				render(SortableTable, { 
					props: { data: dataWithNulls, columns }
				});
			}).not.toThrow();
		});
	});

	describe('Edge Cases', () => {
		it('should handle malformed column configurations gracefully', () => {
			const malformedColumns = [
				{ key: '', label: 'Empty Key' },
				{ key: 'nonexistent', label: 'Non-existent Field' },
				{ key: 'name', label: '' } // Empty label
			];

			expect(() => {
				render(SortableTable, { 
					props: { data: sampleData, columns: malformedColumns }
				});
			}).not.toThrow();
		});

		it('should handle nested property access', () => {
			const nestedData = [
				{ id: '1', user: { profile: { name: 'Alice' } }, count: 10 },
				{ id: '2', user: { profile: { name: 'Bob' } }, count: 5 }
			];

			const nestedColumns: SortableTableColumn[] = [
				{ key: 'user.profile.name', label: 'User Name', type: 'string' },
				{ key: 'count', label: 'Count', type: 'number' }
			];

			const { container } = render(SortableTable, { 
				props: { data: nestedData, columns: nestedColumns }
			});

			const renderedText = container.textContent;
			expect(renderedText).toContain('Alice');
			expect(renderedText).toContain('Bob');
		});
	});

	describe('Component Props', () => {
		it('should accept proper column interface', () => {
			const columns: SortableTableColumn[] = [
				{
					key: 'test',
					label: 'Test Column',
					type: 'string',
					sortable: true,
					defaultSort: 'asc',
					render: (value) => String(value)
				}
			];

			expect(() => {
				render(SortableTable, { 
					props: { data: [{ test: 'value' }], columns }
				});
			}).not.toThrow();
		});

		it('should work with minimal column configuration', () => {
			const minimalColumns: SortableTableColumn[] = [
				{ key: 'name', label: 'Name' }
			];

			expect(() => {
				render(SortableTable, { 
					props: { data: sampleData, columns: minimalColumns }
				});
			}).not.toThrow();
		});
	});
});