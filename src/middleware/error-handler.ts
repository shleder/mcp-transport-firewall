import { Request, Response, NextFunction } from 'express';
import { EpistemicSecurityException } from '../errors.js';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof EpistemicSecurityException) {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'HARD_HALT',
      reason: err.message,
      code: err.code,
      ip: req.ip,
    });
    process.stderr.write(`[AUDIT] ${entry}\n`);

    res.status(403).json({
      error: {
        code: err.code,
        message: `Hard Halt Triggered: ${err.message}`,
      },
    });
    return;
  }

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'INTERNAL_SERVER_ERROR',
    reason: err.message,
    ip: req.ip,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred (Fail-Closed).',
    },
  });
};
