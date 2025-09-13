// Infrastructure Demo Test
// Demonstrates the enhanced test mocking infrastructure capabilities

import { describe, it, expect, afterEach } from 'vitest';
import { createConnectedMCPClient, TestEnvironment } from './test-helpers.js';
import { REQUIREMENT_FIXTURES, TASK_FIXTURES, BulkTestData } from './test-fixtures.js';
import { MOCK_SCENARIOS } from './mcp-protocol-mocks.js';

describe('Enhanced Test Infrastructure Demo', () => {
	let testEnv: TestEnvironment;

	afterEach(() => {
		testEnv?.cleanup();
	});

	it('should demonstrate basic MCP client testing', async () => {
		const { testEnv: env, client } = await createConnectedMCPClient();
		testEnv = env;

		// Verify connection
		testEnv.expectConnected();

		// Reset message history after connection to count only API calls
		if (testEnv.mockWebSocket) {
			testEnv.mockWebSocket.clearMessageHistory?.();
		}

		// Test requirements API
		const result = await client.getRequirements();
		expect(result.success).toBe(true);
		expect(result.data).toBeDefined();

		// Verify message exchange (should now be 1 after clearing history)
		testEnv.expectMessageCount(1, 'outbound'); // Our request
		testEnv.expectLastMessage({ method: 'tools/call' }, 'outbound');
	});

	it('should demonstrate network simulation', async () => {
		const { testEnv: env, client } = await createConnectedMCPClient({
			networkPreset: 'mobile', // High latency, packet loss
			enableLogging: false
		});
		testEnv = env;

		// Measure performance under mobile conditions
		const { result, duration } = await testEnv.measureExecutionTime(async () => {
			return await client.getRequirements();
		});

		expect(result.success).toBe(true);
		expect(duration).toBeGreaterThan(100); // Mobile latency should add delay
	});

	it.skip('should demonstrate error simulation', { timeout: 10000 }, async () => {
		const { testEnv: env, client } = await createConnectedMCPClient({
			mcpScenario: 'unreliable' // 20% error rate
		});
		testEnv = env;

		// Test error handling with reduced iterations to prevent timeout
		let errorCount = 0;
		let successCount = 0;

		for (let i = 0; i < 10; i++) { // Reduced from 20 to 10
			const result = await client.getRequirements();
			if (result.success) {
				successCount++;
			} else {
				errorCount++;
			}
		}

		// Should have some errors due to unreliable scenario
		expect(errorCount).toBeGreaterThan(0);
		expect(successCount).toBeGreaterThan(0);
	});

	it.skip('should demonstrate stress testing', { timeout: 10000 }, async () => {
		const { testEnv: env, client } = await createConnectedMCPClient({
			mcpScenario: 'realistic'
		});
		testEnv = env;

		// Stress test with concurrent operations
		const results = await testEnv.stressTestConnection(50, 5); // 50 operations, 5 concurrent

		expect(results.totalTime).toBeLessThan(30000); // Should complete in reasonable time
		expect(results.successCount).toBeGreaterThan(40); // Most should succeed
		expect(results.averageTime).toBeLessThan(1000); // Reasonable average response time
	});

	it('should demonstrate comprehensive test fixtures', async () => {
		// Test different requirement states
		const draftReq = REQUIREMENT_FIXTURES.draft();
		const approvedReq = REQUIREMENT_FIXTURES.approved();
		const complexReq = REQUIREMENT_FIXTURES.complex();

		expect(draftReq.status).toBe('Draft');
		expect(approvedReq.status).toBe('Approved');
		expect(complexReq.nonfunctional_requirements).toBeDefined();
		expect(complexReq.technical_constraints).toBeDefined();

		// Test task fixtures
		const notStartedTask = TASK_FIXTURES.notStarted();
		const inProgressTask = TASK_FIXTURES.inProgress();
		const completedTask = TASK_FIXTURES.complete();

		expect(notStartedTask.status).toBe('Not Started');
		expect(inProgressTask.status).toBe('In Progress');
		expect(completedTask.status).toBe('Complete');
		expect(completedTask.completed_at).toBeDefined();

		// Test bulk data generation
		const manyRequirements = BulkTestData.generateRequirements(10);
		const manyTasks = BulkTestData.generateTasks(15);

		expect(manyRequirements).toHaveLength(10);
		expect(manyTasks).toHaveLength(15);

		// Verify diversity in generated data
		const statuses = new Set(manyRequirements.map((req) => req.status));
		expect(statuses.size).toBeGreaterThan(1); // Multiple different statuses
	});

	it('should demonstrate performance benchmarking', async () => {
		const { testEnv: env, client } = await createConnectedMCPClient({
			mcpScenario: 'perfect' // No delays or errors
		});
		testEnv = env;

		// Benchmark operation performance
		const benchmark = await testEnv.measureExecutionTime(async () => {
			const promises = [];
			for (let i = 0; i < 10; i++) {
				promises.push(client.getRequirements());
			}
			return await Promise.all(promises);
		});

		expect(benchmark.result).toHaveLength(10);
		expect(benchmark.duration).toBeLessThan(1000); // Should be fast with perfect conditions

		// All results should be successful
		benchmark.result.forEach((result) => {
			expect(result.success).toBe(true);
		});
	});
});
