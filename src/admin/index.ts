import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getCache, initializeCache } from '../cache/index.js';
import { clearColorSessions } from '../middleware/color-boundary.js';
import { clearPreflightRegistries, getPreflightStats, registerPreflight } from '../middleware/preflight-validator.js';
import { configureTenantRateLimit, getRateLimitStats, removeTenantRateLimit } from '../middleware/rate-limiter.js';
import { getAllCircuitBreakerStats, getOrCreateCircuitBreaker } from '../proxy/circuit-breaker.js';
import { clearRoutes, getRegisteredRoutes, registerRoute, removeRoute } from '../proxy/router.js';
import { auditLog, configureSIEM, getBlockedRequestMetrics, getSIEMConfig } from '../utils/auditLogger.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const adminUiPath = path.resolve(currentDirPath, '../../ui/dist');

const AdminAuthSchema = z.object({
  token: z.string().min(32),
});

const TenantRateLimitSchema = z.object({
  tenantId: z.string().min(1),
  windowMs: z.number().int().min(1000).max(3600000).default(60000),
  maxRequests: z.number().int().min(1).max(10000).default(100),
});

const SIEMConfigSchema = z.object({
  enabled: z.boolean(),
  format: z.enum(['CEF', 'SYSLOG']).default('SYSLOG'),
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(514),
});

const PreflightSchema = z.object({
  id: z.string().uuid(),
  ttlMs: z.number().int().min(1000).max(3600000).optional(),
});

const CacheConfigSchema = z.object({
  serverId: z.string().default('default'),
  l1: z.object({
    maxSize: z.number().int().min(1).max(100000).optional(),
    ttlMs: z.number().int().min(1000).max(3600000).optional(),
  }).optional(),
  l2: z.object({
    dbPath: z.string().optional(),
    ttlMs: z.number().int().min(1000).max(3600000).optional(),
  }).optional(),
  alwaysCacheTools: z.array(z.string()).optional(),
  neverCacheTools: z.array(z.string()).optional(),
});

const RouteConfigSchema = z.object({
  toolName: z.string().min(1),
  url: z.string().url(),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  headers: z.record(z.string()).optional(),
});

const CircuitBreakerConfigSchema = z.object({
  name: z.string().min(1),
  failureThreshold: z.number().int().min(1).max(100).default(5),
  resetTimeoutMs: z.number().int().min(1000).max(60000).default(30000),
  halfOpenMaxCalls: z.number().int().min(1).max(10).default(3),
});

const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    auditLog('ADMIN_NOT_CONFIGURED', {
      reason: 'Admin API not configured. Set ADMIN_TOKEN.',
      path: req.originalUrl,
      ip: req.ip,
    });
    res.status(503).json({ error: { code: 'ADMIN_NOT_CONFIGURED', message: 'Admin API not configured. Set ADMIN_TOKEN.' } });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    auditLog('UNAUTHORIZED', {
      reason: 'Bearer token required.',
      path: req.originalUrl,
      ip: req.ip,
    });
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required.' } });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const parsed = AdminAuthSchema.parse({ token });
    if (parsed.token !== adminToken) {
      auditLog('UNAUTHORIZED', {
        reason: 'Invalid admin token.',
        path: req.originalUrl,
        ip: req.ip,
      });
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid admin token.' } });
      return;
    }

    next();
  } catch {
    auditLog('UNAUTHORIZED', {
      reason: 'Invalid admin token format.',
      path: req.originalUrl,
      ip: req.ip,
    });
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid admin token format.' } });
  }
};

const adminCorsMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigin = process.env.MCP_ADMIN_CORS_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  next();
};

const createAdminRouter = (): express.Router => {
  const router = express.Router();

  router.options('*', (_req: Request, res: Response) => {
    res.status(204).end();
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  router.get('/routes', (_req: Request, res: Response) => {
    const routes = getRegisteredRoutes();
    res.json({
      routes: Array.from(routes.entries()).map(([name, config]) => ({ name, ...config })),
      total: routes.size,
    });
  });

  router.post('/routes', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const parsed = RouteConfigSchema.parse(req.body);
      registerRoute(parsed.toolName, {
        url: parsed.url,
        timeoutMs: parsed.timeoutMs,
        headers: parsed.headers,
      });
      auditLog('ADMIN_ROUTE_REGISTERED', { toolName: parsed.toolName, url: parsed.url });
      res.json({ success: true, toolName: parsed.toolName });
    } catch (error) {
      res.status(400).json({ error: { code: 'INVALID_CONFIG', message: error instanceof Error ? error.message : 'Invalid route config' } });
    }
  });

  router.delete('/routes/:toolName', adminAuthMiddleware, (req: Request, res: Response) => {
    const toolName = String(req.params.toolName);
    const removed = removeRoute(toolName);
    auditLog('ADMIN_ROUTE_REMOVED', { toolName, removed });
    res.json({ success: removed, toolName });
  });

  router.delete('/routes', adminAuthMiddleware, (_req: Request, res: Response) => {
    clearRoutes();
    clearColorSessions();
    auditLog('ADMIN_ROUTES_CLEARED', {});
    res.json({ success: true });
  });

  router.get('/cache/stats', (_req: Request, res: Response) => {
    const cache = getCache();
    if (!cache) {
      res.json({ cache: null, message: 'Cache not initialized' });
      return;
    }

    res.json({ cache: cache.getStats() });
  });

  router.post('/cache', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const parsed = CacheConfigSchema.parse(req.body);
      initializeCache(parsed);
      auditLog('ADMIN_CACHE_INITIALIZED', { config: parsed });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: { code: 'INVALID_CONFIG', message: error instanceof Error ? error.message : 'Invalid cache config' } });
    }
  });

  router.delete('/cache', adminAuthMiddleware, (_req: Request, res: Response) => {
    const cache = getCache();
    cache?.clear();
    auditLog('ADMIN_CACHE_CLEARED', {});
    res.json({ success: true });
  });

  router.get('/preflight/stats', (_req: Request, res: Response) => {
    res.json({ preflight: getPreflightStats() });
  });

  router.post('/preflight', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const parsed = PreflightSchema.parse(req.body);
      registerPreflight(parsed.id, parsed.ttlMs);
      auditLog('ADMIN_PREFLIGHT_REGISTERED', { id: parsed.id, ttlMs: parsed.ttlMs });
      res.json({ success: true, id: parsed.id });
    } catch (error) {
      res.status(400).json({ error: { code: 'INVALID_CONFIG', message: error instanceof Error ? error.message : 'Invalid preflight config' } });
    }
  });

  router.delete('/preflight', adminAuthMiddleware, (_req: Request, res: Response) => {
    clearPreflightRegistries();
    auditLog('ADMIN_PREFLIGHT_CLEARED', {});
    res.json({ success: true });
  });

  router.get('/rate-limit/stats', (_req: Request, res: Response) => {
    res.json({ rateLimit: getRateLimitStats() });
  });

  router.post('/rate-limit/tenant', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const parsed = TenantRateLimitSchema.parse(req.body);
      configureTenantRateLimit(parsed.tenantId, {
        windowMs: parsed.windowMs,
        maxRequests: parsed.maxRequests,
      });
      auditLog('ADMIN_TENANT_RATE_LIMIT_CONFIGURED', { tenantId: parsed.tenantId });
      res.json({ success: true, tenantId: parsed.tenantId });
    } catch (error) {
      res.status(400).json({ error: { code: 'INVALID_CONFIG', message: error instanceof Error ? error.message : 'Invalid config' } });
    }
  });

  router.delete('/rate-limit/tenant/:tenantId', adminAuthMiddleware, (req: Request, res: Response) => {
    const tenantId = String(req.params.tenantId);
    const removed = removeTenantRateLimit(tenantId);
    res.json({ success: removed, tenantId });
  });

  router.get('/circuit-breakers', (_req: Request, res: Response) => {
    res.json({ circuitBreakers: getAllCircuitBreakerStats() });
  });

  router.post('/circuit-breakers', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const parsed = CircuitBreakerConfigSchema.parse(req.body);
      getOrCreateCircuitBreaker(parsed);
      auditLog('ADMIN_CIRCUIT_BREAKER_CREATED', { name: parsed.name });
      res.json({ success: true, name: parsed.name });
    } catch (error) {
      res.status(400).json({ error: { code: 'INVALID_CONFIG', message: error instanceof Error ? error.message : 'Invalid config' } });
    }
  });

  router.get('/siem/config', adminAuthMiddleware, (_req: Request, res: Response) => {
    res.json(getSIEMConfig());
  });

  router.post('/siem/config', adminAuthMiddleware, (req: Request, res: Response) => {
    try {
      const parsed = SIEMConfigSchema.parse(req.body);
      configureSIEM(parsed);
      auditLog('ADMIN_SIEM_CONFIGURED', { config: parsed });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: { code: 'INVALID_CONFIG', message: error instanceof Error ? error.message : 'Invalid SIEM config' } });
    }
  });

  router.get('/stats', (_req: Request, res: Response) => {
    const cache = getCache();
    res.json({
      routes: getRegisteredRoutes().size,
      cache: cache?.getStats() ?? null,
      circuitBreakers: getAllCircuitBreakerStats(),
      preflight: getPreflightStats(),
      rateLimit: getRateLimitStats(),
      blockedRequests: getBlockedRequestMetrics(),
    });
  });

  router.get('/blocked-requests/stats', (_req: Request, res: Response) => {
    res.json({ blockedRequests: getBlockedRequestMetrics() });
  });

  return router;
};

let adminServer: Server | null = null;

export const startAdminServer = (port: number = 9090): Server => {
  if (adminServer) {
    return adminServer;
  }

  const app = express();
  app.use(adminCorsMiddleware);
  app.use(express.json());
  app.use(createAdminRouter());

  if (fs.existsSync(adminUiPath)) {
    app.use(express.static(adminUiPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(adminUiPath, 'index.html'));
    });
  }

  adminServer = app.listen(port, () => {
    auditLog('ADMIN_SERVER_STARTED', { port });
    console.log(`Admin API listening on port ${port}`);
  });

  return adminServer;
};

export const stopAdminServer = (): Promise<void> => {
  return new Promise((resolve) => {
    if (adminServer) {
      adminServer.close(() => {
        adminServer = null;
        auditLog('ADMIN_SERVER_STOPPED', {});
        resolve();
      });
    } else {
      resolve();
    }
  });
};

export { createAdminRouter };
