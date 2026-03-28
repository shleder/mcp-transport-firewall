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
import { recordStdioMcpRequest } from '../metrics/prometheus.js';
import { extractNhiAuthorization, parseNhiAuthorizationHeader } from '../middleware/nhi-auth-validator.js';
import { validatePreflight } from '../middleware/preflight-validator.js';
import { validateSchema } from '../middleware/schema-validator.js';
import { validateScopes } from '../middleware/scope-validator.js';
import { mcpToolSchemas } from '../mcp-tool-schemas.js';
import { auditLog } from '../utils/auditLogger.js';
import { getPrimaryToolInvocation, isRecord } from '../utils/mcp-request.js';

const OOM_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TARGET_TIMEOUT_MS = 30000;
const TARGET_UNAVAILABLE_CODE = -32004;
const TARGET_INVALID_JSON_CODE = -32006;
const TARGET_TIMEOUT_CODE = -32007;

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
  id: JsonRpcId;
  toolName?: string;
  cacheParams?: unknown;
  timeout: NodeJS.Timeout;
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
  targetTimeoutMs?: number;
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

export interface StdioFirewallProxy {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export const createStdioFirewallProxy = (options: StdioFirewallOptions): StdioFirewallProxy => {
  const input: Readable = options.input ?? process.stdin;
  const output: Writable = options.output ?? process.stdout;
  const errorOutput: Writable = options.errorOutput ?? process.stderr;

  const pendingRequests = new Map<string, PendingRequest>();
  const targetTimeoutMs = options.targetTimeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS;

  const serverId = options.serverId ?? `${options.targetCommand} ${options.targetArgs.join(' ')}`.trim();
  const cacheManager = initializeCache({
    serverId,
    l1: {
      maxSize: 1000,
      ttlMs: (options.cacheTtlSeconds ?? 300) * 1000,
    },
    l2: {
      dbPath: options.cacheDir ?? path.join(process.cwd(), '.mcp-cache'),
      ttlMs: (options.cacheTtlSeconds ?? 300) * 1000,
    },
    alwaysCacheTools: options.alwaysCacheTools ?? ['read_file', 'read', 'open_file', 'list_directory', 'list_files', 'search_files', 'search'],
    neverCacheTools: options.neverCacheTools ?? ['write_file', 'write', 'create_file', 'execute_command', 'execute'],
  });

  let clientInterface: readline.Interface | null = null;
  let targetInterface: readline.Interface | null = null;
  let targetProcess: ChildProcessWithoutNullStreams | null = null;
  let clientInputClosed = false;
  let stopped = false;
  let processingCount = 0;

  const writeRawJson = (message: unknown): void => {
    output.write(JSON.stringify(message) + '\n');
  };

  const writeRpc = (message: JsonRpcResponse): void => {
    writeRawJson(message);
  };

  const buildTargetUnavailableResponse = (id: JsonRpcId, data?: unknown): JsonRpcResponse => {
    return buildRpcErrorResponse(
      id,
      TARGET_UNAVAILABLE_CODE,
      'Fail-Closed: target process is unavailable.',
      { code: 'TARGET_UNAVAILABLE', ...(isRecord(data) ? data : {}) },
    );
  };

  const clearPendingRequest = (requestId: string): PendingRequest | undefined => {
    const pending = pendingRequests.get(requestId);
    if (!pending) {
      return undefined;
    }

    clearTimeout(pending.timeout);
    pendingRequests.delete(requestId);
    return pending;
  };

  const failPendingRequests = (code: number, message: string, data?: unknown): void => {
    for (const requestId of [...pendingRequests.keys()]) {
      const pending = clearPendingRequest(requestId);
      if (!pending) {
        continue;
      }

      writeRpc(buildRpcErrorResponse(pending.id, code, message, data));
    }
  };

  const terminateTarget = (): void => {
    targetInterface?.close();
    targetInterface = null;

    if (targetProcess && !targetProcess.killed) {
      targetProcess.kill('SIGTERM');
    }
  };

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;

    failPendingRequests(
      TARGET_UNAVAILABLE_CODE,
      'Fail-Closed: target process is unavailable.',
      { code: 'TARGET_UNAVAILABLE' },
    );

    clientInterface?.close();
    terminateTarget();

    cacheManager.close();
    await stopAdminServer();
  };

  const inspectRequest = async (message: JsonRpcRequest): Promise<void> => {
    if (message.method !== 'tools/call') {
      return;
    }

    const body = message as unknown as Record<string, unknown>;

    if (options.proxyAuthToken) {
      const authHeader = extractNhiAuthorization(body);
      const parsed = parseNhiAuthorizationHeader(authHeader, options.proxyAuthToken, 'stdio');
      validateScopes(body, parsed.scopes, 'stdio');
    }

    validateColorBoundary(body, 'stdio', 'stdio');
    await validateAstEgress(body, 'stdio', 'stdio');
    validatePreflight(body, 'stdio');
    validateSchema(body, mcpToolSchemas, 'stdio', 'stdio');
  };

  const handleClientLine = async (line: string): Promise<void> => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      writeRpc(buildRpcErrorResponse(null, -32700, 'Parse error'));
      return;
    }

    if (!isJsonRpcRequest(message)) {
      writeRpc(buildRpcErrorResponse(null, -32600, 'Invalid Request'));
      return;
    }

    recordStdioMcpRequest();

    const requestId = message.id ?? null;

    if (stopped || !targetProcess?.stdin.writable) {
      writeRpc(buildTargetUnavailableResponse(requestId));
      return;
    }

    processingCount++;

    try {
      await inspectRequest(message);

      if (stopped) {
        writeRpc(buildTargetUnavailableResponse(requestId));
        return;
      }

      const tool = getPrimaryToolInvocation(message as unknown as Record<string, unknown>);
      if (message.method === 'tools/call' && tool?.name && requestId !== null) {
        const cached = cacheManager.get(tool.name, tool.arguments ?? {});
        if (cached !== undefined) {
          writeRpc({
            jsonrpc: '2.0',
            id: requestId,
            result: cached,
          });
          return;
        }
      }

      if (stopped || !targetProcess?.stdin.writable) {
        writeRpc(buildTargetUnavailableResponse(requestId));
        return;
      }

      if (requestId !== null) {
        const pendingTimeout = setTimeout(() => {
          const pending = clearPendingRequest(String(requestId));
          if (!pending) {
            return;
          }

          writeRpc(buildRpcErrorResponse(
            pending.id,
            TARGET_TIMEOUT_CODE,
            'Fail-Closed: target response timed out.',
            { code: 'TARGET_RESPONSE_TIMEOUT', timeoutMs: targetTimeoutMs },
          ));
        }, targetTimeoutMs);
        pendingTimeout.unref?.();

        pendingRequests.set(String(requestId), {
          id: requestId,
          toolName: tool?.name,
          cacheParams: tool?.arguments ?? message.params,
          timeout: pendingTimeout,
        });
      }

      try {
        targetProcess.stdin.write(JSON.stringify(message) + '\n');
      } catch (error: unknown) {
        if (requestId !== null) {
          clearPendingRequest(String(requestId));
        }
        const reason = error instanceof Error ? error.message : 'write failed';
        writeRpc(buildTargetUnavailableResponse(requestId, { reason }));
      }
    } catch (error: unknown) {
      if (requestId !== null) {
        writeRpc(toRpcError(requestId, error));
      }
    } finally {
      processingCount--;
      if (clientInputClosed && processingCount === 0 && pendingRequests.size === 0) {
        void stop();
      }
    }
  };

  const checkOomLimit = (id: JsonRpcId, payload: unknown): boolean => {
    const jsonStr = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(jsonStr, 'utf8');

    if (byteLength > OOM_MAX_RESPONSE_BYTES) {
      auditLog('OOM_PROTECTION_TRIGGERED', { id, byteLength, limit: OOM_MAX_RESPONSE_BYTES });
      writeRpc(buildRpcErrorResponse(id, -32005, 'Fail-Closed: Response exceeds strict OOM size limit.', {
        byteLength,
        limit: OOM_MAX_RESPONSE_BYTES,
      }));
      return false;
    }
    return true;
  };

  const handleTargetLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      errorOutput.write(`[proxy] invalid target JSON: ${trimmed}\n`);
      failPendingRequests(
        TARGET_INVALID_JSON_CODE,
        'Fail-Closed: downstream target emitted invalid JSON.',
        { code: 'TARGET_INVALID_JSON' },
      );
      terminateTarget();
      return;
    }

    if (!isJsonRpcResponse(message)) {
      const sanitized = sanitizeResponse(message);
      if (checkOomLimit(null, sanitized)) {
        writeRawJson(sanitized);
      }
      return;
    }

    const pending = clearPendingRequest(String(message.id));
    if (!pending) {
      if (options.verbose) {
        errorOutput.write(`[proxy] dropping unmatched target response for id=${String(message.id)}\n`);
      }
      return;
    }

    if (Object.prototype.hasOwnProperty.call(message, 'result')) {
      const sanitizedResult = sanitizeResponse(message.result);

      if (!checkOomLimit(message.id, sanitizedResult)) {
        if (clientInputClosed && processingCount === 0 && pendingRequests.size === 0) {
          void stop();
        }
        return;
      }

      if (pending?.toolName) {
        cacheManager.set(pending.toolName, pending.cacheParams ?? {}, sanitizedResult);
      }

      writeRpc({
        jsonrpc: '2.0',
        id: message.id,
        result: sanitizedResult,
      });

      if (clientInputClosed && processingCount === 0 && pendingRequests.size === 0) {
        void stop();
      }
      return;
    }

    const sanitizedError = sanitizeResponse(message.error);
    writeRpc({
      jsonrpc: '2.0',
      id: message.id,
      error: sanitizedError as JsonRpcResponse['error'],
    });

    if (clientInputClosed && processingCount === 0 && pendingRequests.size === 0) {
      void stop();
    }
  };

  const spawnTarget = (): void => {
    targetProcess = spawn(options.targetCommand, options.targetArgs, {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    targetInterface = readline.createInterface({
      input: targetProcess.stdout,
      crlfDelay: Infinity,
    });

    targetInterface.on('line', (line) => {
      handleTargetLine(line);
    });

    targetProcess.stderr.on('data', (chunk) => {
      if (options.verbose) {
        errorOutput.write(chunk);
      }
    });

    targetProcess.on('error', (error) => {
      auditLog('TARGET_PROCESS_ERROR', {
        message: error.message,
        command: options.targetCommand,
      });
      failPendingRequests(TARGET_UNAVAILABLE_CODE, 'Fail-Closed: target process is unavailable.', {
        code: 'TARGET_UNAVAILABLE',
        reason: error.message,
      });
      targetProcess = null;
      targetInterface?.close();
      targetInterface = null;
    });

    targetProcess.on('close', (code) => {
      auditLog('TARGET_PROCESS_EXITED', { code });
      failPendingRequests(TARGET_UNAVAILABLE_CODE, 'Fail-Closed: target process is unavailable.', {
        code: 'TARGET_UNAVAILABLE',
        exitCode: code,
      });
      targetProcess = null;
      targetInterface = null;

      if (clientInputClosed) {
        void stop();
      }
    });
  };

  return {
    start: async (): Promise<void> => {
      spawnTarget();

      if (options.adminEnabled) {
        startAdminServer(options.adminPort ?? 9090);
      }

      clientInterface = readline.createInterface({
        input: input,
        crlfDelay: Infinity,
      });

      clientInterface.on('line', (line) => {
        void handleClientLine(line);
      });

      clientInterface.on('close', () => {
        clientInputClosed = true;

        if (targetProcess?.stdin.writable) {
          targetProcess.stdin.end();
        }

        if (processingCount === 0 && pendingRequests.size === 0) {
          void stop();
        }
      });
    },

    stop,
  };
};
