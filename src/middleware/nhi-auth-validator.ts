import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const ServerTokenSchema = z.string()
  .min(32, 'Token must be at least 32 characters (Fail-Closed)')
  .regex(/^[a-zA-Z0-9]+$/, 'Token must be alphanumeric');

const NhiTokenPayloadSchema = z.object({
  token: z.string(),
  scopes: z.array(z.string()).default([]),
}).strict();

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

export const nhiAuthValidator = (req: Request, res: Response, next: NextFunction): void => {
  const serverToken = process.env.PROXY_AUTH_TOKEN;

  if (!serverToken) {
    writeAuditLog('AUTH_FAILURE', { reason: 'Fail-Closed: PROXY_AUTH_TOKEN not configured', ip: req.ip });
    res.status(401).json({ error: { code: 'AUTH_FAILURE', message: 'Fail-Closed: Server token is not configured.' } });
    return;
  }

  if (!ServerTokenSchema.safeParse(serverToken).success) {
    writeAuditLog('AUTH_FAILURE', { reason: 'Fail-Closed: Server token is invalid', ip: req.ip });
    res.status(401).json({ error: { code: 'AUTH_FAILURE', message: 'Fail-Closed: Server token configuration is invalid.' } });
    return;
  }

  const authHeader = req.headers['authorization'];
  
  // ZERO TOKEN PASSTHROUGH: Destroy the authorization header immediately so it cannot reach downstream targets
  delete req.headers['authorization'];

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    writeAuditLog('AUTH_FAILURE', { reason: 'Missing or invalid Authorization header scheme', ip: req.ip });
    res.status(401).json({ error: { code: 'AUTH_FAILURE', message: 'Valid Bearer authentication is required.' } });
    return;
  }

  const base64Payload = authHeader.slice(7);

  try {
    const jsonString = Buffer.from(base64Payload, 'base64').toString('utf-8');
    const parsedJson = JSON.parse(jsonString);
    const nhiPayload = NhiTokenPayloadSchema.parse(parsedJson);

    if (nhiPayload.token.length !== serverToken.length || nhiPayload.token !== serverToken) {
      writeAuditLog('AUTH_FAILURE', { reason: 'Token mismatch', ip: req.ip });
      res.status(401).json({ error: { code: 'AUTH_FAILURE', message: 'Invalid authentication token.' } });
      return;
    }

    req.nhiScopes = nhiPayload.scopes;
    next();
  } catch (error: unknown) {
    writeAuditLog('AUTH_FAILURE', { reason: 'Invalid NHI Base64 JSON token structure', ip: req.ip });
    res.status(401).json({ error: { code: 'AUTH_FAILURE', message: 'Fail-Closed: Client NHI token structure is invalid or decoding failed.' } });
  }
};
