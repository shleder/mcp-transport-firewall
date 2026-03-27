import { LRUCache } from 'lru-cache';

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
}

export interface L1CacheConfig {
  maxSize: number;
  ttlMs: number;
}

export interface L1Cache<T> {
  generateKey: (serverId: string, method: string, params: unknown) => string;
  get: (key: string) => T | undefined;
  set: (key: string, value: T, ttlMs?: number) => void;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  size: () => number;
  stats: () => { size: number; maxSize: number };
}

export const createL1Cache = <T>(config: Partial<L1CacheConfig> = {}): L1Cache<T> => {
  const cache = new LRUCache<string, CacheEntry<T>>({
    max: config.maxSize ?? 1000,
    ttl: config.ttlMs ?? 300000,
    updateAgeOnGet: false,
  });

  const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  return {
    generateKey: (serverId: string, method: string, params: unknown): string => {
      const normalizedParams = typeof params === 'object' && params !== null
        ? JSON.stringify(params, Object.keys(params as Record<string, unknown>).sort())
        : JSON.stringify(params);
      const payload = `${serverId}:${method}:${normalizedParams}`;
      return hashString(payload);
    },

    get: (key: string): T | undefined => {
      const entry = cache.get(key);
      if (!entry) return undefined;

      if (Date.now() > entry.createdAt + entry.ttl) {
        cache.delete(key);
        return undefined;
      }

      return entry.value;
    },

    set: (key: string, value: T, ttlMs?: number): void => {
      cache.set(key, {
        value,
        createdAt: Date.now(),
        ttl: ttlMs ?? config.ttlMs ?? 300000,
      });
    },

    has: (key: string): boolean => {
      const entry = cache.get(key);
      if (!entry) return false;

      if (Date.now() > entry.createdAt + entry.ttl) {
        cache.delete(key);
        return false;
      }

      return true;
    },

    delete: (key: string): boolean => {
      return cache.delete(key);
    },

    clear: (): void => {
      cache.clear();
    },

    size: (): number => {
      return cache.size;
    },

    stats: (): { size: number; maxSize: number } => {
      return {
        size: cache.size,
        maxSize: config.maxSize ?? 1000,
      };
    },
  };
};
