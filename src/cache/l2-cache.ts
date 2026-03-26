import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface L2CacheConfig {
  dbPath: string;
  ttlMs: number;
  maxEntries?: number;
}

export interface L2CacheEntry {
  key: string;
  value: string;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

interface PersistedL2Cache {
  entries: L2CacheEntry[];
}

export class L2Cache {
  private readonly cacheFilePath: string;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly entries = new Map<string, L2CacheEntry>();

  constructor(config: L2CacheConfig) {
    fs.mkdirSync(config.dbPath, { recursive: true });
    this.cacheFilePath = path.join(config.dbPath, 'mcp-cache-l2.json');
    this.ttlMs = config.ttlMs;
    this.maxEntries = config.maxEntries ?? 10000;
    this.initialize();
  }

  private initialize(): void {
    if (!fs.existsSync(this.cacheFilePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.cacheFilePath, 'utf-8').trim();
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedL2Cache;
      for (const entry of parsed.entries ?? []) {
        this.entries.set(entry.key, entry);
      }

      this.cleanupExpired();
    } catch {
      this.entries.clear();
    }
  }

  generateKey(serverId: string, method: string, params: unknown): string {
    const normalizedParams = JSON.stringify(params);
    const payload = `${serverId}:${method}:${normalizedParams}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  get(key: string): unknown | undefined {
    const row = this.entries.get(key);

    if (!row) {
      return undefined;
    }

    if (Date.now() > row.expiresAt) {
      this.entries.delete(key);
      this.persist();
      return undefined;
    }

    row.hitCount += 1;
    this.persist();

    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? this.ttlMs;
    const expiresAt = now + ttl;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const existing = this.entries.get(key);

    this.entries.set(key, {
      key,
      value: serialized,
      createdAt: now,
      expiresAt,
      hitCount: existing?.hitCount ?? 0,
    });

    this.cleanupIfNeeded();
    this.persist();
  }

  has(key: string): boolean {
    const row = this.entries.get(key);
    return row !== undefined && row.expiresAt > Date.now();
  }

  delete(key: string): boolean {
    const removed = this.entries.delete(key);
    if (removed) {
      this.persist();
    }

    return removed;
  }

  clear(): void {
    this.entries.clear();
    this.persist();
  }

  private cleanupIfNeeded(): void {
    this.cleanupExpired();

    if (this.entries.size <= this.maxEntries) {
      return;
    }

    const sortedEntries = Array.from(this.entries.values()).sort((left, right) => {
      if (left.hitCount !== right.hitCount) {
        return left.hitCount - right.hitCount;
      }

      return left.expiresAt - right.expiresAt;
    });

    const deleteCount = this.entries.size - this.maxEntries;
    for (const entry of sortedEntries.slice(0, deleteCount)) {
      this.entries.delete(entry.key);
    }
  }

  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        removed += 1;
      }
    }

    if (removed > 0) {
      this.persist();
    }

    return removed;
  }

  stats(): {
    entries: number;
    expiredEntries: number;
  } {
    const count = this.entries.size;
    const now = Date.now();
    let expiredCount = 0;

    for (const entry of this.entries.values()) {
      if (entry.expiresAt <= now) {
        expiredCount += 1;
      }
    }

    return {
      entries: count,
      expiredEntries: expiredCount,
    };
  }

  close(): void {
    this.persist();
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.cacheFilePath), { recursive: true });
    const tempFilePath = `${this.cacheFilePath}.tmp`;
    const payload: PersistedL2Cache = {
      entries: Array.from(this.entries.values()),
    };

    fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempFilePath, this.cacheFilePath);
  }
}

export const createL2Cache = (config: Partial<L2CacheConfig> = {}): L2Cache => {
  return new L2Cache({
    dbPath: config.dbPath ?? path.join(process.cwd(), '.mcp-cache'),
    ttlMs: config.ttlMs ?? 300000,
    maxEntries: config.maxEntries ?? 10000,
  });
};
