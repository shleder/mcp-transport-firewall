import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';

const currentFilePath = fileURLToPath(import.meta.url);
const testsDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(testsDirPath, '..');
const proxyToken = '12345678901234567890123456789012';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCliPath = process.platform === 'win32'
  ? path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
  : null;

const createNhiAuthorization = (scopes: string[]): string => {
  const payload = JSON.stringify({
    token: proxyToken,
    scopes,
  });

  return `Bearer ${Buffer.from(payload, 'utf8').toString('base64')}`;
};

const waitForJsonLine = async (stream: Readable): Promise<Record<string, unknown>> => {
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
      buffer = buffer.slice(newlineIndex + 1);
      cleanup();
      resolve(JSON.parse(line) as Record<string, unknown>);
    };

    stream.on('data', onData);
    stream.on('error', onError);
  });
};

const waitForNoJsonLine = async (stream: Readable, timeoutMs: number): Promise<void> => {
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

const waitForExit = async (child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<number | null> => {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;

    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
      }
      child.off('exit', onExit);
      child.off('error', onError);
    };

    const onExit = (code: number | null): void => {
      cleanup();
      resolve(code);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Packaged proxy did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('exit', onExit);
    child.on('error', onError);
  });
};

describe('packaged proxy smoke', () => {
  let tarballPath = '';
  let extraDirs: string[] = [];

  beforeAll(() => {
    const packOutput = execSync(`${npmCommand} pack --json`, {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const parsedPackOutput = JSON.parse(packOutput);
    const tarballName = parsedPackOutput?.[0]?.filename;

    if (typeof tarballName !== 'string' || tarballName.length === 0) {
      throw new Error('npm pack --json did not return a tarball filename');
    }

    tarballPath = path.join(repoRoot, tarballName);
  });

  afterEach(() => {
    for (const directory of extraDirs) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    extraDirs = [];
  });

  afterAll(() => {
    if (tarballPath) {
      fs.rmSync(tarballPath, { force: true });
    }
  });

  it('serves packaged proxy-mode requests with cache, auth, and clean shutdown guarantees', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-package-proxy-cache-'));
    extraDirs.push(cacheDir);

    const packagedProxy = spawn(
      process.platform === 'win32' ? process.execPath : 'npx',
      process.platform === 'win32'
        ? [npxCliPath as string, '--yes', `--package=${tarballPath}`, 'mcp-transport-firewall']
        : ['--yes', `--package=${tarballPath}`, 'mcp-transport-firewall'],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PROXY_AUTH_TOKEN: proxyToken,
          MCP_TARGET_COMMAND: process.execPath,
          MCP_TARGET_ARGS_JSON: JSON.stringify([path.join(repoRoot, 'tests', 'fixtures', 'stdio-target.js')]),
          MCP_ADMIN_ENABLED: 'false',
          MCP_CACHE_DIR: cacheDir,
        },
        stdio: 'pipe',
      },
    );

    const searchRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          query: 'package-smoke',
        },
        _meta: {
          authorization: createNhiAuthorization(['tools.search_files']),
        },
      },
    };

    packagedProxy.stdin.write(JSON.stringify(searchRequest) + '\n');
    const firstResponse = await waitForJsonLine(packagedProxy.stdout);

    packagedProxy.stdin.write(JSON.stringify(searchRequest) + '\n');
    const secondResponse = await waitForJsonLine(packagedProxy.stdout);

    packagedProxy.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          query: 'missing-auth',
        },
      },
    }) + '\n');
    const authFailureResponse = await waitForJsonLine(packagedProxy.stdout);

    expect(firstResponse.result).toEqual({
      callCount: 1,
      tool: 'search_files',
      arguments: { query: 'package-smoke' },
    });
    expect(secondResponse.result).toEqual(firstResponse.result);
    expect((authFailureResponse.error as { data?: { code?: string } }).data?.code).toBe('AUTH_FAILURE');

    packagedProxy.stdin.end();

    await waitForNoJsonLine(packagedProxy.stdout, 250);

    const naturalExitCode = await waitForExit(packagedProxy, 1500).catch(() => packagedProxy.exitCode);
    if (naturalExitCode === null && packagedProxy.exitCode === null) {
      packagedProxy.kill();
      await waitForExit(packagedProxy, 10000);
      return;
    }

    expect(naturalExitCode).toBe(0);
  }, 120000);
});
