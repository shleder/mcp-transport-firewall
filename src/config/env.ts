import { ENV_KEYS } from "../constants.js";

type EnvSource = Record<string, string | undefined>;

const env: EnvSource = process.env;

function envString(key: string, fallback?: string): string | undefined {
  const val = env[key];
  return val !== undefined && val !== "" ? val : fallback;
}

function envNumber(key: string, fallback?: number): number | undefined {
  const val = env[key];
  if (val === undefined || val === "") return fallback;
  const parsed = Number(val);
  if (!Number.isFinite(parsed)) {
    process.stderr.write(
      `[mcp-optimizer] Warning: ENV ${key}="${val}" is not a number, using default value\n`
    );
    return fallback;
  }
  return parsed;
}

function envBool(key: string, fallback?: boolean): boolean | undefined {
  const val = env[key];
  if (val === undefined || val === "") return fallback;
  if (val === "true" || val === "1" || val === "yes") return true;
  if (val === "false" || val === "0" || val === "no") return false;
  process.stderr.write(
    `[mcp-optimizer] Warning: ENV ${key}="${val}" - expected true/false, using default value\n`
  );
  return fallback;
}

function envList(key: string, fallback: string[] = []): string[] {
  const val = env[key];
  if (val === undefined || val === "") return fallback;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface EnvConfig {
  cache: {
    dir?: string;
    ttlSeconds?: number;
    l1MaxItems?: number;
    maxResponseBytes?: number;
    compress?: boolean;
    excludeMethods: string[];
  };
  admin: {
    enabled?: boolean;
    port?: number;
    host?: string;
    token?: string;
    corsEnabled?: boolean;
  };
  metrics: {
    enabled?: boolean;
    prometheus?: boolean;
  };
  logging: {
    level?: string;
    colorize?: boolean;
  };
  retry: {
    maxRetries?: number;
  };
  timeout: {
    requestMs?: number;
  };
  rateLimiter: {
    enabled?: boolean;
    maxRequests?: number;
    windowMs?: number;
  };
  circuitBreaker: {
    enabled?: boolean;
    failureThreshold?: number;
  };
  verbose?: boolean;
}


export function readEnvConfig(): EnvConfig {
  return {
    cache: {
      dir: envString(ENV_KEYS.CACHE_DIR),
      ttlSeconds: envNumber(ENV_KEYS.CACHE_TTL_SECONDS),
      l1MaxItems: envNumber(ENV_KEYS.L1_MAX_ITEMS),
      maxResponseBytes: envNumber(ENV_KEYS.MAX_RESPONSE_BYTES),
      compress: envBool(ENV_KEYS.COMPRESS_CACHE),
      excludeMethods: envList("CACHE_EXCLUDE_METHODS"),
    },
    admin: {
      enabled: envBool(ENV_KEYS.ADMIN_ENABLED),
      port: envNumber(ENV_KEYS.ADMIN_PORT),
      host: envString(ENV_KEYS.ADMIN_HOST),
      token: envString(ENV_KEYS.ADMIN_TOKEN),
      corsEnabled: envBool("ADMIN_CORS_ENABLED"),
    },
    metrics: {
      enabled: envBool(ENV_KEYS.METRICS_ENABLED),
      prometheus: envBool("METRICS_PROMETHEUS"),
    },
    logging: {
      level: envString("LOG_LEVEL"),
    },
    retry: {
      maxRetries: envNumber(ENV_KEYS.MAX_RETRIES),
    },
    timeout: {
      requestMs: envNumber(ENV_KEYS.REQUEST_TIMEOUT_MS),
    },
    rateLimiter: {
      enabled: envBool("RATE_LIMIT_ENABLED"),
      maxRequests: envNumber(ENV_KEYS.RATE_LIMIT_MAX),
      windowMs: envNumber(ENV_KEYS.RATE_LIMIT_WINDOW_MS),
    },
    circuitBreaker: {
      enabled: envBool(ENV_KEYS.CB_ENABLED),
      failureThreshold: envNumber(ENV_KEYS.CB_FAILURE_THRESHOLD),
    },
    verbose: envBool(ENV_KEYS.VERBOSE),
  };
}


export function getDetectedEnvVars(): Record<string, string> {
  const result: Record<string, string> = {};
  const allKeys = Object.values(ENV_KEYS);
  for (const key of allKeys) {
    const val = env[key];
    if (val !== undefined) {
      result[key] = key.toLowerCase().includes("token") ? "***" : val;
    }
  }
  return result;
}
