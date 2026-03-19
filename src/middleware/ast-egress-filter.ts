import { Request, Response, NextFunction } from 'express';
import { EpistemicSecurityException } from '../errors.js';

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
        throw new EpistemicSecurityException(
          'Egress violation: character-by-character exfiltration pattern detected in URL parameters.',
          'SHADOWLEAK_DETECTED'
        );
      }

      const sensitiveMatch = detectSensitivePath(value);
      if (sensitiveMatch !== null) {
        throw new EpistemicSecurityException(
          `Egress violation: access to sensitive system paths is forbidden. Pattern matched: ${sensitiveMatch}`,
          'SENSITIVE_PATH_BLOCKED'
        );
      }

      const shellMatch = detectShellInjection(value);
      if (shellMatch !== null) {
        throw new EpistemicSecurityException(
          `Egress violation: shell injection pattern detected. Pattern matched: ${shellMatch}`,
          'SHELL_INJECTION_BLOCKED'
        );
      }

      const epistemicMatch = detectEpistemicContradiction(value);
      if (epistemicMatch !== null) {
        throw new EpistemicSecurityException(
          `Epistemic Termination Trigger (ETT): agent semantics indicate uncertainty or hallucination. Pattern matched: ${epistemicMatch}`,
          'EPISTEMIC_CONTRADICTION_DETECTED'
        );
      }
    }

    next();
  } catch (error: unknown) {
    if (error instanceof EpistemicSecurityException) {
      next(error); // Pass to error-handler.ts for Hard Halt
      return;
    }
    next(new EpistemicSecurityException('Egress filter encountered an unexpected error. Request denied (Fail-Closed).', 'EGRESS_VIOLATION'));
  }
};
