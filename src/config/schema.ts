import { z } from "zod";
import {
  DEFAULT_CACHE_DIR,
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_L1_MAX_ITEMS,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_ADMIN_PORT,
  DEFAULT_ADMIN_HOST,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_CB_FAILURE_THRESHOLD,
  DEFAULT_CB_SUCCESS_THRESHOLD,
  DEFAULT_CB_TIMEOUT_MS,
  DEFAULT_L1_MAX_SIZE_BYTES,
} from "../constants.js";

export const CacheConfigSchema = z.object({
  dir: z.string().min(1).default(DEFAULT_CACHE_DIR),
  ttlSeconds: z.number().int().positive().default(DEFAULT_CACHE_TTL_SECONDS),
  l1MaxItems: z.number().int().positive().default(DEFAULT_L1_MAX_ITEMS),
  l1MaxSizeBytes: z.number().int().positive().default(DEFAULT_L1_MAX_SIZE_BYTES),
  maxResponseBytes: z.number().int().positive().default(DEFAULT_MAX_RESPONSE_BYTES),
  compress: z.boolean().default(false),
  excludeMethods: z.array(z.string()).default([]),
  includeMethods: z.array(z.string()).optional(),
  methodTtlOverrides: z.record(z.string(), z.number().int().positive()).default({}),
  alwaysCacheTools: z.array(z.string()).default([]),
  neverCacheTools: z.array(z.string()).default([]),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().nonnegative().default(DEFAULT_MAX_RETRIES),
  delayMs: z.number().int().positive().default(DEFAULT_RETRY_DELAY_MS),
  backoffFactor: z.number().positive().default(DEFAULT_RETRY_BACKOFF_FACTOR),
  maxDelayMs: z.number().int().positive().default(DEFAULT_RETRY_MAX_DELAY_MS),
  retryOnNetworkErrors: z.boolean().default(true),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

export const TimeoutConfigSchema = z.object({
  requestMs: z.number().int().positive().default(DEFAULT_REQUEST_TIMEOUT_MS),
  connectionMs: z.number().int().positive().default(5_000),
  shutdownMs: z.number().int().positive().default(10_000),
});

export type TimeoutConfig = z.infer<typeof TimeoutConfigSchema>;

export const CircuitBreakerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  failureThreshold: z.number().int().positive().default(DEFAULT_CB_FAILURE_THRESHOLD),
  successThreshold: z.number().int().positive().default(DEFAULT_CB_SUCCESS_THRESHOLD),
  timeoutMs: z.number().int().positive().default(DEFAULT_CB_TIMEOUT_MS),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

export const RateLimiterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRequests: z.number().int().positive().default(DEFAULT_RATE_LIMIT_MAX_REQUESTS),
  windowMs: z.number().int().positive().default(DEFAULT_RATE_LIMIT_WINDOW_MS),
});

export type RateLimiterConfig = z.infer<typeof RateLimiterConfigSchema>;

export const AdminConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(1).max(65535).default(DEFAULT_ADMIN_PORT),
  host: z.string().default(DEFAULT_ADMIN_HOST),
  token: z.string().optional(),
  corsEnabled: z.boolean().default(false),
  corsOrigins: z.array(z.string()).default(["*"]),
});

export type AdminConfig = z.infer<typeof AdminConfigSchema>;

export const MetricsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  prometheus: z.boolean().default(false),
  flushIntervalMs: z.number().int().positive().default(5_000),
});

export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;

export const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  colorize: z.boolean().default(true),
  timestamps: z.boolean().default(true),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

export const TargetServerConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  cwd: z.string().optional(),
});

export type TargetServerConfig = z.infer<typeof TargetServerConfigSchema>;

export const ProxyConfigSchema = z.object({
  cache: CacheConfigSchema.default({}),
  target: TargetServerConfigSchema,
  retry: RetryConfigSchema.default({}),
  timeout: TimeoutConfigSchema.default({}),
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  rateLimiter: RateLimiterConfigSchema.default({}),
  admin: AdminConfigSchema.default({}),
  metrics: MetricsConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  verbose: z.boolean().default(false),
});

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;
