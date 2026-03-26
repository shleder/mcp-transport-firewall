import express from 'express';
import path from 'node:path';
import { startAdminServer } from './admin/index.js';
import { getCache, initializeCache } from './cache/index.js';
import { mcpToolSchemas } from './mcp-tool-schemas.js';
import { astEgressFilter } from './middleware/ast-egress-filter.js';
import { mcpColorBoundary } from './middleware/color-boundary.js';
import { errorHandler } from './middleware/error-handler.js';
import { nhiAuthValidator } from './middleware/nhi-auth-validator.js';
import { preflightValidator } from './middleware/preflight-validator.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { createSchemaValidator } from './middleware/schema-validator.js';
import { scopeValidator } from './middleware/scope-validator.js';
import { routeRequest } from './proxy/router.js';
import { sanitizeResponse } from './proxy/shadow-leak-sanitizer.js';
import { auditLog } from './utils/auditLogger.js';
import { extractToolInvocations } from './utils/mcp-request.js';

const DEFAULT_PORT = parseInt(process.env.PORT ?? process.env.MCP_PORT ?? '3000', 10);
const DEFAULT_ADMIN_PORT = parseInt(process.env.MCP_ADMIN_PORT ?? '9090', 10);
const DEFAULT_CACHE_TTL = parseInt(process.env.MCP_CACHE_TTL_SECONDS ?? '300', 10) * 1000;
const DEFAULT_CACHE_DIR = process.env.MCP_CACHE_DIR ?? path.join(process.cwd(), '.mcp-cache');

const app = express();

app.use(express.json({
  strict: true,
  limit: '1mb',
}));

const rateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

app.use('/mcp', rateLimiter);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'mcp-proxy',
    timestamp: new Date().toISOString(),
    adminEnabled: process.env.MCP_ADMIN_ENABLED === 'true',
  });
});

const progressiveDisclosureValidator = createSchemaValidator(mcpToolSchemas);

app.post(
  '/mcp',
  nhiAuthValidator,
  scopeValidator,
  mcpColorBoundary,
  astEgressFilter,
  preflightValidator,
  progressiveDisclosureValidator,
  async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const tool = extractToolInvocations(body)[0];

      if (!tool?.name) {
        res.status(400).json({
          error: {
            code: 'INVALID_MCP_REQUEST',
            message: 'Fail-Closed: a single MCP tool call is required.',
          },
        });
        return;
      }

      const toolArgs = tool.arguments ?? {};
      const cache = getCache();
      const cachedResponse = cache?.get(tool.name, toolArgs);
      if (cachedResponse !== undefined) {
        res.setHeader('X-Proxy-Cache', 'HIT');
        res.status(200).json(cachedResponse);
        return;
      }

      const result = await routeRequest(tool.name, body);
      const sanitizedBody = sanitizeResponse(result.body);

      if (result.status >= 200 && result.status < 300) {
        cache?.set(tool.name, toolArgs, sanitizedBody);
      }

      res.setHeader('X-Proxy-Cache', 'MISS');
      if (result.targetUrl) {
        res.setHeader('X-Proxy-Target', result.targetUrl);
      }
      res.setHeader('X-Proxy-Latency-Ms', result.latencyMs.toString());
      res.status(result.status).json(sanitizedBody);
    } catch (error: unknown) {
      next(error);
    }
  }
);

app.get('/sse', nhiAuthValidator, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);

  const intervalId = setInterval(() => {
    res.write(':\n\n');
  }, 15000);
  intervalId.unref?.();

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  initializeCache({
    serverId: process.env.MCP_SERVER_ID ?? 'default',
    l1: {
      maxSize: 1000,
      ttlMs: DEFAULT_CACHE_TTL,
    },
    l2: {
      dbPath: DEFAULT_CACHE_DIR,
      ttlMs: DEFAULT_CACHE_TTL,
    },
    alwaysCacheTools: ['read_file', 'list_directory', 'search_files'],
    neverCacheTools: ['write_file', 'create_file', 'execute_command'],
  });

  const adminPort = process.env.MCP_ADMIN_ENABLED === 'true' ? DEFAULT_ADMIN_PORT : 0;
  if (adminPort > 0) {
    startAdminServer(adminPort);
  }

  app.listen(DEFAULT_PORT, () => {
    auditLog('MCP_PROXY_STARTED', {
      port: DEFAULT_PORT,
      adminPort,
      cacheEnabled: true,
      cacheDir: DEFAULT_CACHE_DIR,
    });
    console.log(`MCP Proxy Core listening on port ${DEFAULT_PORT} (Protected Mode with NHI & ETT)`);
    if (adminPort > 0) {
      console.log(`Admin API listening on port ${adminPort}`);
    }
  });
}
