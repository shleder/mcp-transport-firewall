export interface CacheStats {
  l1: { size: number; maxSize: number };
  l2: { entries: number; expiredEntries: number };
  hits: { l1: number; l2: number; total: number };
  misses: number;
  hitRatio: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  totalCalls: number;
}

export interface PreflightStats {
  pending: number;
  consumed: number;
}

export interface RateLimitStats {
  global: { entries: number };
  tenants: Array<{ tenantId: string; windowMs: number; maxRequests: number }>;
}

export interface BlockedRequestReasonCount {
  code: string;
  count: number;
}

export interface BlockedRequestSample {
  timestamp: string;
  event: string;
  code: string;
  reason?: string;
  ip?: string;
  path?: string;
}

export interface BlockedRequestMetrics {
  total: number;
  lastBlockedAt: string | null;
  byCode: BlockedRequestReasonCount[];
  recent: BlockedRequestSample[];
}

export interface RouteConfig {
  name: string;
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}

export interface ProxyStats {
  routes: number;
  cache: CacheStats | null;
  circuitBreakers: CircuitBreakerStats[];
  preflight: PreflightStats;
  rateLimit: RateLimitStats;
  blockedRequests: BlockedRequestMetrics;
}

export interface AdminHealth {
  status: 'healthy';
  timestamp: string;
}

export interface AdminRoute {
  name: string;
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}

export interface AdminSIEMConfig {
  enabled: boolean;
  format: 'CEF' | 'SYSLOG';
  host: string;
  port: number;
}

export interface AdminConfigData {
  serverId: string;
  l1: {
    maxSize?: number;
    ttlMs?: number;
  };
  l2: {
    dbPath?: string;
    ttlMs?: number;
  };
  alwaysCacheTools: string[];
  neverCacheTools: string[];
}

export type AdminAPIResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
