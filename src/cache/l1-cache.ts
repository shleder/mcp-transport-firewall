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

export class L1Cache<T> {
  private cache: LRUCache<string, CacheEntry<T>>;

  constructor(config: L1CacheConfig) {
    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: config.maxSize,
      ttl: config.ttlMs,
      updateAgeOnGet: false,
    });
  }

  generateKey(serverId: string, method: string, params: unknown): string {
    const normalizedParams = JSON.stringify(params, Object.keys(params as object).sort());
    const payload = `${serverId}:${method}:${normalizedParams}`;
    return this.hashString(payload);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.createdAt + entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttl: ttlMs ?? this.cache.ttl ?? 300000,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.createdAt + entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max ?? 0,
    };
  }
}

export const createL1Cache = <T>(config: Partial<L1CacheConfig> = {}): L1Cache<T> => {
  return new L1Cache<T>({
    maxSize: config.maxSize ?? 1000,
    ttlMs: config.ttlMs ?? 300000,
  });
};
