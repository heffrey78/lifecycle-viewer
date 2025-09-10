/**
 * High-performance validation cache with LRU eviction and TTL expiration
 */

interface CacheEntry<T = any> {
	value: T;
	timestamp: number;
	accessCount: number;
	lastAccessed: number;
}

export class ValidationCache {
	private cache = new Map<string, CacheEntry>();
	private maxAge: number; // TTL in milliseconds
	private maxSize: number; // Maximum number of cache entries
	private hitCount = 0;
	private totalRequests = 0;
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor(maxAge: number = 30000, maxSize: number = 1000) {
		this.maxAge = maxAge;
		this.maxSize = maxSize;

		// Clean up expired entries periodically
		this.cleanupInterval = setInterval(() => this.cleanup(), Math.max(maxAge / 2, 5000));
	}

	/**
	 * Destroy the cache and cleanup resources
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.cache.clear();
		this.hitCount = 0;
		this.totalRequests = 0;
	}

	/**
	 * Estimate memory size of a value without expensive JSON.stringify
	 */
	private estimateValueSize(value: any): number {
		if (value === null || value === undefined) return 4;
		if (typeof value === 'string') return value.length * 2; // Unicode chars
		if (typeof value === 'number' || typeof value === 'boolean') return 8;
		if (Array.isArray(value)) {
			return value.reduce((size, item) => size + this.estimateValueSize(item), 12); // Array overhead
		}
		if (typeof value === 'object') {
			let size = 12; // Object overhead
			for (const [key, val] of Object.entries(value)) {
				size += key.length * 2 + this.estimateValueSize(val);
			}
			return size;
		}
		return 16; // Default for unknown types
	}

	/**
	 * Set a cache entry with automatic LRU eviction if needed
	 */
	set<T>(key: string, value: T): void {
		const now = Date.now();

		// If cache is at capacity and key doesn't exist, evict LRU entry
		if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
			this.evictLRU();
		}

		this.cache.set(key, {
			value,
			timestamp: now,
			accessCount: 0,
			lastAccessed: now
		});
	}

	/**
	 * Get a cache entry, returning null if expired or not found
	 */
	get<T>(key: string): T | null {
		this.totalRequests++;

		const entry = this.cache.get(key);
		if (!entry) {
			return null;
		}

		const now = Date.now();

		// Check if entry has expired
		if (now - entry.timestamp > this.maxAge) {
			this.cache.delete(key);
			return null;
		}

		// Update access statistics for LRU
		entry.accessCount++;
		entry.lastAccessed = now;
		this.hitCount++;

		return entry.value as T;
	}

	/**
	 * Check if a key exists and is not expired
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) {
			return false;
		}

		// Check if expired
		if (Date.now() - entry.timestamp > this.maxAge) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete a specific cache entry
	 */
	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.hitCount = 0;
		this.totalRequests = 0;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {
		size: number;
		maxSize: number;
		hitRate: number;
		totalRequests: number;
		hitCount: number;
		oldestEntry?: number;
		memoryUsage?: number;
	} {
		const now = Date.now();
		let oldestTimestamp = now;
		let memoryEstimate = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (entry.timestamp < oldestTimestamp) {
				oldestTimestamp = entry.timestamp;
			}
			// Optimized memory estimate: key length * 2 (Unicode chars) + value estimate + metadata
			memoryEstimate += key.length * 2 + this.estimateValueSize(entry.value) + 64;
		}

		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate: this.totalRequests > 0 ? this.hitCount / this.totalRequests : 0,
			totalRequests: this.totalRequests,
			hitCount: this.hitCount,
			oldestEntry: oldestTimestamp === now ? undefined : now - oldestTimestamp,
			memoryUsage: memoryEstimate
		};
	}

	/**
	 * Invalidate cache entries matching a pattern or predicate
	 */
	invalidate(pattern?: string | RegExp | ((key: string, value: any) => boolean)): number {
		let deletedCount = 0;

		if (!pattern) {
			// Invalidate all
			const size = this.cache.size;
			this.clear();
			return size;
		}

		const keysToDelete: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			let shouldDelete = false;

			if (typeof pattern === 'string') {
				shouldDelete = key.includes(pattern);
			} else if (pattern instanceof RegExp) {
				shouldDelete = pattern.test(key);
			} else if (typeof pattern === 'function') {
				shouldDelete = pattern(key, entry.value);
			}

			if (shouldDelete) {
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach((key) => {
			this.cache.delete(key);
			deletedCount++;
		});

		return deletedCount;
	}

	/**
	 * Get or set a cache entry with a factory function
	 */
	async getOrSet<T>(key: string, factory: () => Promise<T> | T): Promise<T> {
		let value = this.get<T>(key);

		if (value !== null) {
			return value;
		}

		// Value not in cache, create it
		value = await factory();
		this.set(key, value);

		return value;
	}

	/**
	 * Evict the least recently used entry
	 */
	private evictLRU(): void {
		let lruKey: string | null = null;
		let lruTimestamp = Date.now();
		let lruAccessCount = Number.MAX_SAFE_INTEGER;

		for (const [key, entry] of this.cache.entries()) {
			// Prioritize by last accessed time, then by access count
			if (
				entry.lastAccessed < lruTimestamp ||
				(entry.lastAccessed === lruTimestamp && entry.accessCount < lruAccessCount)
			) {
				lruKey = key;
				lruTimestamp = entry.lastAccessed;
				lruAccessCount = entry.accessCount;
			}
		}

		if (lruKey) {
			this.cache.delete(lruKey);
		}
	}

	/**
	 * Clean up expired entries
	 */
	private cleanup(): void {
		const now = Date.now();
		const keysToDelete: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > this.maxAge) {
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach((key) => this.cache.delete(key));
	}

	/**
	 * Export cache contents for debugging or persistence
	 */
	export(): Array<{ key: string; value: any; age: number; accessCount: number }> {
		const now = Date.now();
		const entries: Array<{ key: string; value: any; age: number; accessCount: number }> = [];

		for (const [key, entry] of this.cache.entries()) {
			entries.push({
				key,
				value: entry.value,
				age: now - entry.timestamp,
				accessCount: entry.accessCount
			});
		}

		return entries.sort((a, b) => a.age - b.age); // Sort by age (oldest first)
	}
}
