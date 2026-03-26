import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TrustGateError } from '../errors.js';
import { auditLogWithSIEM } from '../utils/auditLogger.js';
import { extractToolInvocations } from '../utils/mcp-request.js';

export type ToolSchemaRegistry = Record<string, z.ZodTypeAny>;

export const validateSchema = (
  body: Record<string, unknown>,
  registry: ToolSchemaRegistry,
  ip = 'unknown',
  requestPath = '/mcp'
): void => {
  const tools = extractToolInvocations(body);

  if (body.method !== 'tools/call' || tools.length === 0) {
    return;
  }

  try {
    for (const tool of tools) {
      const toolName = tool.name;
      const toolArgs = tool.arguments ?? {};

      if (!toolName) {
        continue;
      }

      const schema = registry[toolName];
      if (schema) {
        schema.parse(toolArgs);
      }
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const message = `Progressive Disclosure Violation: Tool arguments failed strict schema validation. ${error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`;

      auditLogWithSIEM('SCHEMA_VALIDATION_FAILED', {
        reason: message,
        ip,
        path: requestPath,
      });

      throw new TrustGateError(
        'Fail-Closed: Payload arguments rejected due to strict schema mismatch or prompt injection. Access Denied.',
        'SCHEMA_VALIDATION_FAILED',
        403
      );
    }

    auditLogWithSIEM('INTERNAL_SERVER_ERROR', {
      reason: 'Unexpected error during schema validation',
      ip,
    });

    throw new TrustGateError(
      'An unexpected error occurred during Progressive Disclosure validation.',
      'INTERNAL_SERVER_ERROR',
      500
    );
  }
};

export const createSchemaValidator = (registry: ToolSchemaRegistry) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      validateSchema(req.body as Record<string, unknown>, registry, req.ip, req.path);
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

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred during Progressive Disclosure validation.',
        },
      });
    }
  };
};
