import { Request, Response, NextFunction } from 'express';

const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /\.env\b/i,
  /\.aws\/credentials/i,
  /id_rsa/i,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /known_hosts/i,
  /\.ssh\//i,
  /\.git\/config/i,
  /\.npmrc/i,
  /\.docker\/config/i,
];

const SHELL_INJECTION_PATTERNS: RegExp[] = [
  /\$\(.*\)/,
  /`[^`]+`/,
  /;\s*(rm|cat|ls|curl|wget|chmod|chown|mv|cp|dd|mkfs)\b/,
  /\|\s*(cat|grep|awk|sed|tee|nc|bash|sh|zsh)\b/,
  />\s*\/dev\//,
  /&&\s*(rm|curl|wget|bash|sh)\b/,
];

const SINGLE_CHAR_QUERY_THRESHOLD = 3;

const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
  process.stderr.write(`[AUDIT] ${entry}\n`);
};

const extractAllStringValues = (obj: unknown, results: string[] = []): string[] => {
  if (typeof obj === 'string') {
    results.push(obj);
    return results;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractAllStringValues(item, results);
    }
    return results;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      extractAllStringValues(value, results);
    }
  }
  return results;
};

const detectShadowLeak = (value: string): boolean => {
  try {
    const url = new URL(value);
    const params = url.searchParams;
    let singleCharCount = 0;

    for (const [, paramValue] of params) {
      if (paramValue.length === 1) {
        singleCharCount++;
      }
    }

    return singleCharCount >= SINGLE_CHAR_QUERY_THRESHOLD;
  } catch {
    return false;
  }
};

const detectSensitivePath = (value: string): string | null => {
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(value)) {
      return pattern.source;
    }
  }
  return null;
};

const detectShellInjection = (value: string): string | null => {
  for (const pattern of SHELL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return pattern.source;
    }
  }
  return null;
};

export const astEgressFilter = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const body = req.body as Record<string, unknown>;
    const allValues = extractAllStringValues(body);

    if (allValues.length === 0) {
      next();
      return;
    }

    for (const value of allValues) {
      if (detectShadowLeak(value)) {
        writeAuditLog('SHADOWLEAK_DETECTED', {
          reason: 'Single-char query parameter exfiltration pattern detected',
          suspiciousValue: value.slice(0, 200),
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: 'SHADOWLEAK_DETECTED',
            message: 'Egress violation: character-by-character exfiltration pattern detected in URL parameters.',
          },
        });
        return;
      }

      const sensitiveMatch = detectSensitivePath(value);
      if (sensitiveMatch !== null) {
        writeAuditLog('SENSITIVE_PATH_BLOCKED', {
          reason: 'Attempt to access sensitive system file',
          matchedPattern: sensitiveMatch,
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: 'SENSITIVE_PATH_BLOCKED',
            message: 'Egress violation: access to sensitive system paths is forbidden.',
          },
        });
        return;
      }

      const shellMatch = detectShellInjection(value);
      if (shellMatch !== null) {
        writeAuditLog('SHELL_INJECTION_BLOCKED', {
          reason: 'Shell metacharacters or command pattern detected',
          matchedPattern: shellMatch,
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: 'SHELL_INJECTION_BLOCKED',
            message: 'Egress violation: shell injection pattern detected in arguments.',
          },
        });
        return;
      }
    }

    next();
  } catch (error: unknown) {
    writeAuditLog('EGRESS_FILTER_ERROR', {
      reason: error instanceof Error ? error.message : 'Unknown egress filter error',
      ip: req.ip,
    });
    res.status(403).json({
      error: {
        code: 'EGRESS_VIOLATION',
        message: 'Egress filter encountered an error. Request denied (Fail-Closed).',
      },
    });
  }
};
