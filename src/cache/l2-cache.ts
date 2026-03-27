import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface L2CacheConfig {
  dbPath: string;
  ttlMs: number;
  maxEntries?: number;
}

export interface L2Cache {
  generateKey: (serverId: string, method: string, params: unknown) => string;
  get: (key: string) => unknown | undefined;
  set: (key: string, value: unknown, ttlMs?: number) => void;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  cleanupExpired: () => number;
  stats: () => { entries: number; expiredEntries: number };
  close: () => void;
}

export const createL2Cache = (config: Partial<L2CacheConfig> = {}): L2Cache => {
  const dbDir = config.dbPath ?? path.join(process.cwd(), '.mcp-cache');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbFile = path.join(dbDir, 'mcp-cache-l2.sqlite');
  const db = new Database(dbFile);

  const ttlMs = config.ttlMs ?? 300000;
  const maxEntries = config.maxEntries ?? 10000;

  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  const stmtGet = db.prepare('SELECT value, expires_at, hit_count FROM cache_entries WHERE key = ?');
  const stmtUpdateHit = db.prepare('UPDATE cache_entries SET hit_count = hit_count + 1 WHERE key = ?');
  const stmtDelete = db.prepare('DELETE FROM cache_entries WHERE key = ?');
  const stmtInsert = db.prepare(`
    INSERT INTO cache_entries (key, value, created_at, expires_at, hit_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      expires_at = excluded.expires_at
  `);
  const stmtClear = db.prepare('DELETE FROM cache_entries');
  const stmtCleanup = db.prepare('DELETE FROM cache_entries WHERE expires_at <= ?');
  const stmtCount = db.prepare('SELECT COUNT(*) as count FROM cache_entries');
  const stmtCountExpired = db.prepare('SELECT COUNT(*) as count FROM cache_entries WHERE expires_at <= ?');
  const stmtEnforceLimit = db.prepare(`
    DELETE FROM cache_entries WHERE key IN (
      SELECT key FROM cache_entries
      ORDER BY hit_count ASC, expires_at ASC
      LIMIT ?
    )
  `);

  const cleanupIfNeeded = (): void => {
    const now = Date.now();
    stmtCleanup.run(now);

    try {
      const result = stmtCount.get() as { count: number };
      if (result.count > maxEntries) {
        const excess = result.count - maxEntries;
        stmtEnforceLimit.run(excess);
      }
    } catch {
      // Ignore
    }
  };

  cleanupIfNeeded();

  return {
    generateKey: (serverId: string, method: string, params: unknown): string => {
      const normalizedParams = typeof params === 'string' ? params : JSON.stringify(params);
      const payload = `${serverId}:${method}:${normalizedParams}`;
      return createHash('sha256').update(payload).digest('hex');
    },

    get: (key: string): unknown | undefined => {
      const row = stmtGet.get(key) as { value: string; expires_at: number; hit_count: number } | undefined;
      if (!row) {
        return undefined;
      }

      if (Date.now() > row.expires_at) {
        stmtDelete.run(key);
        return undefined;
      }

      stmtUpdateHit.run(key);
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    },

    set: (key: string, value: unknown, entryTtlMs?: number): void => {
      const now = Date.now();
      const expiresAt = now + (entryTtlMs ?? ttlMs);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      const existing = stmtGet.get(key) as { hit_count: number } | undefined;
      const hitCount = existing?.hit_count ?? 0;

      stmtInsert.run(key, serialized, now, expiresAt, hitCount);
      cleanupIfNeeded();
    },

    has: (key: string): boolean => {
      const row = stmtGet.get(key) as { expires_at: number } | undefined;
      return row !== undefined && row.expires_at > Date.now();
    },

    delete: (key: string): boolean => {
      const result = stmtDelete.run(key);
      return result.changes > 0;
    },

    clear: (): void => {
      stmtClear.run();
    },

    cleanupExpired: (): number => {
      const result = stmtCleanup.run(Date.now());
      return result.changes;
    },

    stats: (): { entries: number; expiredEntries: number } => {
      const total = stmtCount.get() as { count: number };
      const expired = stmtCountExpired.get(Date.now()) as { count: number };
      return {
        entries: total.count,
        expiredEntries: expired.count,
      };
    },

    close: (): void => {
      db.close();
    },
  };
};
