// Claude API Usage Tracker
// Tracks token usage, costs, and provides usage analytics

import { writable } from 'svelte/store';

export interface UsageMetrics {
	sessionTokens: {
		input: number;
		output: number;
		total: number;
	};
	totalTokens: {
		input: number;
		output: number;
		total: number;
	};
	estimatedCost: {
		session: number;
		total: number;
	};
	messageCount: {
		session: number;
		total: number;
	};
	lastUpdated: string;
}

export interface TokenUsage {
	input: number;
	output: number;
	model: string;
	timestamp: string;
}

class UsageTracker {
	private usage = writable<UsageMetrics>({
		sessionTokens: { input: 0, output: 0, total: 0 },
		totalTokens: { input: 0, output: 0, total: 0 },
		estimatedCost: { session: 0, total: 0 },
		messageCount: { session: 0, total: 0 },
		lastUpdated: new Date().toISOString()
	});

	// Token costs per 1000 tokens (approximate, as of 2024)
	private readonly TOKEN_COSTS = {
		'claude-sonnet-4-0': { input: 0.003, output: 0.015 },
		'claude-3-7-sonnet-latest': { input: 0.003, output: 0.015 },
		'claude-3-5-haiku-latest': { input: 0.00025, output: 0.00125 },
		'claude-opus-4-1': { input: 0.015, output: 0.075 }
	} as const;

	constructor() {
		// Load saved usage from localStorage
		this.loadFromStorage();
	}

	/**
	 * Track token usage from a Claude API response
	 */
	trackUsage(tokenUsage: TokenUsage): void {
		this.usage.update((current) => {
			const newSessionInput = current.sessionTokens.input + tokenUsage.input;
			const newSessionOutput = current.sessionTokens.output + tokenUsage.output;
			const newTotalInput = current.totalTokens.input + tokenUsage.input;
			const newTotalOutput = current.totalTokens.output + tokenUsage.output;

			const sessionCost = this.calculateCost(newSessionInput, newSessionOutput, tokenUsage.model);
			const totalCost = this.calculateCost(newTotalInput, newTotalOutput, tokenUsage.model);

			const updated = {
				sessionTokens: {
					input: newSessionInput,
					output: newSessionOutput,
					total: newSessionInput + newSessionOutput
				},
				totalTokens: {
					input: newTotalInput,
					output: newTotalOutput,
					total: newTotalInput + newTotalOutput
				},
				estimatedCost: {
					session: sessionCost,
					total: totalCost
				},
				messageCount: {
					session: current.messageCount.session + 1,
					total: current.messageCount.total + 1
				},
				lastUpdated: new Date().toISOString()
			};

			// Save to localStorage
			this.saveToStorage(updated);
			return updated;
		});
	}

	/**
	 * Reset session metrics (keep total metrics)
	 */
	resetSession(): void {
		this.usage.update((current) => ({
			...current,
			sessionTokens: { input: 0, output: 0, total: 0 },
			estimatedCost: { ...current.estimatedCost, session: 0 },
			messageCount: { ...current.messageCount, session: 0 },
			lastUpdated: new Date().toISOString()
		}));
	}

	/**
	 * Get reactive usage store
	 */
	getUsageStore() {
		return this.usage;
	}

	/**
	 * Get current usage snapshot
	 */
	getCurrentUsage(): UsageMetrics {
		let current: UsageMetrics;
		this.usage.subscribe((usage) => (current = usage))();
		return current!;
	}

	/**
	 * Calculate estimated cost for token usage
	 */
	private calculateCost(inputTokens: number, outputTokens: number, model: string): number {
		const costs =
			this.TOKEN_COSTS[model as keyof typeof this.TOKEN_COSTS] ||
			this.TOKEN_COSTS['claude-3-7-sonnet-latest'];

		const inputCost = (inputTokens / 1000) * costs.input;
		const outputCost = (outputTokens / 1000) * costs.output;

		return inputCost + outputCost;
	}

	/**
	 * Save usage metrics to localStorage
	 */
	private saveToStorage(metrics: UsageMetrics): void {
		try {
			localStorage.setItem('claude-usage-metrics', JSON.stringify(metrics));
		} catch (error) {
			console.warn('Failed to save usage metrics:', error);
		}
	}

	/**
	 * Load usage metrics from localStorage
	 */
	private loadFromStorage(): void {
		try {
			const saved = localStorage.getItem('claude-usage-metrics');
			if (saved) {
				const metrics = JSON.parse(saved);
				this.usage.set({
					...metrics,
					sessionTokens: { input: 0, output: 0, total: 0 }, // Reset session on load
					estimatedCost: { ...metrics.estimatedCost, session: 0 },
					messageCount: { ...metrics.messageCount, session: 0 }
				});
			}
		} catch (error) {
			console.warn('Failed to load usage metrics:', error);
		}
	}
}

// Export singleton instance
export const usageTracker = new UsageTracker();
