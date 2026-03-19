import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const BearerTokenSchema = z.string()
  .min(32, 'Token must be at least 32 characters (Fail-Closed)')
  .regex(/^[a-zA-Z0-9]+$/, 'Token must be alphanumeric');

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

export const authValidator = (req: Request, res: Response, next: NextFunction): void => {
  const serverToken = process.env.PROXY_AUTH_TOKEN;

  if (!serverToken) {
    writeAuditLog('AUTH_FAILURE', {
      reason: 'Fail-Closed: PROXY_AUTH_TOKEN not configured on server',
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_FAILURE',
        message: 'Fail-Closed: Server authentication token is not configured. All requests are denied.',
      },
    });
    return;
  }

  const serverTokenResult = BearerTokenSchema.safeParse(serverToken);
  if (!serverTokenResult.success) {
    writeAuditLog('AUTH_FAILURE', {
      reason: 'Fail-Closed: Server PROXY_AUTH_TOKEN fails validation',
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_FAILURE',
        message: 'Fail-Closed: Server token configuration is invalid.',
      },
    });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    writeAuditLog('AUTH_FAILURE', {
      reason: 'Missing Authorization header',
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_FAILURE',
        message: 'Authorization header is required.',
      },
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    writeAuditLog('AUTH_FAILURE', {
      reason: 'Invalid auth scheme (expected Bearer)',
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_FAILURE',
        message: 'Only Bearer authentication scheme is accepted.',
      },
    });
    return;
  }

  const clientToken = authHeader.slice(7);

  const clientTokenResult = BearerTokenSchema.safeParse(clientToken);
  if (!clientTokenResult.success) {
    writeAuditLog('AUTH_FAILURE', {
      reason: 'Client token fails Zod schema validation',
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_FAILURE',
        message: 'Fail-Closed: Client token does not meet minimum requirements.',
      },
    });
    return;
  }

  if (clientToken.length !== serverToken.length || clientToken !== serverToken) {
    writeAuditLog('AUTH_FAILURE', {
      reason: 'Token mismatch',
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_FAILURE',
        message: 'Invalid authentication token.',
      },
    });
    return;
  }

  next();
};
