import { Request, Response, NextFunction } from 'express';
import { auditLog } from '../utils/auditLogger.js';
import { McpRequestSchema } from '../types/index.js';

export const mcpColorBoundary = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Validate request body
    const parsed = McpRequestSchema.parse(req.body);
    
    if (parsed.tools && parsed.tools.length > 0) {
      let hasRed = false;
      let hasBlue = false;
      
      for (const tool of parsed.tools) {
        if (tool._meta?.color === 'red') hasRed = true;
        if (tool._meta?.color === 'blue') hasBlue = true;
      }
      
      if (hasRed && hasBlue) {
         throw new Error("CrossToolHijackAttempt");
      }
    }
    
    next();
  } catch (error: unknown) {
    auditLog("SECURITY_VIOLATION", {
      reason: error instanceof Error ? error.message : "Invalid payload schema",
      ip: req.ip,
      path: req.path
    });
    
    // Fail-Closed, Hard Halt
    res.status(403).json({
      error: "Forbidden",
      code: "SECURITY_VIOLATION"
    });
  }
};
