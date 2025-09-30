/**
 * Feature Flag System for Svelte-Flow Migration
 * Enables gradual rollout and quick rollback capabilities
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface FeatureFlags {
	// Visualization system flags
	useSvelteFlow: boolean;
	svelteFlowNetworkLayout: boolean;
	svelteFlowHierarchyLayout: boolean;
	svelteFlowTimelineLayout: boolean;
	svelteFlowRoadmapLayout: boolean;

	// UX enhancement flags
	dragToConnectRelationships: boolean;

	// Performance flags
	enableVisualizationPerformanceMonitoring: boolean;
}

// Default feature flag values
const defaultFlags: FeatureFlags = {
	useSvelteFlow: false,
	svelteFlowNetworkLayout: false,
	svelteFlowHierarchyLayout: false,
	svelteFlowTimelineLayout: false,
	svelteFlowRoadmapLayout: false,
	dragToConnectRelationships: false,
	enableVisualizationPerformanceMonitoring: false
};

// Load flags from localStorage or environment
function loadFeatureFlags(): FeatureFlags {
	if (!browser) {
		return defaultFlags;
	}

	try {
		// Check localStorage first
		const stored = localStorage.getItem('lifecycle-feature-flags');
		if (stored) {
			const parsed = JSON.parse(stored);
			return { ...defaultFlags, ...parsed };
		}

		// Check environment variables (for server-side or build-time flags)
		const envFlags: Partial<FeatureFlags> = {};

		if (typeof process !== 'undefined' && process.env) {
			envFlags.useSvelteFlow = process.env.VITE_USE_SVELTE_FLOW === 'true';
			envFlags.svelteFlowNetworkLayout = process.env.VITE_SVELTE_FLOW_NETWORK === 'true';
			envFlags.svelteFlowHierarchyLayout = process.env.VITE_SVELTE_FLOW_HIERARCHY === 'true';
			envFlags.svelteFlowTimelineLayout = process.env.VITE_SVELTE_FLOW_TIMELINE === 'true';
			envFlags.svelteFlowRoadmapLayout = process.env.VITE_SVELTE_FLOW_ROADMAP === 'true';
			envFlags.dragToConnectRelationships = process.env.VITE_DRAG_TO_CONNECT === 'true';
			envFlags.enableVisualizationPerformanceMonitoring =
				process.env.VITE_PERF_MONITORING === 'true';
		}

		return { ...defaultFlags, ...envFlags };
	} catch (error) {
		console.warn('Error loading feature flags, using defaults:', error);
		return defaultFlags;
	}
}

// Create the store
export const featureFlags = writable<FeatureFlags>(loadFeatureFlags());

// Save flags to localStorage when they change
featureFlags.subscribe((flags) => {
	if (browser) {
		try {
			localStorage.setItem('lifecycle-feature-flags', JSON.stringify(flags));
		} catch (error) {
			console.warn('Error saving feature flags:', error);
		}
	}
});

// Derived stores for specific features
export const useSvelteFlow = derived(featureFlags, ($flags) => $flags.useSvelteFlow);
export const dragToConnect = derived(featureFlags, ($flags) => $flags.dragToConnectRelationships);

// Helper functions for flag management
export function enableFeature(feature: keyof FeatureFlags) {
	featureFlags.update((flags) => ({
		...flags,
		[feature]: true
	}));
}

export function disableFeature(feature: keyof FeatureFlags) {
	featureFlags.update((flags) => ({
		...flags,
		[feature]: false
	}));
}

export function toggleFeature(feature: keyof FeatureFlags) {
	featureFlags.update((flags) => ({
		...flags,
		[feature]: !flags[feature]
	}));
}

export function resetAllFlags() {
	featureFlags.set(defaultFlags);
}

// A/B testing support
export function enableForUserGroup(
	userId: string,
	feature: keyof FeatureFlags,
	percentage: number = 50
) {
	// Simple hash-based A/B testing
	const hash = simpleHash(userId + feature);
	const shouldEnable = hash % 100 < percentage;

	featureFlags.update((flags) => ({
		...flags,
		[feature]: shouldEnable
	}));

	return shouldEnable;
}

function simpleHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

// Performance monitoring integration
export function logFeatureFlagUsage(feature: keyof FeatureFlags, context?: string) {
	if (browser && console.debug) {
		console.debug(`Feature flag used: ${feature}`, { context, timestamp: Date.now() });
	}
}

// Emergency rollback function
export function emergencyRollback() {
	console.warn('🚨 Emergency rollback: Disabling all Svelte-Flow features');

	featureFlags.update((flags) => ({
		...flags,
		useSvelteFlow: false,
		svelteFlowNetworkLayout: false,
		svelteFlowHierarchyLayout: false,
		svelteFlowTimelineLayout: false,
		svelteFlowRoadmapLayout: false,
		dragToConnectRelationships: false
	}));

	// Force page reload to ensure clean state
	if (browser) {
		setTimeout(() => window.location.reload(), 100);
	}
}
