import { Request, Response, NextFunction } from 'express';
import { EpistemicSecurityException, TrustGateError } from '../errors.js';
import { auditLogWithSIEM } from '../utils/auditLogger.js';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof EpistemicSecurityException) {
    auditLogWithSIEM('HARD_HALT', {
      reason: err.message,
      code: err.code,
      ip: req.ip,
      path: req.path,
    });

    res.status(403).json({
      error: {
        code: err.code,
        message: `Hard Halt Triggered: ${err.message}`,
      },
    });
    return;
  }

  if (err instanceof TrustGateError) {
    auditLogWithSIEM('TRUST_GATE_BLOCK', {
      reason: err.message,
      code: err.code,
      ip: req.ip,
      path: req.path,
      details: err.details,
    });

    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  auditLogWithSIEM('INTERNAL_SERVER_ERROR', {
    reason: err.message,
    ip: req.ip,
    path: req.path,
    stack: err.stack,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred (Fail-Closed).',
    },
  });
};
