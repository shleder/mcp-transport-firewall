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

export class CacheManager<T = unknown> {
  private l1: L1Cache<T>;
  private l2: L2Cache;
  private serverId: string;
  private alwaysCacheTools: Set<string>;
  private neverCacheTools: Set<string>;
  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    misses: 0,
  };

  constructor(config: CacheConfig) {
    this.serverId = config.serverId;
    this.l1 = createL1Cache<T>(config.l1);
    this.l2 = createL2Cache(config.l2);
    this.alwaysCacheTools = new Set(config.alwaysCacheTools ?? []);
    this.neverCacheTools = new Set(config.neverCacheTools ?? []);
  }

  generateKey(method: string, params: unknown): string {
    return this.l1.generateKey(this.serverId, method, params);
  }

  shouldCache(method: string): boolean {
    if (this.neverCacheTools.has(method)) {
      return false;
    }
    if (this.alwaysCacheTools.has(method)) {
      return true;
    }
    return method.startsWith('read_') || method.startsWith('list_') || method.startsWith('search_');
  }

  get(method: string, params: unknown): T | undefined {
    if (!this.shouldCache(method)) {
      return undefined;
    }

    const key = this.generateKey(method, params);

    const l1Result = this.l1.get(key);
    if (l1Result !== undefined) {
      this.stats.l1Hits++;
      auditLog('CACHE_HIT', { level: 'L1', method, key, serverId: this.serverId });
      return l1Result;
    }

    const l2Result = this.l2.get(key);
    if (l2Result !== undefined) {
      this.stats.l2Hits++;
      this.l1.set(key, l2Result as T);
      auditLog('CACHE_HIT', { level: 'L2', method, key, serverId: this.serverId });
      return l2Result as T;
    }

    this.stats.misses++;
    auditLog('CACHE_MISS', { method, key, serverId: this.serverId });
    return undefined;
  }

  set(method: string, params: unknown, value: T, ttlMs?: number): void {
    if (!this.shouldCache(method)) {
      return;
    }

    const key = this.generateKey(method, params);
    this.l1.set(key, value, ttlMs);
    this.l2.set(key, value, ttlMs);
    auditLog('CACHE_SET', { method, key, serverId: this.serverId, ttlMs });
  }

  invalidate(method: string, params: unknown): boolean {
    const key = this.generateKey(method, params);
    this.l1.delete(key);
    const l2Deleted = this.l2.delete(key);
    auditLog('CACHE_INVALIDATE', { method, key, serverId: this.serverId });
    return l2Deleted;
  }

  clear(): void {
    this.l1.clear();
    this.l2.clear();
    this.stats = { l1Hits: 0, l2Hits: 0, misses: 0 };
    auditLog('CACHE_CLEAR', { serverId: this.serverId });
  }

  getStats(): CacheStats {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const total = totalHits + this.stats.misses;
    return {
      l1: this.l1.stats(),
      l2: this.l2.stats(),
      hits: {
        l1: this.stats.l1Hits,
        l2: this.stats.l2Hits,
        total: totalHits,
      },
      misses: this.stats.misses,
      hitRatio: total > 0 ? totalHits / total : 0,
    };
  }

  close(): void {
    this.l2.close();
  }
}

let globalCacheManager: CacheManager | undefined;

export const initializeCache = (config: CacheConfig): CacheManager => {
  if (globalCacheManager) {
    globalCacheManager.close();
  }
  globalCacheManager = new CacheManager(config);
  return globalCacheManager;
};

export const getCache = (): CacheManager | undefined => {
  return globalCacheManager;
};
