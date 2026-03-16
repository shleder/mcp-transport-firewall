import { ConfigurationError } from "../errors.js";
import type { ProxyConfig } from "./schema.js";

export function validateConfig(config: ProxyConfig): void {
  const maxPossibleRetryDelay =
    config.retry.delayMs *
    Math.pow(config.retry.backoffFactor, config.retry.maxRetries);

  if (config.timeout.requestMs < config.retry.delayMs * 2) {
    throw new ConfigurationError(
      `timeout.requestMs (${config.timeout.requestMs}ms) is too small. ` +
      `Must be at least twice the value of retry.delayMs (${config.retry.delayMs}ms).`
    );
  }

  if (maxPossibleRetryDelay > config.timeout.requestMs) {
    process.stderr.write(
      `[mcp-optimizer] Warning: maximum cumulative retry delay ` +
      `(~${Math.round(maxPossibleRetryDelay)}ms) exceeds timeout.requestMs ` +
      `(${config.timeout.requestMs}ms). Some retry attempts may not execute.\n`
    );
  }

  if (config.admin.enabled && !config.admin.token) {
    process.stderr.write(
      `[mcp-optimizer] ⚠ Warning: Admin API started without authorization ` +
      `token (admin.token). Setting ADMIN_TOKEN is recommended for security.\n`
    );
  }

  if (config.admin.enabled) {
    const reservedPorts = [22, 80, 443, 3000, 8080, 8443];
    if (reservedPorts.includes(config.admin.port)) {
      throw new ConfigurationError(
        `admin.port=${config.admin.port} is a reserved port. ` +
        `Please use a different port (e.g., 9090).`
      );
    }
  }

  if (
    config.circuitBreaker.enabled &&
    config.circuitBreaker.successThreshold > config.circuitBreaker.failureThreshold
  ) {
    throw new ConfigurationError(
      `circuitBreaker.successThreshold (${config.circuitBreaker.successThreshold}) ` +
      `cannot be greater than failureThreshold (${config.circuitBreaker.failureThreshold}).`
    );
  }

  if (
    config.cache.includeMethods &&
    config.cache.includeMethods.length > 0 &&
    config.cache.excludeMethods.length > 0
  ) {
    const conflict = config.cache.includeMethods.filter((m) =>
      config.cache.excludeMethods.includes(m)
    );
    if (conflict.length > 0) {
      throw new ConfigurationError(
        `Cache configuration conflict: methods present in both includeMethods and excludeMethods: ` +
        conflict.join(", ")
      );
    }
  }

  const worstCaseL1 = config.cache.maxResponseBytes * config.cache.l1MaxItems;
  if (config.cache.l1MaxSizeBytes > worstCaseL1) {
    process.stderr.write(
      `[mcp-optimizer] ℹ cache.l1MaxSizeBytes=${config.cache.l1MaxSizeBytes} is greater than ` +
      `maximum possible L1 size (${config.cache.maxResponseBytes} × ${config.cache.l1MaxItems} = ${worstCaseL1}). ` +
      `lru-cache will be limited by l1MaxItems first.\n`
    );
  }
}
