import { Request, Response, NextFunction } from 'express';
import { auditLogWithSIEM } from '../utils/auditLogger.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const createDefaultKeyGenerator = (req: Request): string => {
  const scopes = req.nhiScopes ?? [];
  const scopeKey = scopes.length > 0 ? scopes.join(':') : 'anonymous';
  return `${req.ip}:${scopeKey}`;
};

export const createRateLimiter = (config: RateLimitConfig) => {
  const windowMs = config.windowMs || 60000;
  const maxRequests = config.maxRequests || 100;
  const keyGenerator = config.keyGenerator || createDefaultKeyGenerator;

  const store = new Map<string, RateLimitEntry>();

  const cleanup = (): void => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  };

  const cleanupTimer = setInterval(cleanup, windowMs);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    entry.count++;
    store.set(key, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetIn.toString());

    if (entry.count > maxRequests) {
      auditLogWithSIEM('RATE_LIMIT_EXCEEDED', {
        key,
        count: entry.count,
        limit: maxRequests,
        windowMs,
        ip: req.ip,
      });

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Fail-Closed: Too many requests. Please slow down.',
          retryAfter: resetIn,
        },
      });
      return;
    }

    next();
  };
};

export interface TenantRateLimitConfig {
  tenantId: string;
  windowMs: number;
  maxRequests: number;
}

const tenantConfigs = new Map<string, TenantRateLimitConfig>();

export const configureTenantRateLimit = (tenantId: string, config: Omit<TenantRateLimitConfig, 'tenantId'>): void => {
  tenantConfigs.set(tenantId, { tenantId, ...config });
};

export const removeTenantRateLimit = (tenantId: string): boolean => {
  return tenantConfigs.delete(tenantId);
};

export const getRateLimitStats = (): {
  global: { entries: number };
  tenants: Array<{ tenantId: string; windowMs: number; maxRequests: number }>;
} => {
  return {
    global: { entries: tenantConfigs.size },
    tenants: Array.from(tenantConfigs.values()).map(t => ({
      tenantId: t.tenantId,
      windowMs: t.windowMs,
      maxRequests: t.maxRequests,
    })),
  };
};
