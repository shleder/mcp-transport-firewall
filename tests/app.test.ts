import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { initializeCache, getCache } from '../src/cache/index.js';
import { clearColorSessions } from '../src/middleware/color-boundary.js';
import { clearPreflightRegistries } from '../src/middleware/preflight-validator.js';
import {
  clearRoutes,
  configureRouteRegistryPersistence,
  disableRouteRegistryPersistence,
  registerRoute,
} from '../src/proxy/router.js';

const serverToken = '12345678901234567890123456789012';

const createAuthHeader = (scopes: string[]): string => {
  return `Bearer ${Buffer.from(JSON.stringify({ token: serverToken, scopes })).toString('base64')}`;
};

describe('app /mcp integration', () => {
  let app: typeof import('../src/index.js').default;
  let targetServer: http.Server;
  let targetBaseUrl = '';
  let requestCount = 0;
  let cacheDir = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PROXY_AUTH_TOKEN = serverToken;
    const module = await import('../src/index.js');
    app = module.default;
  });

  beforeEach(async () => {
    disableRouteRegistryPersistence();
    clearRoutes();
    clearPreflightRegistries();
    clearColorSessions();
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cache-test-'));
    initializeCache({
      serverId: 'test',
      l1: { maxSize: 100, ttlMs: 60000 },
      l2: { dbPath: cacheDir, ttlMs: 60000 },
      alwaysCacheTools: ['search_files'],
      neverCacheTools: [],
    });
    configureRouteRegistryPersistence(cacheDir);

    requestCount = 0;
    targetServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        requestCount += 1;
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

    await new Promise<void>(resolve => {
      targetServer.listen(0, '127.0.0.1', () => {
        const address = targetServer.address();
        if (address && typeof address !== 'string') {
          targetBaseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    disableRouteRegistryPersistence();
    clearRoutes();
    clearPreflightRegistries();
    clearColorSessions();

    await new Promise<void>(resolve => {
      if (targetServer?.listening) {
        targetServer.close(() => resolve());
      } else {
        resolve();
      }
    });

    if (cacheDir) {
      getCache()?.close();
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.PROXY_AUTH_TOKEN;
  });

  it('routes a single tool call to the registered target', async () => {
    registerRoute('search_files', {
      url: `${targetBaseUrl}/tools/search_files`,
      timeoutMs: 1000,
    });

    const response = await request(app)
      .post('/mcp')
      .set('Authorization', createAuthHeader(['tools.search_files']))
      .send({
        method: 'tools/call',
        params: {
          name: 'search_files',
          arguments: { query: 'hello' },
        },
      });

    expect(response.status).toBe(200);
    expect(response.headers['x-proxy-cache']).toBe('MISS');
    expect(response.body).toEqual({
      ok: true,
      tool: 'search_files',
      arguments: { query: 'hello' },
    });
    expect(requestCount).toBe(1);
  });

  it('restores the secondary route registry after a restart-style reload', async () => {
    registerRoute('search_files', {
      url: `${targetBaseUrl}/tools/search_files`,
      timeoutMs: 1000,
    });

    disableRouteRegistryPersistence();
    clearRoutes();
    clearPreflightRegistries();
    clearColorSessions();
    configureRouteRegistryPersistence(cacheDir);

    const response = await request(app)
      .post('/mcp')
      .set('Authorization', createAuthHeader(['tools.search_files']))
      .send({
        method: 'tools/call',
        params: {
          name: 'search_files',
          arguments: { query: 'after-restart' },
        },
      });

    expect(response.status).toBe(200);
    expect(response.headers['x-proxy-cache']).toBe('MISS');
    expect(response.body).toEqual({
      ok: true,
      tool: 'search_files',
      arguments: { query: 'after-restart' },
    });
    expect(requestCount).toBe(1);
  });

  it('serves repeat cacheable requests from cache after the first hit', async () => {
    registerRoute('search_files', {
      url: `${targetBaseUrl}/tools/search_files`,
      timeoutMs: 1000,
    });

    const payload = {
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'cached' },
      },
    };

    const authHeader = createAuthHeader(['tools.search_files']);

    const firstResponse = await request(app)
      .post('/mcp')
      .set('Authorization', authHeader)
      .send(payload);

    const secondResponse = await request(app)
      .post('/mcp')
      .set('Authorization', authHeader)
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers['x-proxy-cache']).toBe('MISS');
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers['x-proxy-cache']).toBe('HIT');
    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(requestCount).toBe(1);
  });

  it('fails closed when the tool has no registered target route', async () => {
    const response = await request(app)
      .post('/mcp')
      .set('Authorization', createAuthHeader(['tools.search_files']))
      .send({
        method: 'tools/call',
        params: {
          name: 'search_files',
          arguments: { query: 'hello' },
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('UNKNOWN_ROUTE');
  });

  it('routes a common alias contract through the HTTP compatibility harness', async () => {
    registerRoute('list_files', {
      url: `${targetBaseUrl}/tools/list_files`,
      timeoutMs: 1000,
    });

    const payload = {
      method: 'tools/call',
      params: {
        name: 'list_files',
        arguments: { path: '/tmp', recursive: true },
      },
    };

    const authHeader = createAuthHeader(['tools.list_files']);

    const firstResponse = await request(app)
      .post('/mcp')
      .set('Authorization', authHeader)
      .send(payload);

    const secondResponse = await request(app)
      .post('/mcp')
      .set('Authorization', authHeader)
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers['x-proxy-cache']).toBe('MISS');
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers['x-proxy-cache']).toBe('HIT');
    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(firstResponse.body).toEqual({
      ok: true,
      tool: 'list_files',
      arguments: { path: '/tmp', recursive: true },
    });
    expect(requestCount).toBe(1);
  });
});
