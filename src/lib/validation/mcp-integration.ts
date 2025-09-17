import { mcpClient } from '$lib/services/mcp-client.js';
import type { ValidationContext } from './validator.js';
import { ValidationCache } from './cache.js';

export class MCPValidationService {
	private cache: ValidationCache;
	private crossEntityRules: typeof import('./cross-entity-rules.js').crossEntityRules | null = null;
	private pendingValidations = new Map<string, Promise<string | null>>();

	constructor() {
		this.cache = new ValidationCache(30000, 1000); // 30 seconds, 1000 entries
	}

	async validateWithMCP(
		fieldName: string,
		value: any,
		context: ValidationContext
	): Promise<string | null> {
		const cacheKey = `${fieldName}:${JSON.stringify(value)}:${context.existingId || 'new'}:${context.entityType || 'default'}`;

		// Check if there's already a pending validation for this exact request
		const existingValidation = this.pendingValidations.get(cacheKey);
		if (existingValidation) {
			return await existingValidation;
		}

		// Use the advanced cache's getOrSet method with deduplication
		const validationPromise = this.cache.getOrSet(cacheKey, async () => {
			try {
				return await this.performValidation(fieldName, value, context);
			} finally {
				// Clean up the pending validation
				this.pendingValidations.delete(cacheKey);
			}
		});

		// Store the promise for deduplication
		this.pendingValidations.set(cacheKey, validationPromise);

		return await validationPromise;
	}

	private async performValidation(
		fieldName: string,
		value: any,
		context: ValidationContext
	): Promise<string | null> {
		try {
			// Load cross-entity rules if needed
			if (!this.crossEntityRules) {
				const module = await import('./cross-entity-rules.js');
				this.crossEntityRules = module.crossEntityRules;
			}

			let result = null;

			// Title duplicate checking
			if (fieldName === 'title' && typeof value === 'string' && value.length > 0) {
				result = await this.checkDuplicateTitle(value, context);
			}

			// Requirement status validation for task creation
			if (fieldName === 'requirement_ids' && Array.isArray(value) && value.length > 0) {
				result = await this.crossEntityRules.validateRequirementForTask(value, context);
			}

			// Priority validation for proper values
			if (fieldName === 'priority' && typeof value === 'string') {
				result = await this.validatePriorityValue(value);
			}

			// Status progression validation with cross-entity rules
			if (fieldName === 'status' && typeof value === 'string' && context.existingId) {
				result = await this.validateStatusProgressionWithCrossEntity(
					context.existingId,
					value,
					context.entityType || 'requirement'
				);
			}

			return result;
		} catch (error) {
			console.warn(`MCP validation failed for ${fieldName}:`, error);
			return null; // Graceful degradation
		}
	}

	private async checkDuplicateTitle(
		title: string,
		context: ValidationContext
	): Promise<string | null> {
		if (!mcpClient.isConnected()) {
			return null; // Graceful degradation
		}

		const entityType = this.determineEntityType(context);
		const excludeId = context.existingId;

		try {
			let existingEntities = [];

			// Query existing entities based on type
			switch (entityType) {
				case 'requirement':
					const reqResult = await mcpClient.getRequirements();
					existingEntities = reqResult.success && Array.isArray(reqResult.data) ? reqResult.data : [];
					break;
				case 'task':
					const taskResult = await mcpClient.getTasks();
					existingEntities = taskResult.success && Array.isArray(taskResult.data) ? taskResult.data : [];
					break;
				case 'architecture':
					const archResult = await mcpClient.getArchitectureDecisions();
					existingEntities = archResult.success && Array.isArray(archResult.data) ? archResult.data : [];
					break;
			}

			// Check for exact title matches (case-insensitive, excluding current entity)
			const duplicates = existingEntities.filter(
				(entity: any) =>
					entity.title.toLowerCase() === title.toLowerCase() && entity.id !== excludeId
			);

			return duplicates.length > 0
				? `A ${entityType} with the title "${title}" already exists`
				: null;
		} catch (error) {
			console.warn(`Duplicate title check failed for ${entityType}:`, error);
			return null;
		}
	}

	private async validatePriorityValue(priority: string): Promise<string | null> {
		const validPriorities = ['P0', 'P1', 'P2', 'P3'];

		if (!validPriorities.includes(priority)) {
			return `Priority must be one of: ${validPriorities.join(', ')}`;
		}

		return null;
	}

	private async validateStatusProgressionWithCrossEntity(
		entityId: string,
		newStatus: string,
		entityType: string
	): Promise<string | null> {
		if (!this.crossEntityRules) return null;

		try {
			// First do basic status progression validation
			const { businessRules } = await import('./schemas.js');

			// Get current status first
			let currentStatus = '';
			if (entityType === 'requirement') {
				const result = await mcpClient.getRequirementDetails(entityId);
				if (result.success && result.data) {
					currentStatus = result.data.status;
					// Basic progression check
					const basicError = businessRules.validateStatusProgression(
						currentStatus as any,
						newStatus as any
					);
					if (basicError) return basicError;
				}
			} else if (entityType === 'task') {
				const result = await mcpClient.getTaskDetails(entityId);
				if (result.success && result.data) {
					currentStatus = result.data.status;
				}
			}

			// Then do cross-entity validation
			if (entityType === 'requirement') {
				return await this.crossEntityRules.validateRequirementStatusProgression(
					entityId,
					newStatus
				);
			} else if (entityType === 'task') {
				return await this.crossEntityRules.validateTaskStatusProgression(entityId, newStatus);
			}

			return null;
		} catch (error) {
			console.warn('Cross-entity status progression validation failed:', error);
			return null;
		}
	}

	private determineEntityType(context: ValidationContext): 'requirement' | 'task' | 'architecture' {
		// Logic to determine entity type from validation context
		if (context.entityType) {
			return context.entityType as 'requirement' | 'task' | 'architecture';
		}

		// Default fallback
		return 'requirement';
	}

	clearCache(): void {
		this.cache.clear();
		this.pendingValidations.clear();
	}

	getCacheStats(): { size: number; hitRate: number; totalRequests: number; memoryUsage?: number } {
		return this.cache.getStats();
	}

	/**
	 * Invalidate cache entries for a specific entity when it changes
	 */
	invalidateEntity(entityType: string, entityId?: string): void {
		if (entityId) {
			// Invalidate specific entity - cache key format is fieldName:value:existingId:entityType
			this.cache.invalidate(
				(key) => key.endsWith(`:${entityType}`) && key.includes(`:${entityId}:`)
			);
		} else {
			// Invalidate all entities of this type
			this.cache.invalidate((key) => key.endsWith(`:${entityType}`));
		}
	}

	/**
	 * Get cache export for debugging
	 */
	exportCache(): Array<{ key: string; value: any; age: number; accessCount: number }> {
		return this.cache.export();
	}
}
