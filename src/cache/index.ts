import { L1Cache, createL1Cache } from './l1-cache.js';
import { L2Cache, createL2Cache } from './l2-cache.js';
import { auditLog } from '../utils/auditLogger.js';

export interface CacheConfig {
  serverId: string;
  l1?: {
    maxSize?: number;
    ttlMs?: number;
  };
  l2?: {
    dbPath?: string;
    ttlMs?: number;
  };
  alwaysCacheTools?: string[];
  neverCacheTools?: string[];
}

export interface CacheStats {
  l1: { size: number; maxSize: number };
  l2: { entries: number; expiredEntries: number };
  hits: { l1: number; l2: number; total: number };
  misses: number;
  hitRatio: number;
}

export interface CacheManager<T = unknown> {
  generateKey: (method: string, params: unknown) => string;
  shouldCache: (method: string) => boolean;
  get: (method: string, params: unknown) => T | undefined;
  set: (method: string, params: unknown, value: T, ttlMs?: number) => void;
  invalidate: (method: string, params: unknown) => boolean;
  clear: () => void;
  getStats: () => CacheStats;
  close: () => void;
}

export const createCacheManager = <T = unknown>(config: CacheConfig): CacheManager<T> => {
  const serverId = config.serverId;
  const l1 = createL1Cache<T>(config.l1);
  const l2 = createL2Cache(config.l2);
  const alwaysCacheTools = new Set(config.alwaysCacheTools ?? []);
  const neverCacheTools = new Set(config.neverCacheTools ?? []);

  let l1Hits = 0;
  let l2Hits = 0;
  let misses = 0;

  const shouldCache = (method: string): boolean => {
    if (neverCacheTools.has(method)) return false;
    if (alwaysCacheTools.has(method)) return true;
    return method.startsWith('read_') || method.startsWith('list_') || method.startsWith('search_');
  };

  const generateKey = (method: string, params: unknown): string => {
    return l1.generateKey(serverId, method, params);
  };

  return {
    generateKey,
    shouldCache,

    get: (method: string, params: unknown): T | undefined => {
      if (!shouldCache(method)) return undefined;

      const key = generateKey(method, params);

      const l1Result = l1.get(key);
      if (l1Result !== undefined) {
        l1Hits++;
        auditLog('CACHE_HIT', { level: 'L1', method, key, serverId });
        return l1Result;
      }

      const l2Result = l2.get(key);
      if (l2Result !== undefined) {
        l2Hits++;
        l1.set(key, l2Result as T);
        auditLog('CACHE_HIT', { level: 'L2', method, key, serverId });
        return l2Result as T;
      }

      misses++;
      auditLog('CACHE_MISS', { method, key, serverId });
      return undefined;
    },

    set: (method: string, params: unknown, value: T, ttlMs?: number): void => {
      if (!shouldCache(method)) return;

      const key = generateKey(method, params);
      l1.set(key, value, ttlMs);
      l2.set(key, value, ttlMs);
      auditLog('CACHE_SET', { method, key, serverId, ttlMs });
    },

    invalidate: (method: string, params: unknown): boolean => {
      const key = generateKey(method, params);
      l1.delete(key);
      const l2Deleted = l2.delete(key);
      auditLog('CACHE_INVALIDATE', { method, key, serverId });
      return l2Deleted;
    },

    clear: (): void => {
      l1.clear();
      l2.clear();
      l1Hits = 0;
      l2Hits = 0;
      misses = 0;
      auditLog('CACHE_CLEAR', { serverId });
    },

    getStats: (): CacheStats => {
      const totalHits = l1Hits + l2Hits;
      const total = totalHits + misses;
      return {
        l1: l1.stats(),
        l2: l2.stats(),
        hits: {
          l1: l1Hits,
          l2: l2Hits,
          total: totalHits,
        },
        misses,
        hitRatio: total > 0 ? totalHits / total : 0,
      };
    },

    close: (): void => {
      l2.close();
    },
  };
};

let globalCacheManager: CacheManager | undefined;

export const initializeCache = (config: CacheConfig): CacheManager => {
  if (globalCacheManager) {
    globalCacheManager.close();
  }
  globalCacheManager = createCacheManager(config);
  return globalCacheManager;
};

export const getCache = (): CacheManager | undefined => {
  return globalCacheManager;
};
