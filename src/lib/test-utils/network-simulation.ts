// Network Simulation Utilities for Realistic Testing
// Provides network condition simulation for WebSocket testing

export interface NetworkConditions {
	latency: {
		min: number;
		max: number;
	};
	packetLoss: number; // 0-1 (percentage)
	disconnectionRate: number; // 0-1 (probability per minute)
	bandwidth: number; // bytes per second (0 = unlimited)
}

export const NETWORK_PRESETS = {
	perfect: {
		latency: { min: 0, max: 5 },
		packetLoss: 0,
		disconnectionRate: 0,
		bandwidth: 0
	},
	highSpeed: {
		latency: { min: 10, max: 50 },
		packetLoss: 0.001,
		disconnectionRate: 0,
		bandwidth: 1024 * 1024 * 10 // 10 MB/s
	},
	typical: {
		latency: { min: 50, max: 150 },
		packetLoss: 0.01,
		disconnectionRate: 0.001,
		bandwidth: 1024 * 1024 // 1 MB/s
	},
	mobile: {
		latency: { min: 100, max: 500 },
		packetLoss: 0.05,
		disconnectionRate: 0.01,
		bandwidth: 1024 * 256 // 256 KB/s
	},
	poor: {
		latency: { min: 300, max: 2000 },
		packetLoss: 0.15,
		disconnectionRate: 0.05,
		bandwidth: 1024 * 56 // 56 KB/s
	},
	offline: {
		latency: { min: 0, max: 0 },
		packetLoss: 1,
		disconnectionRate: 1,
		bandwidth: 0
	}
} as const;

export type NetworkPreset = keyof typeof NETWORK_PRESETS;

export class NetworkSimulator {
	private conditions: NetworkConditions;
	private disconnectionTimer: NodeJS.Timeout | null = null;

	constructor(preset: NetworkPreset = 'typical') {
		this.conditions = { ...NETWORK_PRESETS[preset] };
	}

	setConditions(conditions: Partial<NetworkConditions>): void {
		this.conditions = { ...this.conditions, ...conditions };
	}

	setPreset(preset: NetworkPreset): void {
		this.conditions = { ...NETWORK_PRESETS[preset] };
	}

	// Simulate network latency
	async simulateLatency(): Promise<void> {
		const { min, max } = this.conditions.latency;
		const delay = Math.random() * (max - min) + min;
		if (delay > 0) {
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	// Check if packet should be lost
	shouldDropPacket(): boolean {
		return Math.random() < this.conditions.packetLoss;
	}

	// Check if connection should be dropped
	shouldDisconnect(): boolean {
		return Math.random() < this.conditions.disconnectionRate / 60; // Convert per-minute to per-call
	}

	// Simulate bandwidth limitations
	calculateTransmissionTime(dataSize: number): number {
		if (this.conditions.bandwidth === 0) return 0;
		return (dataSize / this.conditions.bandwidth) * 1000; // ms
	}

	// Start periodic disconnection simulation
	startDisconnectionSimulation(callback: () => void): void {
		this.stopDisconnectionSimulation();
		
		const checkInterval = 1000; // Check every second
		this.disconnectionTimer = setInterval(() => {
			if (this.shouldDisconnect()) {
				callback();
			}
		}, checkInterval);
	}

	stopDisconnectionSimulation(): void {
		if (this.disconnectionTimer) {
			clearInterval(this.disconnectionTimer);
			this.disconnectionTimer = null;
		}
	}

	// Get current network conditions summary
	getConditionsSummary(): string {
		const preset = Object.entries(NETWORK_PRESETS).find(
			([_, conditions]) => JSON.stringify(conditions) === JSON.stringify(this.conditions)
		);

		if (preset) {
			return `Network: ${preset[0]}`;
		}

		return `Network: Custom (${this.conditions.latency.min}-${this.conditions.latency.max}ms, ${(this.conditions.packetLoss * 100).toFixed(1)}% loss)`;
	}

	cleanup(): void {
		this.stopDisconnectionSimulation();
	}
}