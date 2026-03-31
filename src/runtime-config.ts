interface IntOption {
  fallback: number;
  min?: number;
  max?: number;
}

const parseEnvInt = (rawValue: string | undefined, option: IntOption): number => {
  if (!rawValue) {
    return option.fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return option.fallback;
  }

  if (option.min !== undefined && parsed < option.min) {
    return option.fallback;
  }

  if (option.max !== undefined && parsed > option.max) {
    return option.fallback;
  }

  return parsed;
};

export interface ProxyRuntimeConfig {
  adminPort: number;
  cacheTtlSeconds: number;
  targetTimeoutMs: number;
}

export const resolveProxyRuntimeConfig = (env: NodeJS.ProcessEnv): ProxyRuntimeConfig => {
  return {
    adminPort: parseEnvInt(env.MCP_ADMIN_PORT ?? env.ADMIN_PORT, {
      fallback: 9090,
      min: 1,
      max: 65535,
    }),
    cacheTtlSeconds: parseEnvInt(env.MCP_CACHE_TTL_SECONDS ?? env.CACHE_TTL_SECONDS, {
      fallback: 300,
      min: 1,
      max: 86400,
    }),
    targetTimeoutMs: parseEnvInt(env.MCP_TARGET_TIMEOUT_MS, {
      fallback: 30000,
      min: 1,
      max: 300000,
    }),
  };
};
