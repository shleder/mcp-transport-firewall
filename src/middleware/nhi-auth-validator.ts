import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TrustGateError } from '../errors.js';
import { writeAuditLog, auditLogWithSIEM } from '../utils/auditLogger.js';
import { extractAuthorizationFromBody } from '../utils/mcp-request.js';

const ServerTokenSchema = z.string()
  .min(32, 'Token must be at least 32 characters (Fail-Closed)')
  .regex(/^[a-zA-Z0-9]+$/, 'Token must be alphanumeric');

const NhiTokenPayloadSchema = z.object({
  token: z.string(),
  scopes: z.array(z.string()).default([]),
}).strict();

export interface ParsedNhiToken {
  token: string;
  scopes: string[];
}

export const parseNhiAuthorizationHeader = (
  authHeader: string | undefined,
  serverToken: string | undefined = process.env.PROXY_AUTH_TOKEN,
  ip = 'unknown'
): ParsedNhiToken => {
  if (!serverToken) {
    auditLogWithSIEM('AUTH_FAILURE', { reason: 'Fail-Closed: PROXY_AUTH_TOKEN not configured', ip });
    throw new TrustGateError('Fail-Closed: Server token is not configured.', 'AUTH_FAILURE', 401);
  }

  if (!ServerTokenSchema.safeParse(serverToken).success) {
    auditLogWithSIEM('AUTH_FAILURE', { reason: 'Fail-Closed: Server token is invalid', ip });
    throw new TrustGateError('Fail-Closed: Server token configuration is invalid.', 'AUTH_FAILURE', 401);
  }

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    auditLogWithSIEM('AUTH_FAILURE', { reason: 'Missing or invalid Authorization header scheme', ip });
    throw new TrustGateError('Valid Bearer authentication is required.', 'AUTH_FAILURE', 401);
  }

  const base64Payload = authHeader.slice(7);

  try {
    const jsonString = Buffer.from(base64Payload, 'base64').toString('utf-8');
    const parsedJson = JSON.parse(jsonString);
    const nhiPayload = NhiTokenPayloadSchema.parse(parsedJson);

    if (nhiPayload.token.length !== serverToken.length || nhiPayload.token !== serverToken) {
      auditLogWithSIEM('AUTH_FAILURE', { reason: 'Token mismatch', ip });
      throw new TrustGateError('Invalid authentication token.', 'AUTH_FAILURE', 401);
    }

    writeAuditLog('AUTH_SUCCESS', { ip, scopes: nhiPayload.scopes });
    return nhiPayload;
  } catch (error: unknown) {
    if (error instanceof TrustGateError) {
      throw error;
    }

    auditLogWithSIEM('AUTH_FAILURE', { reason: 'Invalid NHI Base64 JSON token structure', ip });
    throw new TrustGateError(
      'Fail-Closed: Client NHI token structure is invalid or decoding failed.',
      'AUTH_FAILURE',
      401
    );
  }
};

export const extractNhiAuthorization = (reqBody: Record<string, unknown>): string | undefined => {
  return extractAuthorizationFromBody(reqBody);
};

export const nhiAuthValidator = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  delete req.headers.authorization;

  try {
    const nhiPayload = parseNhiAuthorizationHeader(authHeader, process.env.PROXY_AUTH_TOKEN, req.ip);
    req.nhiScopes = nhiPayload.scopes;
    next();
  } catch (error: unknown) {
    if (error instanceof TrustGateError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    auditLogWithSIEM('AUTH_FAILURE', { reason: 'Unexpected NHI validation error', ip: req.ip });
    res.status(401).json({ error: { code: 'AUTH_FAILURE', message: 'Authentication validation failed.' } });
  }
};
