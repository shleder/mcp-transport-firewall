import { CircuitOpenError, getOrCreateCircuitBreaker } from './circuit-breaker.js';
import { RouteResult, TargetServerConfig, TargetServerConfigSchema } from './types.js';

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
