import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationCache } from './cache.js';

describe('ValidationCache', () => {
	let cache: ValidationCache;

	beforeEach(() => {
		cache = new ValidationCache(1000, 10); // 1 second TTL, 10 max entries for testing
	});

	describe('Basic Operations', () => {
		it('should store and retrieve values', () => {
			cache.set('key1', 'value1');
			expect(cache.get('key1')).toBe('value1');
		});

		it('should return null for non-existent keys', () => {
			expect(cache.get('nonexistent')).toBeNull();
		});

		it('should check if key exists', () => {
			cache.set('key1', 'value1');
			expect(cache.has('key1')).toBe(true);
			expect(cache.has('nonexistent')).toBe(false);
		});

		it('should delete specific keys', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');

			expect(cache.delete('key1')).toBe(true);
			expect(cache.get('key1')).toBeNull();
			expect(cache.get('key2')).toBe('value2');

			expect(cache.delete('nonexistent')).toBe(false);
		});

		it('should clear all entries', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');

			// Access entries to increment counters
			cache.get('key1');
			cache.get('key2');

			cache.clear();
			expect(cache.get('key1')).toBeNull();
			expect(cache.get('key2')).toBeNull();

			const stats = cache.getStats();
			expect(stats.size).toBe(0);
			// totalRequests includes the get calls above for testing null values
			expect(stats.hitCount).toBe(0);
		});
	});

	describe('TTL (Time To Live)', () => {
		it('should expire entries after TTL', async () => {
			const shortCache = new ValidationCache(100, 10); // 100ms TTL

			shortCache.set('key1', 'value1');
			expect(shortCache.get('key1')).toBe('value1');

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(shortCache.get('key1')).toBeNull();
			expect(shortCache.has('key1')).toBe(false);
		});

		it('should clean up expired entries', async () => {
			const shortCache = new ValidationCache(50, 10); // 50ms TTL

			shortCache.set('key1', 'value1');
			shortCache.set('key2', 'value2');

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Access expired entry should trigger cleanup and return null
			const result = shortCache.get('key1');
			expect(result).toBeNull();

			// Entry should be removed from cache
			expect(shortCache.has('key1')).toBe(false);
			expect(shortCache.has('key2')).toBe(false);
		});
	});

	describe('LRU Eviction', () => {
		it('should evict least recently used entries when full', () => {
			const smallCache = new ValidationCache(5000, 3); // 3 max entries

			// Fill cache to capacity
			smallCache.set('key1', 'value1');
			smallCache.set('key2', 'value2');
			smallCache.set('key3', 'value3');

			// Access key1 to make it recently used
			smallCache.get('key1');

			// Add another entry, should evict key2 (least recently used)
			smallCache.set('key4', 'value4');

			expect(smallCache.get('key1')).toBe('value1'); // Still there
			expect(smallCache.get('key2')).toBeNull(); // Should be evicted
			expect(smallCache.get('key3')).toBe('value3'); // Still there
			expect(smallCache.get('key4')).toBe('value4'); // New entry
		});

		it('should consider both access time and access count for LRU', () => {
			const smallCache = new ValidationCache(5000, 2); // 2 max entries

			smallCache.set('key1', 'value1');
			smallCache.set('key2', 'value2');

			// Access key1 multiple times
			for (let i = 0; i < 5; i++) {
				smallCache.get('key1');
			}

			// Access key2 once
			smallCache.get('key2');

			// Add new entry
			smallCache.set('key3', 'value3');

			// key1 should still be there (heavily accessed)
			expect(smallCache.get('key1')).toBe('value1');
			// key3 should be there (newest)
			expect(smallCache.get('key3')).toBe('value3');
		});
	});

	describe('Statistics', () => {
		it('should track cache statistics', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');

			// Access key1 twice (2 hits)
			cache.get('key1');
			cache.get('key1');

			// Access non-existent key (1 miss)
			cache.get('nonexistent');

			const stats = cache.getStats();
			expect(stats.size).toBe(2);
			expect(stats.totalRequests).toBe(3);
			expect(stats.hitCount).toBe(2);
			expect(stats.hitRate).toBeCloseTo(2 / 3);
		});

		it('should estimate memory usage', () => {
			cache.set('key1', 'a simple string');
			cache.set('key2', { complex: 'object', with: ['multiple', 'properties'] });

			const stats = cache.getStats();
			expect(stats.memoryUsage).toBeGreaterThan(0);
			expect(typeof stats.memoryUsage).toBe('number');
		});

		it('should track oldest entry age', async () => {
			cache.set('key1', 'value1');

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 10));

			const stats = cache.getStats();
			expect(stats.oldestEntry).toBeGreaterThan(0);
		});
	});

	describe('Invalidation', () => {
		it('should invalidate all entries', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');
			cache.set('key3', 'value3');

			const deleted = cache.invalidate();
			expect(deleted).toBe(3);
			expect(cache.getStats().size).toBe(0);
		});

		it('should invalidate by string pattern', () => {
			cache.set('user:1', 'user1');
			cache.set('user:2', 'user2');
			cache.set('product:1', 'product1');

			const deleted = cache.invalidate('user:');
			expect(deleted).toBe(2);
			expect(cache.get('user:1')).toBeNull();
			expect(cache.get('user:2')).toBeNull();
			expect(cache.get('product:1')).toBe('product1');
		});

		it('should invalidate by regex pattern', () => {
			cache.set('user:123', 'user123');
			cache.set('user:456', 'user456');
			cache.set('admin:789', 'admin789');

			const deleted = cache.invalidate(/^user:/);
			expect(deleted).toBe(2);
			expect(cache.get('user:123')).toBeNull();
			expect(cache.get('user:456')).toBeNull();
			expect(cache.get('admin:789')).toBe('admin789');
		});

		it('should invalidate by predicate function', () => {
			cache.set('key1', { type: 'temp' });
			cache.set('key2', { type: 'permanent' });
			cache.set('key3', { type: 'temp' });

			const deleted = cache.invalidate((key, value) => value.type === 'temp');
			expect(deleted).toBe(2);
			expect(cache.get('key1')).toBeNull();
			expect(cache.get('key2')).toEqual({ type: 'permanent' });
			expect(cache.get('key3')).toBeNull();
		});
	});

	describe('getOrSet Method', () => {
		it('should return cached value if exists', async () => {
			cache.set('key1', 'cached_value');

			const factory = vi.fn().mockResolvedValue('new_value');
			const result = await cache.getOrSet('key1', factory);

			expect(result).toBe('cached_value');
			expect(factory).not.toHaveBeenCalled();
		});

		it('should call factory and cache result if key not exists', async () => {
			const factory = vi.fn().mockResolvedValue('factory_value');
			const result = await cache.getOrSet('key1', factory);

			expect(result).toBe('factory_value');
			expect(factory).toHaveBeenCalledTimes(1);
			expect(cache.get('key1')).toBe('factory_value');
		});

		it('should work with sync factory functions', async () => {
			const factory = vi.fn().mockReturnValue('sync_value');
			const result = await cache.getOrSet('key1', factory);

			expect(result).toBe('sync_value');
			expect(cache.get('key1')).toBe('sync_value');
		});
	});

	describe('Export and Import', () => {
		it('should export cache contents', () => {
			cache.set('key1', 'value1');
			cache.set('key2', { complex: 'value' });

			// Access key1 to increase access count
			cache.get('key1');
			cache.get('key1');

			const exported = cache.export();

			expect(exported).toHaveLength(2);
			expect(exported[0]).toHaveProperty('key');
			expect(exported[0]).toHaveProperty('value');
			expect(exported[0]).toHaveProperty('age');
			expect(exported[0]).toHaveProperty('accessCount');

			// Should be sorted by age (oldest first)
			expect(exported[0].age).toBeLessThanOrEqual(exported[1].age);
		});

		it('should export empty array for empty cache', () => {
			const exported = cache.export();
			expect(exported).toEqual([]);
		});
	});

	describe('Performance', () => {
		it('should handle large numbers of entries efficiently', () => {
			const largeCache = new ValidationCache(10000, 1000);

			const start = Date.now();

			// Set 500 entries
			for (let i = 0; i < 500; i++) {
				largeCache.set(`key${i}`, `value${i}`);
			}

			// Get 500 entries
			for (let i = 0; i < 500; i++) {
				largeCache.get(`key${i}`);
			}

			const end = Date.now();
			const duration = end - start;

			// Should complete quickly (less than 100ms for 1000 operations)
			expect(duration).toBeLessThan(100);

			const stats = largeCache.getStats();
			expect(stats.size).toBe(500);
			expect(stats.hitRate).toBe(1.0); // All hits
		});

		it('should maintain consistent performance with eviction', () => {
			const limitedCache = new ValidationCache(10000, 100); // 100 max entries

			const start = Date.now();

			// Add more entries than the limit
			for (let i = 0; i < 200; i++) {
				limitedCache.set(`key${i}`, `value${i}`);
			}

			const end = Date.now();
			const duration = end - start;

			// Should still complete quickly even with eviction
			expect(duration).toBeLessThan(50);

			const stats = limitedCache.getStats();
			expect(stats.size).toBeLessThanOrEqual(100); // Should not exceed limit
		});
	});

	describe('Edge Cases', () => {
		it('should handle null and undefined values', () => {
			cache.set('null_key', null);
			cache.set('undefined_key', undefined);

			expect(cache.get('null_key')).toBe(null);
			expect(cache.get('undefined_key')).toBe(undefined);
			expect(cache.has('null_key')).toBe(true);
			expect(cache.has('undefined_key')).toBe(true);
		});

		it('should handle complex object values', () => {
			const complexObject = {
				nested: {
					array: [1, 2, { deep: 'value' }],
					date: new Date().toISOString() // Use string instead of Date object
				}
			};

			cache.set('complex', complexObject);
			const retrieved = cache.get('complex');

			expect(retrieved).toEqual(complexObject);
			// Cache stores objects by reference, not copies
			expect(retrieved).toBe(complexObject);
		});

		it('should handle zero and false values correctly', () => {
			cache.set('zero', 0);
			cache.set('false', false);
			cache.set('empty_string', '');

			expect(cache.get('zero')).toBe(0);
			expect(cache.get('false')).toBe(false);
			expect(cache.get('empty_string')).toBe('');
		});

		it('should handle very long keys', () => {
			const longKey = 'a'.repeat(1000);
			cache.set(longKey, 'value');

			expect(cache.get(longKey)).toBe('value');
			expect(cache.has(longKey)).toBe(true);
		});
	});
});
