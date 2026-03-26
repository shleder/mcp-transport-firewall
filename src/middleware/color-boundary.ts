import { Request, Response, NextFunction } from 'express';
import { TrustGateError } from '../errors.js';
import { extractToolInvocations } from '../utils/mcp-request.js';

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

const colorSessions = new Map<string, 'red' | 'blue'>();

export const clearColorSessions = (): void => {
  colorSessions.clear();
};

export const validateColorBoundary = (
  body: Record<string, unknown>,
  sessionKey: string,
  ip = 'unknown'
): void => {
  const tools = extractToolInvocations(body);
  const redTools: string[] = [];
  const blueTools: string[] = [];

  for (const tool of tools) {
    const color = tool._meta?.color;
    if (color === 'red') redTools.push(tool.name ?? 'unknown');
    if (color === 'blue') blueTools.push(tool.name ?? 'unknown');
  }

  if (redTools.length > 0 && blueTools.length > 0) {
    writeAuditLog('CROSS_TOOL_HIJACK', {
      redTools,
      blueTools,
      ip,
    });

    throw new TrustGateError(
      `Cross-Tool Hijack Attempt detected. RED tools: [${redTools.join(', ')}], BLUE tools: [${blueTools.join(', ')}]`,
      'CROSS_TOOL_HIJACK_ATTEMPT',
      403,
      { redTools, blueTools }
    );
  }

  const establishedColor = colorSessions.get(sessionKey);
  const hasRed = redTools.length > 0;
  const hasBlue = blueTools.length > 0;

  if (hasRed && establishedColor === 'blue') {
    writeAuditLog('CROSS_TOOL_HIJACK_SESSION', { redTools, establishedColor, ip });
    throw new TrustGateError(
      `Cross-Tool Hijack Attempt detected (Session limits to BLUE). Attempted RED tools: [${redTools.join(', ')}]`,
      'CROSS_TOOL_HIJACK_ATTEMPT',
      403,
      { redTools, establishedColor }
    );
  }

  if (hasBlue && establishedColor === 'red') {
    writeAuditLog('CROSS_TOOL_HIJACK_SESSION', { blueTools, establishedColor, ip });
    throw new TrustGateError(
      `Cross-Tool Hijack Attempt detected (Session limits to RED). Attempted BLUE tools: [${blueTools.join(', ')}]`,
      'CROSS_TOOL_HIJACK_ATTEMPT',
      403,
      { blueTools, establishedColor }
    );
  }

  if (hasRed && !establishedColor) colorSessions.set(sessionKey, 'red');
  if (hasBlue && !establishedColor) colorSessions.set(sessionKey, 'blue');
};

export const mcpColorBoundary = (req: Request, res: Response, next: NextFunction): void => {
  try {
    validateColorBoundary(req.body as Record<string, unknown>, req.ip || 'unknown', req.ip);
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

    writeAuditLog('SCHEMA_VALIDATION_FAILURE', {
      reason: error instanceof Error ? error.message : 'Unknown validation error',
      ip: req.ip,
    });

    res.status(403).json({
      error: {
        code: 'SECURITY_VIOLATION',
        message: 'Request payload failed schema validation',
      },
    });
  }
};
