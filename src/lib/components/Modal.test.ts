import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { modalStore } from '$lib/stores/modal.js';

// Mock the theme provider
vi.mock('$lib/theme', () => ({
	currentTheme: {
		subscribe: vi.fn((fn) => {
			fn({
				base: {
					background: '#ffffff',
					foreground: '#000000',
					muted: '#6b7280'
				}
			});
			return { unsubscribe: vi.fn() };
		})
	}
}));

describe('Modal Component Integration', () => {
	beforeEach(() => {
		// Reset modal store before each test
		modalStore.reset();
		vi.clearAllMocks();
	});

	describe('Modal Store Integration', () => {
		it('should have proper initial state', () => {
			const state = modalStore;
			expect(state).toBeDefined();
			expect(typeof state.subscribe).toBe('function');
			expect(typeof state.open).toBe('function');
			expect(typeof state.close).toBe('function');
			expect(typeof state.reset).toBe('function');
		});

		it('should open modal via store', () => {
			modalStore.open({ title: 'Store Modal', data: { test: true } });

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.isOpen).toBe(true);
			expect(currentState.title).toBe('Store Modal');
			expect(currentState.data).toEqual({ test: true });

			unsubscribe();
		});

		it('should close modal via store', () => {
			modalStore.open({ title: 'Test' });
			modalStore.close();

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.isOpen).toBe(false);

			unsubscribe();
		});

		it('should update modal configuration', () => {
			modalStore.open({ title: 'Original', size: 'md' });
			modalStore.updateConfig({ title: 'Updated', size: 'lg' });

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.isOpen).toBe(true);
			expect(currentState.title).toBe('Updated');
			expect(currentState.size).toBe('lg');

			unsubscribe();
		});

		it('should handle data updates', () => {
			modalStore.open({ title: 'Test' });
			modalStore.setData({ userId: 123, action: 'edit' });

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.data).toEqual({ userId: 123, action: 'edit' });

			unsubscribe();
		});
	});

	describe('Modal Size Configurations', () => {
		const sizeConfigs = ['sm', 'md', 'lg', 'xl', 'full'] as const;

		sizeConfigs.forEach((size) => {
			it(`should accept ${size} size configuration`, () => {
				modalStore.open({ title: 'Test', size });

				let currentState: any;
				const unsubscribe = modalStore.subscribe((state) => {
					currentState = state;
				});

				expect(currentState.size).toBe(size);

				unsubscribe();
			});
		});
	});

	describe('Modal State Management', () => {
		it('should maintain state consistency across operations', () => {
			const states: any[] = [];

			const unsubscribe = modalStore.subscribe((state) => {
				states.push({ ...state });
			});

			// Initial state
			expect(states[0].isOpen).toBe(false);

			// Open modal
			modalStore.open({ title: 'Test Modal', size: 'lg' });
			expect(states[1].isOpen).toBe(true);
			expect(states[1].title).toBe('Test Modal');
			expect(states[1].size).toBe('lg');

			// Update config
			modalStore.updateConfig({ title: 'Updated Modal' });
			expect(states[2].isOpen).toBe(true);
			expect(states[2].title).toBe('Updated Modal');
			expect(states[2].size).toBe('lg'); // Should be preserved

			// Close modal
			modalStore.close();
			expect(states[3].isOpen).toBe(false);
			expect(states[3].title).toBe('Updated Modal'); // Title preserved

			// Reset modal
			modalStore.reset();
			expect(states[4].isOpen).toBe(false);
			expect(states[4].title).toBe(''); // Reset to default
			expect(states[4].size).toBe('md'); // Reset to default

			unsubscribe();
		});

		it('should handle concurrent operations safely', () => {
			modalStore.open({ title: 'First' });
			modalStore.open({ title: 'Second' }); // Should replace first

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.isOpen).toBe(true);
			expect(currentState.title).toBe('Second');

			unsubscribe();
		});
	});

	describe('Configuration Validation', () => {
		it('should handle empty configuration gracefully', () => {
			expect(() => modalStore.open({})).not.toThrow();

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.isOpen).toBe(true);
			expect(currentState.title).toBe(''); // Empty title
			expect(currentState.size).toBe('md'); // Default size

			unsubscribe();
		});

		it('should preserve default values for unspecified props', () => {
			modalStore.open({ title: 'Minimal Config' });

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.isOpen).toBe(true);
			expect(currentState.title).toBe('Minimal Config');
			expect(currentState.size).toBe('md'); // Default
			expect(currentState.closeOnBackdrop).toBe(true); // Default
			expect(currentState.closeOnEscape).toBe(true); // Default
			expect(currentState.showCloseButton).toBe(true); // Default

			unsubscribe();
		});

		it('should handle partial updates without affecting unspecified props', () => {
			modalStore.open({
				title: 'Original',
				size: 'lg',
				closeOnBackdrop: false,
				data: { original: true }
			});

			modalStore.updateConfig({ title: 'Updated' });

			let currentState: any;
			const unsubscribe = modalStore.subscribe((state) => {
				currentState = state;
			});

			expect(currentState.title).toBe('Updated');
			expect(currentState.size).toBe('lg'); // Preserved
			expect(currentState.closeOnBackdrop).toBe(false); // Preserved
			expect(currentState.data).toEqual({ original: true }); // Preserved

			unsubscribe();
		});
	});

	describe('Error Handling', () => {
		it('should handle operations on closed modal gracefully', () => {
			// These should not throw errors
			expect(() => modalStore.close()).not.toThrow();
			expect(() => modalStore.updateConfig({ title: 'Test' })).not.toThrow();
			expect(() => modalStore.setData({ test: true })).not.toThrow();
		});

		it('should handle invalid size values gracefully', () => {
			// TypeScript should prevent this, but test runtime behavior
			expect(() => modalStore.open({ size: 'invalid' as any })).not.toThrow();
		});
	});
});
