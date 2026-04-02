import fs from 'node:fs';
import path from 'node:path';
import { CircuitOpenError, getOrCreateCircuitBreaker } from './circuit-breaker.js';
import { RouteRegistryStateSchema, RouteResult, TargetServerConfig, TargetServerConfigSchema } from './types.js';

const ROUTE_REGISTRY_STATE_FILENAME = 'route-registry.json';

let routeRegistry = new Map<string, TargetServerConfig>();
let routeRegistryStateFile: string | null = null;

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

const persistRouteRegistry = (nextRegistry: ReadonlyMap<string, TargetServerConfig>): void => {
  if (!routeRegistryStateFile) {
    return;
  }

  const stateDir = path.dirname(routeRegistryStateFile);
  fs.mkdirSync(stateDir, { recursive: true });

  const state = {
    version: 1 as const,
    routes: Object.fromEntries(
      [...nextRegistry.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
  const tempFile = `${routeRegistryStateFile}.tmp`;

  fs.writeFileSync(tempFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(tempFile, routeRegistryStateFile);
};

const loadRouteRegistryFromDisk = (): void => {
  if (!routeRegistryStateFile || !fs.existsSync(routeRegistryStateFile)) {
    routeRegistry = new Map<string, TargetServerConfig>();
    return;
  }

  try {
    const rawState = fs.readFileSync(routeRegistryStateFile, 'utf8');
    const parsedState = RouteRegistryStateSchema.parse(JSON.parse(rawState));
    routeRegistry = new Map<string, TargetServerConfig>(Object.entries(parsedState.routes));
  } catch (error: unknown) {
    routeRegistry = new Map<string, TargetServerConfig>();
    writeAuditLog('ROUTE_REGISTRY_RESTORE_FAILED', {
      reason: error instanceof Error ? error.message : 'Unknown route registry persistence error',
      path: routeRegistryStateFile,
    });
  }
};

const commitRouteRegistry = (nextRegistry: Map<string, TargetServerConfig>): void => {
  persistRouteRegistry(nextRegistry);
  routeRegistry = nextRegistry;
};

export const configureRouteRegistryPersistence = (stateDir: string): void => {
  routeRegistryStateFile = path.join(stateDir, ROUTE_REGISTRY_STATE_FILENAME);
  loadRouteRegistryFromDisk();
};

export const disableRouteRegistryPersistence = (): void => {
  routeRegistryStateFile = null;
};

export const reloadRouteRegistryFromDisk = (): void => {
  loadRouteRegistryFromDisk();
};

export const registerRoute = (toolName: string, config: unknown): void => {
  const parsed = TargetServerConfigSchema.parse(config);
  const nextRegistry = new Map(routeRegistry);
  nextRegistry.set(toolName, parsed);
  commitRouteRegistry(nextRegistry);
};

export const removeRoute = (toolName: string): boolean => {
  if (!routeRegistry.has(toolName)) {
    return false;
  }

  const nextRegistry = new Map(routeRegistry);
  const removed = nextRegistry.delete(toolName);
  commitRouteRegistry(nextRegistry);
  return removed;
};

export const getRegisteredRoutes = (): ReadonlyMap<string, TargetServerConfig> => {
  return routeRegistry;
};

export const clearRoutes = (): void => {
  commitRouteRegistry(new Map<string, TargetServerConfig>());
};

export const routeRequest = async (
  toolName: string,
  payload: unknown
): Promise<RouteResult> => {
  const target = routeRegistry.get(toolName);

  if (!target) {
    writeAuditLog('UNKNOWN_ROUTE', {
      reason: 'Fail-Closed: no registered route for tool',
      toolName,
    });
    return {
      status: 403,
      body: {
        error: {
          code: 'UNKNOWN_ROUTE',
          message: `Fail-Closed: tool "${toolName}" has no registered target server.`,
        },
      },
      targetUrl: '',
      latencyMs: 0,
    };
  }

  const startTime = Date.now();
  const circuitBreaker = getOrCreateCircuitBreaker({
    name: `route:${toolName}`,
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 1,
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await circuitBreaker.execute(async () => {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), target.timeoutMs);
      timeoutId.unref?.();

      const response = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(target.headers ?? {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      let body: unknown = rawBody;

      if (rawBody.length > 0) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      }

      return { response, body };
    });

    return {
      status: result.response.status,
      body: result.body,
      targetUrl: target.url,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof CircuitOpenError) {
      writeAuditLog('CIRCUIT_OPEN', {
        reason: error.message,
        toolName,
        targetUrl: target.url,
      });

      return {
        status: 503,
        body: {
          error: {
            code: 'CIRCUIT_OPEN',
            message: error.message,
          },
        },
        targetUrl: target.url,
        latencyMs,
      };
    }

    writeAuditLog('TARGET_UNREACHABLE', {
      reason: error instanceof Error ? error.message : 'Unknown routing error',
      toolName,
      targetUrl: target.url,
    });

    return {
      status: 503,
      body: {
        error: {
          code: 'TARGET_UNREACHABLE',
          message: `Target server for tool "${toolName}" is unreachable.`,
        },
      },
      targetUrl: target.url,
      latencyMs,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};
