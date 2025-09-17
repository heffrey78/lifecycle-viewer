import { mcpClient } from '$lib/services/mcp-client.js';

/**
 * Cross-entity validation rules for maintaining data integrity
 * across Requirements, Tasks, and Architecture Decisions
 */
export const crossEntityRules = {
	/**
	 * Validate that requirements exist and are in proper state for task creation
	 */
	validateRequirementForTask: async (requirementIds: string[], context?: any): Promise<string | null> => {
		try {
			const validStates = ['Approved', 'Architecture', 'Ready', 'Implemented', 'Validated'];
			const invalidRequirements = [];
			const notFoundRequirements = [];

		// If we have requirements in context, use those instead of making API calls
		if (context?.availableRequirements && Array.isArray(context.availableRequirements)) {
			for (const id of requirementIds) {
				const requirement = context.availableRequirements.find((req: any) => req.id === id);
				if (!requirement) {
					notFoundRequirements.push(id);
					continue;
				}

				if (!validStates.includes(requirement.status)) {
					invalidRequirements.push(`${requirement.title} (${requirement.status})`);
				}
			}
		} else {
			// Fallback to API calls if no context data available
			if (!mcpClient.isConnected()) {
				console.warn('MCP client not connected, skipping requirement validation');
				return null;
			}

			for (const id of requirementIds) {
				const result = await mcpClient.getRequirementDetails(id);
				if (!result.success || !result.data) {
					notFoundRequirements.push(id);
					continue;
				}

				const requirement = result.data;
				if (!validStates.includes(requirement.status)) {
					invalidRequirements.push(`${requirement.title} (${requirement.status})`);
				}
			}
		}

		// Return specific error messages
		if (notFoundRequirements.length > 0) {
			return `Requirements not found: ${notFoundRequirements.join(', ')}`;
		}

		if (invalidRequirements.length > 0) {
			return `Cannot create tasks for requirements in invalid states: ${invalidRequirements.join(', ')}. Requirements must be Approved or later.`;
		}

		return null;
		} catch (error) {
			console.warn('Requirement validation failed:', error);
			return null; // Graceful degradation
		}
	},

	/**
	 * Validate that architecture decisions link to valid requirements
	 */
	validateArchitectureRequirements: async (requirementIds: string[]): Promise<string | null> => {
		if (!mcpClient.isConnected()) {
			console.warn('MCP client not connected, skipping architecture requirement validation');
			return null;
		}

		try {
			const invalidRequirements = [];
			const notFoundRequirements = [];

			for (const id of requirementIds) {
				const result = await mcpClient.getRequirementDetails(id);
				if (!result.success || !result.data) {
					notFoundRequirements.push(id);
					continue;
				}

				const requirement = result.data;
				// Architecture decisions can be created for requirements in any active state
				// except Draft (must be under review or approved)
				const validStates = [
					'Under Review',
					'Approved',
					'Architecture',
					'Ready',
					'Implemented',
					'Validated'
				];

				if (!validStates.includes(requirement.status)) {
					invalidRequirements.push(`${requirement.title} (${requirement.status})`);
				}
			}

			if (notFoundRequirements.length > 0) {
				return `Requirements not found: ${notFoundRequirements.join(', ')}`;
			}

			if (invalidRequirements.length > 0) {
				return `Cannot create architecture decisions for requirements in invalid states: ${invalidRequirements.join(', ')}. Requirements must be Under Review or later.`;
			}

			return null;
		} catch (error) {
			console.warn('Architecture requirement validation failed:', error);
			return null;
		}
	},

	/**
	 * Validate task status progression and linked requirement status
	 */
	validateTaskStatusProgression: async (
		taskId: string,
		newStatus: string
	): Promise<string | null> => {
		if (!mcpClient.isConnected()) {
			return null;
		}

		try {
			const taskResult = await mcpClient.getTaskDetails(taskId);
			if (!taskResult.success || !taskResult.data) {
				return 'Task not found';
			}

			const task = taskResult.data;
			const currentStatus = task.status;

			// Define valid status transitions for tasks
			const validTransitions: Record<string, string[]> = {
				'Not Started': ['In Progress'],
				'In Progress': ['Not Started', 'Blocked', 'Complete'],
				Blocked: ['In Progress'],
				Complete: ['In Progress'], // Allow reopening if needed
				Abandoned: [] // No transitions from abandoned
			};

			if (!validTransitions[currentStatus]?.includes(newStatus)) {
				return `Invalid status transition from ${currentStatus} to ${newStatus}`;
			}

			// Special validation for completing tasks
			if (newStatus === 'Complete') {
				// Check if all linked requirements are properly progressed
				const requirementIds = task.requirement_ids || [];
				if (requirementIds.length > 0) {
					for (const reqId of requirementIds) {
						const reqResult = await mcpClient.getRequirementDetails(reqId);
						if (reqResult.success && reqResult.data) {
							const requirement = reqResult.data;
							// Requirement should be at least Ready when task is completed
							const validStatesForCompletion = ['Ready', 'Implemented', 'Validated'];
							if (!validStatesForCompletion.includes(requirement.status)) {
								return `Cannot complete task while requirement "${requirement.title}" is in ${requirement.status} status. Requirement should be Ready or later.`;
							}
						}
					}
				}
			}

			return null;
		} catch (error) {
			console.warn('Task status progression validation failed:', error);
			return null;
		}
	},

	/**
	 * Validate requirement status progression based on linked tasks and architecture
	 */
	validateRequirementStatusProgression: async (
		requirementId: string,
		newStatus: string
	): Promise<string | null> => {
		if (!mcpClient.isConnected()) {
			return null;
		}

		try {
			// Get requirement details
			const reqResult = await mcpClient.getRequirementDetails(requirementId);
			if (!reqResult.success || !reqResult.data) {
				return 'Requirement not found';
			}

			const requirement = reqResult.data;
			const currentStatus = requirement.status;

			// Basic status progression validation (already handled by business rules)
			// Here we add cross-entity constraints

			// When moving to Implemented, check if there are any incomplete tasks
			if (newStatus === 'Implemented') {
				const tasksResult = await mcpClient.getTasks();
				if (tasksResult.success && tasksResult.data) {
					const linkedTasks = tasksResult.data.filter((task: any) =>
						task.requirement_ids?.includes(requirementId)
					);

					const incompleteTasks = linkedTasks.filter(
						(task: any) => task.status !== 'Complete' && task.status !== 'Abandoned'
					);

					if (incompleteTasks.length > 0) {
						const taskTitles = incompleteTasks.map((task: any) => task.title).join(', ');
						return `Cannot mark requirement as Implemented while tasks are incomplete: ${taskTitles}`;
					}
				}
			}

			// When moving to Validated, ensure implementation is complete
			if (newStatus === 'Validated' && currentStatus !== 'Implemented') {
				return 'Requirement must be Implemented before it can be Validated';
			}

			return null;
		} catch (error) {
			console.warn('Requirement status progression validation failed:', error);
			return null;
		}
	},

	/**
	 * Validate that an entity can be deleted based on dependencies
	 */
	validateEntityDeletion: async (
		entityType: 'requirement' | 'task' | 'architecture',
		entityId: string
	): Promise<string | null> => {
		if (!mcpClient.isConnected()) {
			return null;
		}

		try {
			if (entityType === 'requirement') {
				// Check for dependent tasks
				const tasksResult = await mcpClient.getTasks();
				if (tasksResult.success && tasksResult.data) {
					const dependentTasks = tasksResult.data.filter((task: any) =>
						task.requirement_ids?.includes(entityId)
					);

					if (dependentTasks.length > 0) {
						const taskTitles = dependentTasks
							.slice(0, 3)
							.map((task: any) => task.title)
							.join(', ');
						const moreText =
							dependentTasks.length > 3 ? ` and ${dependentTasks.length - 3} more` : '';
						return `Cannot delete requirement. It is linked to tasks: ${taskTitles}${moreText}`;
					}
				}

				// Check for dependent architecture decisions
				const archResult = await mcpClient.getArchitectureDecisions();
				if (archResult.success && archResult.data) {
					const dependentArch = archResult.data.filter((arch: any) =>
						arch.requirement_ids?.includes(entityId)
					);

					if (dependentArch.length > 0) {
						const archTitles = dependentArch
							.slice(0, 3)
							.map((arch: any) => arch.title)
							.join(', ');
						const moreText =
							dependentArch.length > 3 ? ` and ${dependentArch.length - 3} more` : '';
						return `Cannot delete requirement. It is linked to architecture decisions: ${archTitles}${moreText}`;
					}
				}
			}

			return null;
		} catch (error) {
			console.warn('Entity deletion validation failed:', error);
			return null;
		}
	}
};
