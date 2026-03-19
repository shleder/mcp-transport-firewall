import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const PreflightIdSchema = z.string().uuid();

const preflightRegistry = new Set<string>();
const consumedRegistry = new Set<string>();

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

export const registerPreflight = (id: string): void => {
  const parsed = PreflightIdSchema.parse(id);
  preflightRegistry.add(parsed);
};

export const clearPreflightRegistries = (): void => {
  preflightRegistry.clear();
  consumedRegistry.clear();
};

export const getPreflightStats = (): { pending: number; consumed: number } => {
  return {
    pending: preflightRegistry.size,
    consumed: consumedRegistry.size,
  };
};

interface ToolMeta {
  color?: string;
}

interface ToolEntry {
  name?: string;
  _meta?: ToolMeta;
  preflightId?: string;
}

const extractToolsFromBody = (body: Record<string, unknown>): ToolEntry[] => {
  if (Array.isArray(body.tools)) {
    return body.tools as ToolEntry[];
  }
  if (body.params && typeof body.params === 'object' && !Array.isArray(body.params)) {
    const params = body.params as Record<string, unknown>;
    if (Array.isArray(params.tools)) {
      return params.tools as ToolEntry[];
    }
  }
  return [];
};

export const preflightValidator = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const body = req.body as Record<string, unknown>;
    const tools = extractToolsFromBody(body);

    if (tools.length === 0) {
      next();
      return;
    }

    for (const tool of tools) {
      const color = tool._meta?.color;

      if (color !== 'blue') {
        continue;
      }

      const preflightId = tool.preflightId;

      if (!preflightId || typeof preflightId !== 'string') {
        writeAuditLog('PREFLIGHT_REQUIRED', {
          reason: 'Blue tool invoked without preflightId',
          toolName: tool.name ?? 'unknown',
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: 'PREFLIGHT_REQUIRED',
            message: `Fail-Closed: Blue tool "${tool.name ?? 'unknown'}" requires a valid preflightId.`,
          },
        });
        return;
      }

      if (consumedRegistry.has(preflightId)) {
        writeAuditLog('PREFLIGHT_ALREADY_USED', {
          reason: 'Replay attack: preflightId has already been consumed',
          preflightId,
          toolName: tool.name ?? 'unknown',
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: 'PREFLIGHT_ALREADY_USED',
            message: 'Fail-Closed: this preflightId has already been used. Replay attacks are blocked.',
          },
        });
        return;
      }

      if (!preflightRegistry.has(preflightId)) {
        writeAuditLog('PREFLIGHT_NOT_FOUND', {
          reason: 'preflightId not found in approved registry',
          preflightId,
          toolName: tool.name ?? 'unknown',
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: 'PREFLIGHT_NOT_FOUND',
            message: 'Fail-Closed: preflightId is not registered. Request denied.',
          },
        });
        return;
      }

      preflightRegistry.delete(preflightId);
      consumedRegistry.add(preflightId);
    }

    next();
  } catch (error: unknown) {
    writeAuditLog('PREFLIGHT_VALIDATION_ERROR', {
      reason: error instanceof Error ? error.message : 'Unknown preflight error',
      ip: req.ip,
    });
    res.status(403).json({
      error: {
        code: 'PREFLIGHT_VALIDATION_ERROR',
        message: 'Preflight validation failed. Request denied (Fail-Closed).',
      },
    });
  }
};
