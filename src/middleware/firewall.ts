import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../logger.js";

export interface FirewallRule {
  name: string;
  description: string;
  severity: "block" | "warn";
  check: (method: string, params: Record<string, unknown> | undefined) => boolean;
}

export interface FirewallDecision {
  blocked: boolean;
  ruleName?: string;
  reason?: string;
}

export interface FirewallConfig {
  allowedPaths?: string[];
  additionalInjectionPatterns?: RegExp[];
  maxPayloadSize?: number;
}

export function createFirewall(config: FirewallConfig = {}, customRules: FirewallRule[] = []) {
  const allowedPaths = config.allowedPaths || [];
  
  const dangerousPaths = [
    /\/etc\//i,
    /\.env(\.|$)/i,
    /\.ssh\//i,
    /\/proc\//i,
    /\/sys\//i,
    /C:\\Windows/i,
    /credentials/i,
    /secret/i,
    /private_key/i,
  ];

  const injectionPatterns = [
    /ignore (previous|all) instructions/i,
    /forget your (system prompt|rules)/i,
    /you are now/i,
    /act as (root|admin|sudo)/i,
    /\x00/,
    ...(config.additionalInjectionPatterns || [])
  ];

  const defaultRules: FirewallRule[] = [
    {
      name: "PATH_TRAVERSAL",
      description: "Blocks access to sensitive file system paths",
      severity: "block",
      check: (_method, params) => {
        if (!params) return false;

        let hasViolation = false;

        function checkStrings(obj: unknown) {
          if (hasViolation) return;
          if (typeof obj === "string") {
            const isDangerous = dangerousPaths.some(p => p.test(obj));
            if (isDangerous && !allowedPaths.includes(obj)) {
              hasViolation = true;
            }
          } else if (Array.isArray(obj)) {
            for (const item of obj) {
              checkStrings(item);
            }
          } else if (obj !== null && typeof obj === "object") {
            for (const val of Object.values(obj)) {
              checkStrings(val);
            }
          }
        }

        checkStrings(params);
        return hasViolation;
      }
    },
    {
      name: "PROMPT_INJECTION",
      description: "Blocks tool calls containing prompt injection attempts",
      severity: "block",
      check: (_method, params) => {
        if (!params) return false;
        const str = JSON.stringify(params);
        return injectionPatterns.some(p => p.test(str));
      }
    },
    {
      name: "OVERSIZED_PAYLOAD",
      description: "Blocks oversized params",
      severity: "block",
      check: (_method, params) => {
        if (!params) return false;
        const size = Buffer.byteLength(JSON.stringify(params), "utf8");
        return size > (config.maxPayloadSize || 256 * 1024);
      }
    },
    {
      name: "DANGEROUS_TOOL_NAME",
      description: "Warns on potentially destructive tool names",
      severity: "warn",
      check: (method, params) => {
        if (method !== "tools/call" || !params) return false;
        const name = String(params.name ?? "").toLowerCase();
        return ["exec", "eval", "shell", "subprocess", "os.system"].some(d => name.includes(d));
      }
    }
  ];

  const rules = [...defaultRules, ...customRules];

  return function evaluateFirewall(
    method: string,
    params: Record<string, unknown> | undefined
  ): FirewallDecision {
    for (const rule of rules) {
      try {
        if (rule.check(method, params)) {
          if (rule.severity === "block") {
            logger.warn(`[Firewall] BLOCKED by rule "${rule.name}": ${rule.description}`);
            return { blocked: true, ruleName: rule.name, reason: rule.description };
          } else {
            logger.warn(`[Firewall] WARNING by rule "${rule.name}": ${rule.description}`);
          }
        }
      } catch (err) {
        logger.error(`[Firewall] ERROR during rule "${rule.name}" evaluation. Failing closed.`, err);
        return { blocked: true, ruleName: rule.name, reason: "Internal firewall error during rule evaluation" };
      }
    }
    return { blocked: false };
  };
}

export type FirewallEvaluator = ReturnType<typeof createFirewall>;
