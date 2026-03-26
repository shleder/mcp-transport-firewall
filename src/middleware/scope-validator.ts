import { Request, Response, NextFunction } from 'express';
import { TrustGateError } from '../errors.js';
import { auditLogWithSIEM } from '../utils/auditLogger.js';
import { extractToolInvocations } from '../utils/mcp-request.js';

export const validateScopes = (
  body: Record<string, unknown>,
  availableScopes: string[],
  ip = 'unknown'
): void => {
  const tools = extractToolInvocations(body);

  for (const tool of tools) {
    const toolName = tool.name;
    if (!toolName) continue;

    const requiredScope = `tools.${toolName}`;

    if (!availableScopes.includes(requiredScope) && !availableScopes.includes('tools.*')) {
      auditLogWithSIEM('MISSING_SCOPE', {
        reason: 'Agent attempted to call a tool without the required NHI scope',
        toolName,
        requiredScope,
        availableScopes,
        ip,
      });

      throw new TrustGateError(
        `Fail-Closed: NHI token lacks the required scope '${requiredScope}' for tool '${toolName}'.`,
        'MISSING_SCOPE',
        403,
        { toolName, requiredScope }
      );
    }
  }
};

export const scopeValidator = (req: Request, res: Response, next: NextFunction): void => {
  try {
    validateScopes(req.body as Record<string, unknown>, req.nhiScopes ?? [], req.ip);
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

    res.status(403).json({
      error: {
        code: 'MISSING_SCOPE',
        message: 'Fail-Closed: scope validation failed.',
      },
    });
  }
};
