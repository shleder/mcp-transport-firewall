import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const McpColorEnum = z.enum(['red', 'blue', 'green', 'yellow']);

const McpToolSchema = z.object({
  name: z.string().min(1),
  _meta: z.object({
    color: McpColorEnum.optional(),
  }).optional(),
}).strict();

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

const extractTools = (body: Record<string, unknown>): z.infer<typeof McpToolSchema>[] => {
  if (Array.isArray(body.tools)) {
    return z.array(McpToolSchema).parse(body.tools);
  }
  if (body.params && typeof body.params === 'object' && !Array.isArray(body.params)) {
    const params = body.params as Record<string, unknown>;
    if (Array.isArray(params.tools)) {
      return z.array(McpToolSchema).parse(params.tools);
    }
  }
  return [];
};

export const mcpColorBoundary = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const tools = extractTools(req.body as Record<string, unknown>);

    if (tools.length === 0) {
      next();
      return;
    }

    const redTools: string[] = [];
    const blueTools: string[] = [];

    for (const tool of tools) {
      const color = tool._meta?.color;
      if (color === 'red') redTools.push(tool.name);
      if (color === 'blue') blueTools.push(tool.name);
    }

    if (redTools.length > 0 && blueTools.length > 0) {
      const message = `Cross-Tool Hijack Attempt detected. RED tools: [${redTools.join(', ')}], BLUE tools: [${blueTools.join(', ')}]`;

      writeAuditLog('CROSS_TOOL_HIJACK', {
        redTools,
        blueTools,
        ip: req.ip,
      });

      res.status(403).json({
        error: {
          code: 'CROSS_TOOL_HIJACK_ATTEMPT',
          message,
        },
      });
      return;
    }

    next();
  } catch (error: unknown) {
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
