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

const DANGEROUS_PATH_PATTERNS = [
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

const PROMPT_INJECTION_PATTERNS = [
  /ignore (previous|all) instructions/i,
  /forget your (system prompt|rules)/i,
  /you are now/i,
  /act as (root|admin|sudo)/i,
  /\x00/,
];

const DEFAULT_RULES: FirewallRule[] = [
  {
    name: "PATH_TRAVERSAL",
    description: "Blocks access to sensitive file system paths",
    severity: "block",
    check: (_method, params) => {
      if (!params) return false;
      const str = JSON.stringify(params);
      return DANGEROUS_PATH_PATTERNS.some(p => p.test(str));
    }
  },
  {
    name: "PROMPT_INJECTION",
    description: "Blocks tool calls containing prompt injection attempts",
    severity: "block",
    check: (_method, params) => {
      if (!params) return false;
      const str = JSON.stringify(params);
      return PROMPT_INJECTION_PATTERNS.some(p => p.test(str));
    }
  },
  {
    name: "OVERSIZED_PAYLOAD",
    description: "Blocks params larger than 256KB",
    severity: "block",
    check: (_method, params) => {
      if (!params) return false;
      const size = Buffer.byteLength(JSON.stringify(params), "utf8");
      return size > 256 * 1024;
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

export function createFirewall(customRules: FirewallRule[] = []) {
  const rules = [...DEFAULT_RULES, ...customRules];

  return function evaluateFirewall(
    method: string,
    params: Record<string, unknown> | undefined
  ): FirewallDecision {
    for (const rule of rules) {
      try {
        if (rule.check(method, params)) {
          if (rule.severity === "block") {
            logger.warn(`🔥 [Firewall] BLOCKED by rule "${rule.name}": ${rule.description}`);
            return { blocked: true, ruleName: rule.name, reason: rule.description };
          } else {
            logger.warn(`⚠️  [Firewall] WARNING by rule "${rule.name}": ${rule.description}`);
          }
        }
      } catch {
        // rule check errors should never crash the proxy
      }
    }
    return { blocked: false };
  };
}

export type FirewallEvaluator = ReturnType<typeof createFirewall>;
