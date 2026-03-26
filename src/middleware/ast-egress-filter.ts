import { Request, Response, NextFunction } from 'express';
import { EpistemicSecurityException } from '../errors.js';
import { auditLogWithSIEM } from '../utils/auditLogger.js';
import { getOrCreateCircuitBreaker, CircuitOpenError } from '../proxy/circuit-breaker.js';

const ettCircuitBreaker = getOrCreateCircuitBreaker({
  name: 'ETT_Breaker',
  failureThreshold: 3,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 1,
});

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

const EPISTEMIC_CONTRADICTION_PATTERNS: RegExp[] = [
  /\b(uncertain|hallucinat|contradict|ignore previous|not sure)\b/i,
];

const SINGLE_CHAR_QUERY_THRESHOLD = 3;

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

const detectEpistemicContradiction = (value: string): string | null => {
  for (const pattern of EPISTEMIC_CONTRADICTION_PATTERNS) {
    if (pattern.test(value)) {
      return pattern.source;
    }
  }
  return null;
};

export const validateAstEgress = async (
  body: Record<string, unknown>,
  ip = 'unknown',
  requestPath = '/mcp'
): Promise<void> => {
  await ettCircuitBreaker.execute(async () => {
    const allValues = extractAllStringValues(body);

    if (allValues.length === 0) {
      return;
    }

    for (const value of allValues) {
      if (detectShadowLeak(value)) {
        const ex = new EpistemicSecurityException(
          'Egress violation: character-by-character exfiltration pattern detected in URL parameters.',
          'SHADOWLEAK_DETECTED'
        );
        auditLogWithSIEM('FIREWALL_BLOCK', {
          reason: ex.message,
          code: ex.code,
          ip,
          path: requestPath,
        });
        throw ex;
      }

      const sensitiveMatch = detectSensitivePath(value);
      if (sensitiveMatch !== null) {
        const ex = new EpistemicSecurityException(
          `Egress violation: access to sensitive system paths is forbidden. Pattern matched: ${sensitiveMatch}`,
          'SENSITIVE_PATH_BLOCKED'
        );
        auditLogWithSIEM('FIREWALL_BLOCK', {
          reason: ex.message,
          code: ex.code,
          ip,
          path: requestPath,
        });
        throw ex;
      }

      const shellMatch = detectShellInjection(value);
      if (shellMatch !== null) {
        const ex = new EpistemicSecurityException(
          `Egress violation: shell injection pattern detected. Pattern matched: ${shellMatch}`,
          'SHELL_INJECTION_BLOCKED'
        );
        auditLogWithSIEM('FIREWALL_BLOCK', {
          reason: ex.message,
          code: ex.code,
          ip,
          path: requestPath,
        });
        throw ex;
      }

      const epistemicMatch = detectEpistemicContradiction(value);
      if (epistemicMatch !== null) {
        const ex = new EpistemicSecurityException(
          `Epistemic Termination Trigger (ETT): agent semantics indicate uncertainty or hallucination. Pattern matched: ${epistemicMatch}`,
          'EPISTEMIC_CONTRADICTION_DETECTED'
        );
        auditLogWithSIEM('ETT_TRIGGER', {
          reason: ex.message,
          code: ex.code,
          ip,
          path: requestPath,
        });
        throw ex;
      }
    }
  });
};

export const astEgressFilter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await validateAstEgress(req.body as Record<string, unknown>, req.ip, req.path);
    next();
  } catch (error: unknown) {
    if (error instanceof CircuitOpenError) {
      auditLogWithSIEM('ETT_CIRCUIT_OPEN', {
        reason: error.message,
        ip: req.ip,
      });
      res.status(403).json({
        error: {
          code: 'ETT_CIRCUIT_OPEN',
          message: error.message,
        },
      });
      return;
    }
    if (error instanceof EpistemicSecurityException) {
      next(error);
      return;
    }
    const ex = new EpistemicSecurityException(
      'Egress filter encountered an unexpected error. Request denied (Fail-Closed).',
      'EGRESS_VIOLATION'
    );
    auditLogWithSIEM('EGRESS_FILTER_ERROR', {
      reason: ex.message,
      code: ex.code,
      ip: req.ip,
      path: req.path,
    });
    next(ex);
  }
};
