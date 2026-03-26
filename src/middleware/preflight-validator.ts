import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TrustGateError } from '../errors.js';
import { auditLogWithSIEM } from '../utils/auditLogger.js';
import { extractToolInvocations } from '../utils/mcp-request.js';

const PreflightIdSchema = z.string().uuid();

const preflightRegistry = new Map<string, number>();
const consumedRegistry = new Map<string, number>();
const CONSUMED_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const cleanupExpired = (): void => {
  const now = Date.now();
  for (const [id, expiry] of consumedRegistry) {
    if (now > expiry) {
      consumedRegistry.delete(id);
    }
  }
  for (const [id, expiry] of preflightRegistry) {
    if (now > expiry) {
      preflightRegistry.delete(id);
    }
  }
};

const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

export const registerPreflight = (id: string, ttlMs = CONSUMED_TTL_MS): void => {
  const parsed = PreflightIdSchema.parse(id);
  preflightRegistry.set(parsed, Date.now() + ttlMs);
};

export const clearPreflightRegistries = (): void => {
  preflightRegistry.clear();
  consumedRegistry.clear();
};

export const getPreflightStats = (): { pending: number; consumed: number } => {
  cleanupExpired();
  return {
    pending: preflightRegistry.size,
    consumed: consumedRegistry.size,
  };
};

export const validatePreflight = (body: Record<string, unknown>, ip = 'unknown'): void => {
  const tools = extractToolInvocations(body);

  for (const tool of tools) {
    const color = tool._meta?.color;

    if (color !== 'blue') {
      continue;
    }

    const preflightId = tool.preflightId;

    if (!preflightId || typeof preflightId !== 'string') {
      auditLogWithSIEM('PREFLIGHT_REQUIRED', {
        reason: 'Blue tool invoked without preflightId',
        toolName: tool.name ?? 'unknown',
        ip,
      });
      throw new TrustGateError(
        `Fail-Closed: Blue tool "${tool.name ?? 'unknown'}" requires a valid preflightId.`,
        'PREFLIGHT_REQUIRED',
        403
      );
    }

    if (consumedRegistry.has(preflightId)) {
      auditLogWithSIEM('PREFLIGHT_REPLAY_BLOCKED', {
        reason: 'Replay attack: preflightId has already been consumed',
        preflightId,
        toolName: tool.name ?? 'unknown',
        ip,
      });
      throw new TrustGateError(
        'Fail-Closed: this preflightId has already been used. Replay attacks are blocked.',
        'PREFLIGHT_ALREADY_USED',
        403
      );
    }

    const expiry = preflightRegistry.get(preflightId);
    if (!expiry || Date.now() > expiry) {
      auditLogWithSIEM('PREFLIGHT_NOT_FOUND', {
        reason: 'preflightId not found or expired',
        preflightId,
        toolName: tool.name ?? 'unknown',
        ip,
      });
      throw new TrustGateError(
        'Fail-Closed: preflightId is not registered or has expired. Request denied.',
        'PREFLIGHT_NOT_FOUND',
        403
      );
    }

    preflightRegistry.delete(preflightId);
    consumedRegistry.set(preflightId, Date.now() + CONSUMED_TTL_MS);
  }
};

export const preflightValidator = (req: Request, res: Response, next: NextFunction): void => {
  try {
    validatePreflight(req.body as Record<string, unknown>, req.ip);
    next();
  } catch (error: unknown) {
    if (error instanceof TrustGateError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    auditLogWithSIEM('PREFLIGHT_VALIDATION_ERROR', {
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
