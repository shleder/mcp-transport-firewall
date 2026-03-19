import { TargetServerConfig, TargetServerConfigSchema, RouteResult } from './types.js';

const routeRegistry = new Map<string, TargetServerConfig>();

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

export const registerRoute = (toolName: string, config: unknown): void => {
  const parsed = TargetServerConfigSchema.parse(config);
  routeRegistry.set(toolName, parsed);
};

export const removeRoute = (toolName: string): boolean => {
  return routeRegistry.delete(toolName);
};

export const getRegisteredRoutes = (): ReadonlyMap<string, TargetServerConfig> => {
  return routeRegistry;
};

export const clearRoutes = (): void => {
  routeRegistry.clear();
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), target.timeoutMs);

    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(target.headers ?? {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    const body: unknown = await response.json();

    return {
      status: response.status,
      body,
      targetUrl: target.url,
      latencyMs,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;

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
  }
};
