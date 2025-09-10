import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { modalStore } from './modal.js';

describe('Modal Store', () => {
	beforeEach(() => {
		// Reset store before each test
		modalStore.reset();
	});

	describe('Initial State', () => {
		it('should have correct initial state', () => {
			const state = get(modalStore);

			expect(state.isOpen).toBe(false);
			expect(state.title).toBe('');
			expect(state.size).toBe('md');
			expect(state.closeOnBackdrop).toBe(true);
			expect(state.closeOnEscape).toBe(true);
			expect(state.showCloseButton).toBe(true);
			expect(state.data).toBe(null);
		});
	});

	describe('Open Modal', () => {
		it('should open modal with default configuration', () => {
			modalStore.open({ title: 'Test Modal' });

			const state = get(modalStore);
			expect(state.isOpen).toBe(true);
			expect(state.title).toBe('Test Modal');
			expect(state.size).toBe('md'); // default
			expect(state.closeOnBackdrop).toBe(true); // default
			expect(state.closeOnEscape).toBe(true); // default
		});

		it('should open modal with custom configuration', () => {
			const config = {
				title: 'Custom Modal',
				size: 'lg' as const,
				closeOnBackdrop: false,
				closeOnEscape: false,
				data: { userId: 123, action: 'edit' }
			};

			modalStore.open(config);

			const state = get(modalStore);
			expect(state.isOpen).toBe(true);
			expect(state.title).toBe('Custom Modal');
			expect(state.size).toBe('lg');
			expect(state.closeOnBackdrop).toBe(false);
			expect(state.closeOnEscape).toBe(false);
			expect(state.data).toEqual({ userId: 123, action: 'edit' });
		});

		it('should merge partial configuration with defaults', () => {
			modalStore.open({
				title: 'Partial Config',
				size: 'xl'
				// Other props should use defaults
			});

			const state = get(modalStore);
			expect(state.isOpen).toBe(true);
			expect(state.title).toBe('Partial Config');
			expect(state.size).toBe('xl');
			expect(state.closeOnBackdrop).toBe(true); // default maintained
			expect(state.closeOnEscape).toBe(true); // default maintained
		});
	});

	describe('Close Modal', () => {
		it('should close modal but keep other state', () => {
			// First open a modal with custom config
			modalStore.open({
				title: 'Test Modal',
				size: 'lg',
				closeOnBackdrop: false,
				data: { test: true }
			});

			// Verify it's open
			expect(get(modalStore).isOpen).toBe(true);

			// Close it
			modalStore.close();

			// Verify only isOpen changed
			const state = get(modalStore);
			expect(state.isOpen).toBe(false);
			expect(state.title).toBe('Test Modal'); // Preserved
			expect(state.size).toBe('lg'); // Preserved
			expect(state.closeOnBackdrop).toBe(false); // Preserved
			expect(state.data).toEqual({ test: true }); // Preserved
		});

		it('should reset to initial state with reset method', () => {
			// First open a modal with custom config
			modalStore.open({
				title: 'Test Modal',
				size: 'lg',
				closeOnBackdrop: false,
				data: { test: true }
			});

			// Reset to initial state
			modalStore.reset();

			// Verify it returns to initial state
			const state = get(modalStore);
			expect(state.isOpen).toBe(false);
			expect(state.title).toBe('');
			expect(state.size).toBe('md');
			expect(state.closeOnBackdrop).toBe(true);
			expect(state.closeOnEscape).toBe(true);
			expect(state.data).toBe(null);
		});
	});

	describe('Update Configuration', () => {
		it('should update modal configuration while keeping it open', () => {
			// Open modal with initial config
			modalStore.open({
				title: 'Initial Title',
				size: 'md',
				data: { initial: true }
			});

			// Update with new config
			modalStore.updateConfig({
				title: 'Updated Title',
				size: 'lg',
				data: { updated: true }
			});

			const state = get(modalStore);
			expect(state.isOpen).toBe(true); // Should remain open
			expect(state.title).toBe('Updated Title');
			expect(state.size).toBe('lg');
			expect(state.data).toEqual({ updated: true });
		});

		it('should partially update modal configuration', () => {
			modalStore.open({
				title: 'Original',
				size: 'md',
				closeOnBackdrop: false,
				data: { test: 1 }
			});

			// Update only title
			modalStore.updateConfig({ title: 'New Title' });

			const state = get(modalStore);
			expect(state.isOpen).toBe(true);
			expect(state.title).toBe('New Title');
			expect(state.size).toBe('md'); // Unchanged
			expect(state.closeOnBackdrop).toBe(false); // Unchanged
			expect(state.data).toEqual({ test: 1 }); // Unchanged
		});

		it('should set data independently', () => {
			modalStore.open({ title: 'Test' });

			modalStore.setData({ newData: 'test' });

			const state = get(modalStore);
			expect(state.isOpen).toBe(true);
			expect(state.title).toBe('Test');
			expect(state.data).toEqual({ newData: 'test' });
		});
	});

	describe('Store Reactivity', () => {
		it('should notify subscribers when state changes', () => {
			const states: any[] = [];

			const unsubscribe = modalStore.subscribe((state) => {
				states.push({ ...state });
			});

			modalStore.open({ title: 'Test' });
			modalStore.updateConfig({ title: 'Updated' });
			modalStore.close();
			modalStore.reset();

			expect(states).toHaveLength(5); // Initial + 4 updates
			expect(states[0].isOpen).toBe(false); // Initial
			expect(states[1].isOpen).toBe(true); // After open
			expect(states[1].title).toBe('Test');
			expect(states[2].title).toBe('Updated'); // After update
			expect(states[3].isOpen).toBe(false); // After close
			expect(states[4].title).toBe(''); // After reset

			unsubscribe();
		});
	});

	describe('Edge Cases', () => {
		it('should handle opening modal when already open', () => {
			modalStore.open({ title: 'First Modal' });
			expect(get(modalStore).title).toBe('First Modal');

			// Open another modal (should replace the first)
			modalStore.open({ title: 'Second Modal' });
			expect(get(modalStore).title).toBe('Second Modal');
			expect(get(modalStore).isOpen).toBe(true);
		});

		it('should handle closing modal when already closed', () => {
			// Should not throw error
			expect(() => modalStore.close()).not.toThrow();
			expect(get(modalStore).isOpen).toBe(false);
		});

		it('should handle updating modal when closed', () => {
			// Should not throw error
			modalStore.updateConfig({ title: 'Update Test' });

			const state = get(modalStore);
			expect(state.isOpen).toBe(false); // Should remain closed
			expect(state.title).toBe('Update Test'); // But config updated
		});

		it('should handle empty configuration objects', () => {
			expect(() => modalStore.open({})).not.toThrow();
			expect(() => modalStore.updateConfig({})).not.toThrow();

			// Empty open should still open modal
			modalStore.reset();
			modalStore.open({});
			expect(get(modalStore).isOpen).toBe(true);
		});
	});
});
