// Comprehensive Test Data Fixtures
// Provides realistic test data for Requirements, Tasks, and Architecture Decisions

import type {
	Requirement,
	Task,
	ArchitectureDecision,
	ProjectMetrics,
	RequirementStatus,
	TaskStatus,
	ArchitectureStatus,
	Priority,
	RequirementType,
	EffortSize,
	ArchitectureType
} from '../types/lifecycle.js';

// Base timestamp for consistent test data
const BASE_DATE = '2024-01-15T10:00:00.000Z';
const UPDATED_DATE = '2024-01-16T14:30:00.000Z';

// Test data generators
export class TestDataGenerator {
	private static requirementCounter = 1;
	private static taskCounter = 1;
	private static architectureCounter = 1;

	static resetCounters(): void {
		this.requirementCounter = 1;
		this.taskCounter = 1;
		this.architectureCounter = 1;
	}

	static generateRequirementId(type: RequirementType = 'FUNC', version: number = 1): string {
		const num = String(this.requirementCounter++).padStart(4, '0');
		const ver = String(version).padStart(2, '0');
		return `REQ-${num}-${type}-${ver}`;
	}

	static generateTaskId(parentNum?: number, subtask?: number, version: number = 1): string {
		const taskNum = String(parentNum || this.taskCounter++).padStart(4, '0');
		const subtaskNum = String(subtask || 0).padStart(2, '0');
		const ver = String(version).padStart(2, '0');
		return `TASK-${taskNum}-${subtaskNum}-${ver}`;
	}

	static generateArchitectureId(type: ArchitectureType = 'ADR', version?: number): string {
		const num = String(this.architectureCounter++).padStart(4, '0');
		if (version) {
			const ver = String(version).padStart(2, '0');
			return `${type}-${num}-Component-${ver}`;
		}
		return `${type}-${num}`;
	}
}

// Requirement fixtures
export const REQUIREMENT_FIXTURES = {
	// Basic requirement in each lifecycle state
	draft: (): Requirement => ({
		id: TestDataGenerator.generateRequirementId('FUNC'),
		requirement_number: TestDataGenerator.requirementCounter - 1,
		type: 'FUNC',
		version: 1,
		title: 'User Authentication System',
		status: 'Draft',
		priority: 'P1',
		risk_level: 'Medium',
		business_value: 'Enable secure user access and personalization',
		current_state: 'No user authentication exists',
		desired_state: 'Secure authentication with JWT tokens',
		functional_requirements: [
			'User can register with email and password',
			'User can login with valid credentials',
			'System generates secure JWT tokens',
			'Tokens expire after 24 hours'
		],
		acceptance_criteria: [
			'Registration form validates email format',
			'Password must be at least 8 characters',
			'Login returns JWT token on success',
			'Invalid credentials return 401 error'
		],
		author: 'Product Team',
		created_at: BASE_DATE,
		updated_at: BASE_DATE,
		task_count: 0,
		tasks_completed: 0
	}),

	approved: (): Requirement => ({
		...REQUIREMENT_FIXTURES.draft(),
		id: TestDataGenerator.generateRequirementId('FUNC'),
		requirement_number: TestDataGenerator.requirementCounter - 1,
		title: 'Dashboard Analytics',
		status: 'Approved',
		priority: 'P0',
		business_value: 'Provide real-time insights for decision making',
		current_state: 'Static dashboard with basic metrics',
		desired_state: 'Interactive dashboard with real-time analytics',
		updated_at: UPDATED_DATE,
		task_count: 3,
		tasks_completed: 1
	}),

	implemented: (): Requirement => ({
		...REQUIREMENT_FIXTURES.approved(),
		id: TestDataGenerator.generateRequirementId('TECH'),
		requirement_number: TestDataGenerator.requirementCounter - 1,
		type: 'TECH',
		title: 'Database Migration System',
		status: 'Implemented',
		priority: 'P2',
		risk_level: 'Low',
		task_count: 5,
		tasks_completed: 5
	}),

	// Complex requirement with full data
	complex: (): Requirement => ({
		id: TestDataGenerator.generateRequirementId('NFUNC'),
		requirement_number: TestDataGenerator.requirementCounter - 1,
		type: 'NFUNC',
		version: 2,
		title: 'System Performance Requirements',
		status: 'Architecture',
		priority: 'P0',
		risk_level: 'High',
		business_value: 'Ensure system can handle 10,000 concurrent users',
		architecture_review: 'Required',
		current_state: 'System handles 1,000 concurrent users with 2s response time',
		desired_state: 'System handles 10,000+ users with <500ms response time',
		gap_analysis: 'Need to implement caching, database optimization, and load balancing',
		impact_of_not_acting: 'System will crash under expected production load',
		functional_requirements: [
			'API responses must be under 500ms for 95% of requests',
			'System must handle 10,000 concurrent users',
			'Database queries must complete within 100ms',
			'Static assets must load within 200ms'
		],
		nonfunctional_requirements: {
			performance: {
				responseTime: '< 500ms',
				throughput: '10,000 concurrent users',
				availability: '99.9% uptime'
			},
			scalability: {
				horizontal: 'Auto-scaling containers',
				vertical: 'Database read replicas'
			}
		},
		technical_constraints: {
			infrastructure: 'Must use existing AWS infrastructure',
			budget: 'Additional $5,000/month for scaling',
			timeline: 'Must complete before Q2 launch'
		},
		acceptance_criteria: [
			'Load test with 10,000 users shows <500ms response',
			'Database connection pool handles peak load',
			'CDN serves static assets with <200ms latency',
			'Auto-scaling triggers within 1 minute of load spike'
		],
		validation_metrics: [
			'Average API response time',
			'95th percentile response time',
			'Error rate under load',
			'Database query performance'
		],
		author: 'Architecture Team',
		created_at: BASE_DATE,
		updated_at: UPDATED_DATE,
		task_count: 8,
		tasks_completed: 3
	})
};

// Task fixtures
export const TASK_FIXTURES = {
	notStarted: (): Task => ({
		id: TestDataGenerator.generateTaskId(),
		task_number: TestDataGenerator.taskCounter - 1,
		subtask_number: 0,
		version: 1,
		title: 'Implement User Registration API',
		status: 'Not Started',
		priority: 'P1',
		effort: 'M',
		user_story: 'As a new user, I want to register an account so that I can access the system',
		acceptance_criteria: [
			'POST /api/register endpoint accepts email and password',
			'Email validation ensures proper format',
			'Password hashing using bcrypt',
			'Returns success message and user ID',
			'Duplicate email returns 409 conflict'
		],
		assignee: 'Developer A',
		created_at: BASE_DATE,
		updated_at: BASE_DATE
	}),

	inProgress: (): Task => ({
		...TASK_FIXTURES.notStarted(),
		id: TestDataGenerator.generateTaskId(),
		task_number: TestDataGenerator.taskCounter - 1,
		title: 'Create Login Component',
		status: 'In Progress',
		effort: 'S',
		user_story: 'As a user, I want to log in so that I can access my account',
		updated_at: UPDATED_DATE
	}),

	complete: (): Task => ({
		...TASK_FIXTURES.inProgress(),
		id: TestDataGenerator.generateTaskId(),
		task_number: TestDataGenerator.taskCounter - 1,
		title: 'Setup Database Schema',
		status: 'Complete',
		effort: 'L',
		completed_at: UPDATED_DATE
	}),

	blocked: (): Task => ({
		...TASK_FIXTURES.notStarted(),
		id: TestDataGenerator.generateTaskId(),
		task_number: TestDataGenerator.taskCounter - 1,
		title: 'Deploy to Production',
		status: 'Blocked',
		priority: 'P0',
		effort: 'M',
		user_story: 'As a system admin, I want to deploy the application so users can access it'
	}),

	// Subtask example
	subtask: (parentId?: string): Task => ({
		...TASK_FIXTURES.notStarted(),
		id: TestDataGenerator.generateTaskId(1, 1),
		task_number: 1,
		subtask_number: 1,
		title: 'Write Unit Tests for Registration',
		status: 'Not Started',
		effort: 'S',
		parent_task_id: parentId || 'TASK-0001-00-00'
	})
};

// Architecture Decision fixtures
export const ARCHITECTURE_FIXTURES = {
	proposed: (): ArchitectureDecision => ({
		id: TestDataGenerator.generateArchitectureId('ADR'),
		type: 'ADR',
		title: 'Use JWT for Authentication',
		status: 'Proposed',
		context: 'Need to choose authentication mechanism for stateless API',
		decision_drivers: [
			'Stateless authentication requirement',
			'Mobile app compatibility',
			'Microservices architecture',
			'Security best practices'
		],
		considered_options: ['JWT tokens', 'Session cookies', 'OAuth 2.0', 'API keys'],
		decision_outcome: 'Use JWT tokens with 24-hour expiration',
		consequences: {
			good: [
				'Stateless authentication',
				'Works across different domains',
				'Built-in expiration handling',
				'Industry standard'
			],
			bad: [
				'Token size larger than session ID',
				'Cannot revoke tokens before expiration',
				'Need secure token storage on client'
			],
			neutral: ['Requires token refresh mechanism', 'Need to handle token expiration gracefully']
		},
		authors: ['Security Architect', 'Lead Developer'],
		created_at: BASE_DATE,
		updated_at: BASE_DATE
	}),

	accepted: (): ArchitectureDecision => ({
		...ARCHITECTURE_FIXTURES.proposed(),
		id: TestDataGenerator.generateArchitectureId('ADR'),
		title: 'Database Connection Pooling Strategy',
		status: 'Accepted',
		decision_outcome: 'Use connection pooling with max 20 connections per service',
		updated_at: UPDATED_DATE
	}),

	tdd: (): ArchitectureDecision => ({
		id: TestDataGenerator.generateArchitectureId('TDD', 1),
		type: 'TDD',
		title: 'Microservices Communication Architecture',
		status: 'Under Review',
		context: 'Design communication patterns between microservices',
		executive_summary: 'Establish patterns for service-to-service communication',
		system_design: {
			synchronous: 'REST APIs for real-time operations',
			asynchronous: 'Event bus for eventual consistency',
			dataConsistency: 'Event sourcing for critical operations'
		},
		key_decisions: {
			messaging: 'Use Apache Kafka for event streaming',
			apis: 'OpenAPI 3.0 specifications for all endpoints',
			monitoring: 'Distributed tracing with Jaeger'
		},
		performance_considerations: {
			latency: 'Circuit breakers prevent cascade failures',
			throughput: 'Async processing for high-volume operations',
			scalability: 'Auto-scaling based on queue depth'
		},
		risk_assessment: [
			{
				risk: 'Event ordering issues',
				likelihood: 'Medium',
				impact: 'High',
				mitigation: 'Use partition keys for ordering guarantees'
			}
		],
		authors: ['System Architect', 'Platform Team'],
		deciders: ['CTO', 'Engineering Manager'],
		created_at: BASE_DATE,
		updated_at: UPDATED_DATE
	})
};

// Project metrics fixture
export const PROJECT_METRICS_FIXTURE = (): ProjectMetrics => ({
	requirements: {
		total: 12,
		by_status: {
			Draft: 2,
			'Under Review': 1,
			Approved: 4,
			Architecture: 2,
			Ready: 2,
			Implemented: 1,
			Validated: 0,
			Deprecated: 0
		},
		by_priority: {
			P0: 3,
			P1: 5,
			P2: 3,
			P3: 1
		},
		completion_percentage: 8.3 // 1 out of 12
	},
	tasks: {
		total: 32,
		by_status: {
			'Not Started': 18,
			'In Progress': 8,
			Blocked: 2,
			Complete: 4,
			Abandoned: 0
		},
		by_assignee: {
			'Developer A': 8,
			'Developer B': 6,
			'QA Engineer': 4,
			DevOps: 3,
			Unassigned: 11
		},
		completion_percentage: 12.5 // 4 out of 32
	},
	architecture: {
		total: 6,
		by_status: {
			Proposed: 2,
			Accepted: 3,
			Rejected: 0,
			Deprecated: 0,
			Superseded: 0,
			Draft: 1,
			'Under Review': 0,
			Approved: 0,
			Implemented: 0
		},
		by_type: {
			ADR: 5,
			TDD: 1,
			INTG: 0
		}
	}
});

// Utility functions for generating related test data
export const TestDataRelationships = {
	createRequirementWithTasks: (requirement?: Partial<Requirement>, taskCount: number = 3) => {
		const req = { ...REQUIREMENT_FIXTURES.approved(), ...requirement };
		const tasks: Task[] = [];

		for (let i = 0; i < taskCount; i++) {
			const task = {
				...TASK_FIXTURES.notStarted(),
				id: TestDataGenerator.generateTaskId(),
				task_number: TestDataGenerator.taskCounter - 1,
				title: `Task ${i + 1} for ${req.title}`,
				status: i === 0 ? 'Complete' : 'Not Started'
			} as Task;
			tasks.push(task);
		}

		req.task_count = taskCount;
		req.tasks_completed = tasks.filter((t) => t.status === 'Complete').length;

		return { requirement: req, tasks };
	},

	createTaskHierarchy: (parentTask?: Partial<Task>, subtaskCount: number = 3) => {
		const parent = { ...TASK_FIXTURES.inProgress(), ...parentTask };
		const subtasks: Task[] = [];

		for (let i = 0; i < subtaskCount; i++) {
			const subtask = {
				...TASK_FIXTURES.subtask(),
				id: TestDataGenerator.generateTaskId(parent.task_number, i + 1),
				task_number: parent.task_number,
				subtask_number: i + 1,
				title: `Subtask ${i + 1}: ${parent.title}`,
				parent_task_id: parent.id
			};
			subtasks.push(subtask);
		}

		return { parent, subtasks };
	}
};

// Collection generators for bulk test data
export const BulkTestData = {
	generateRequirements: (count: number): Requirement[] => {
		const requirements: Requirement[] = [];
		const statuses: RequirementStatus[] = [
			'Draft',
			'Under Review',
			'Approved',
			'Architecture',
			'Ready',
			'Implemented'
		];
		const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
		const types: RequirementType[] = ['FUNC', 'NFUNC', 'TECH', 'BUS', 'INTF'];

		for (let i = 0; i < count; i++) {
			const req = {
				...REQUIREMENT_FIXTURES.draft(),
				id: TestDataGenerator.generateRequirementId(types[i % types.length]),
				requirement_number: TestDataGenerator.requirementCounter - 1,
				title: `Generated Requirement ${i + 1}`,
				status: statuses[i % statuses.length],
				priority: priorities[i % priorities.length],
				type: types[i % types.length]
			};
			requirements.push(req);
		}

		return requirements;
	},

	generateTasks: (count: number): Task[] => {
		const tasks: Task[] = [];
		const statuses: TaskStatus[] = [
			'Not Started',
			'In Progress',
			'Blocked',
			'Complete',
			'Abandoned'
		];
		const efforts: EffortSize[] = ['XS', 'S', 'M', 'L', 'XL'];
		const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];

		for (let i = 0; i < count; i++) {
			const task = {
				...TASK_FIXTURES.notStarted(),
				id: TestDataGenerator.generateTaskId(),
				task_number: TestDataGenerator.taskCounter - 1,
				title: `Generated Task ${i + 1}`,
				status: statuses[i % statuses.length],
				effort: efforts[i % efforts.length],
				priority: priorities[i % priorities.length]
			};
			tasks.push(task);
		}

		return tasks;
	}
};
