import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { Readable, Writable } from 'node:stream';
import { CacheManager, initializeCache } from '../cache/index.js';
import { stopAdminServer, startAdminServer } from '../admin/index.js';
import { CircuitOpenError } from '../proxy/circuit-breaker.js';
import { sanitizeResponse } from '../proxy/shadow-leak-sanitizer.js';
import { EpistemicSecurityException, TrustGateError } from '../errors.js';
import { validateAstEgress } from '../middleware/ast-egress-filter.js';
import { validateColorBoundary } from '../middleware/color-boundary.js';
import { extractNhiAuthorization, parseNhiAuthorizationHeader } from '../middleware/nhi-auth-validator.js';
import { validatePreflight } from '../middleware/preflight-validator.js';
import { validateSchema } from '../middleware/schema-validator.js';
import { validateScopes } from '../middleware/scope-validator.js';
import { mcpToolSchemas } from '../mcp-tool-schemas.js';
import { auditLog } from '../utils/auditLogger.js';
import { extractToolInvocations, isRecord } from '../utils/mcp-request.js';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface PendingRequest {
  toolName?: string;
  cacheParams?: unknown;
}

export interface StdioFirewallOptions {
  targetCommand: string;
  targetArgs: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: Readable;
  output?: Writable;
  errorOutput?: Writable;
  serverId?: string;
  cacheDir?: string;
  cacheTtlSeconds?: number;
  alwaysCacheTools?: string[];
  neverCacheTools?: string[];
  adminEnabled?: boolean;
  adminPort?: number;
  verbose?: boolean;
  proxyAuthToken?: string;
}

const isJsonRpcRequest = (value: unknown): value is JsonRpcRequest => {
  if (!isRecord(value)) {
    return false;
  }

  return value.jsonrpc === '2.0' && typeof value.method === 'string';
};

const isJsonRpcResponse = (value: unknown): value is JsonRpcResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return value.jsonrpc === '2.0' && Object.prototype.hasOwnProperty.call(value, 'id') &&
    (Object.prototype.hasOwnProperty.call(value, 'result') || Object.prototype.hasOwnProperty.call(value, 'error'));
};

const buildRpcErrorResponse = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse => {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
};

const toRpcError = (id: JsonRpcId, error: unknown): JsonRpcResponse => {
  if (error instanceof TrustGateError) {
    return buildRpcErrorResponse(id, -32001, error.message, { code: error.code, details: error.details });
  }

  if (error instanceof EpistemicSecurityException) {
    return buildRpcErrorResponse(id, -32002, error.message, { code: error.code });
  }

  if (error instanceof CircuitOpenError) {
    return buildRpcErrorResponse(id, -32003, error.message, { code: 'CIRCUIT_OPEN' });
  }

  const message = error instanceof Error ? error.message : 'Internal proxy error';
  return buildRpcErrorResponse(id, -32603, message);
};

export class StdioFirewallProxy {
  private readonly input: Readable;
  private readonly output: Writable;
  private readonly errorOutput: Writable;
  private readonly options: StdioFirewallOptions;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private cacheManager: CacheManager;
  private clientInterface: readline.Interface | null = null;
  private targetInterface: readline.Interface | null = null;
  private targetProcess: ChildProcessWithoutNullStreams | null = null;
  private stopped = false;

  constructor(options: StdioFirewallOptions) {
    this.options = options;
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.errorOutput = options.errorOutput ?? process.stderr;

    const serverId = options.serverId ?? `${options.targetCommand} ${options.targetArgs.join(' ')}`.trim();
    this.cacheManager = initializeCache({
      serverId,
      l1: {
        maxSize: 1000,
        ttlMs: (options.cacheTtlSeconds ?? 300) * 1000,
      },
      l2: {
        dbPath: options.cacheDir ?? path.join(process.cwd(), '.mcp-cache'),
        ttlMs: (options.cacheTtlSeconds ?? 300) * 1000,
      },
      alwaysCacheTools: options.alwaysCacheTools ?? ['read_file', 'list_directory', 'search_files'],
      neverCacheTools: options.neverCacheTools ?? ['write_file', 'create_file', 'execute_command'],
    });
  }

  async start(): Promise<void> {
    this.spawnTarget();

    if (this.options.adminEnabled) {
      startAdminServer(this.options.adminPort ?? 9090);
    }

    this.clientInterface = readline.createInterface({
      input: this.input,
      crlfDelay: Infinity,
    });

    this.clientInterface.on('line', (line) => {
      void this.handleClientLine(line);
    });

    this.clientInterface.on('close', () => {
      void this.stop();
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    this.clientInterface?.close();
    this.targetInterface?.close();

    if (this.targetProcess && !this.targetProcess.killed) {
      this.targetProcess.kill('SIGTERM');
    }

    this.pendingRequests.clear();
    this.cacheManager.close();
    await stopAdminServer();
  }

  private spawnTarget(): void {
    this.targetProcess = spawn(this.options.targetCommand, this.options.targetArgs, {
      cwd: this.options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...this.options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.targetInterface = readline.createInterface({
      input: this.targetProcess.stdout,
      crlfDelay: Infinity,
    });

    this.targetInterface.on('line', (line) => {
      this.handleTargetLine(line);
    });

    this.targetProcess.stderr.on('data', (chunk) => {
      if (this.options.verbose) {
        this.errorOutput.write(chunk);
      }
    });

    this.targetProcess.on('close', (code) => {
      auditLog('TARGET_PROCESS_EXITED', { code });
      for (const [requestId] of this.pendingRequests) {
        this.writeRpc(buildRpcErrorResponse(requestId, -32004, 'Fail-Closed: target process is unavailable.'));
      }
      this.pendingRequests.clear();
      this.targetProcess = null;
    });
  }

  private async handleClientLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      this.writeRpc(buildRpcErrorResponse(null, -32700, 'Parse error'));
      return;
    }

    if (!isJsonRpcRequest(message)) {
      this.writeRpc(buildRpcErrorResponse(null, -32600, 'Invalid Request'));
      return;
    }

    const requestId = message.id ?? null;

    if (!this.targetProcess?.stdin.writable) {
      this.writeRpc(buildRpcErrorResponse(requestId, -32004, 'Fail-Closed: target process is unavailable.'));
      return;
    }

    try {
      await this.inspectRequest(message);

      const tool = extractToolInvocations(message as unknown as Record<string, unknown>)[0];
      if (message.method === 'tools/call' && tool?.name && requestId !== null) {
        const cached = this.cacheManager.get(tool.name, tool.arguments ?? {});
        if (cached !== undefined) {
          this.writeRpc({
            jsonrpc: '2.0',
            id: requestId,
            result: cached,
          });
          return;
        }
      }

      if (requestId !== null) {
        const tool = extractToolInvocations(message as unknown as Record<string, unknown>)[0];
        this.pendingRequests.set(String(requestId), {
          toolName: tool?.name,
          cacheParams: tool?.arguments ?? message.params,
        });
      }

      this.targetProcess.stdin.write(JSON.stringify(message) + '\n');
    } catch (error: unknown) {
      if (requestId !== null) {
        this.writeRpc(toRpcError(requestId, error));
      }
    }
  }

  private async inspectRequest(message: JsonRpcRequest): Promise<void> {
    if (message.method !== 'tools/call') {
      return;
    }

    const body = message as unknown as Record<string, unknown>;

    if (this.options.proxyAuthToken) {
      const authHeader = extractNhiAuthorization(body);
      const parsed = parseNhiAuthorizationHeader(authHeader, this.options.proxyAuthToken, 'stdio');
      validateScopes(body, parsed.scopes, 'stdio');
    }

    validateColorBoundary(body, 'stdio', 'stdio');
    await validateAstEgress(body, 'stdio', 'stdio');
    validatePreflight(body, 'stdio');
    validateSchema(body, mcpToolSchemas, 'stdio', 'stdio');
  }

  private handleTargetLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      this.errorOutput.write(`[proxy] invalid target JSON: ${trimmed}\n`);
      return;
    }

    if (!isJsonRpcResponse(message)) {
      this.writeRawJson(sanitizeResponse(message));
      return;
    }

    const pending = this.pendingRequests.get(String(message.id));
    if (pending) {
      this.pendingRequests.delete(String(message.id));
    }

    if (Object.prototype.hasOwnProperty.call(message, 'result')) {
      const sanitizedResult = sanitizeResponse(message.result);
      if (pending?.toolName) {
        this.cacheManager.set(pending.toolName, pending.cacheParams ?? {}, sanitizedResult);
      }

      this.writeRpc({
        jsonrpc: '2.0',
        id: message.id,
        result: sanitizedResult,
      });
      return;
    }

    const sanitizedError = sanitizeResponse(message.error);
    this.writeRpc({
      jsonrpc: '2.0',
      id: message.id,
      error: sanitizedError as JsonRpcResponse['error'],
    });
  }

  private writeRpc(message: JsonRpcResponse): void {
    this.writeRawJson(message);
  }

  private writeRawJson(message: unknown): void {
    this.output.write(JSON.stringify(message) + '\n');
  }
}
