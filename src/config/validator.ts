import { ConfigurationError } from "../errors.js";
import type { ProxyConfig } from "./schema.js";

export function validateConfig(config: ProxyConfig): void {
  
  const maxPossibleRetryDelay =
    config.retry.delayMs *
    Math.pow(config.retry.backoffFactor, config.retry.maxRetries);

  if (config.timeout.requestMs < config.retry.delayMs * 2) {
    throw new ConfigurationError(
      `timeout.requestMs (${config.timeout.requestMs}ms) слишком мал. ` +
      `Должен быть хотя бы вдвое больше retry.delayMs (${config.retry.delayMs}ms)`
    );
  }

  if (maxPossibleRetryDelay > config.timeout.requestMs) {
    process.stderr.write(
      `[mcp-optimizer] Предупреждение: максимальная суммарная задержка retry ` +
      `(~${Math.round(maxPossibleRetryDelay)}ms) превышает timeout.requestMs ` +
      `(${config.timeout.requestMs}ms). Часть попыток может не выполниться.\n`
    );
  }

  if (config.admin.enabled && !config.admin.token) {
    process.stderr.write(
      `[mcp-optimizer] ⚠ Предупреждение: Admin API запущен без авторизационного ` +
      `токена (admin.token). Рекомендуется установить ADMIN_TOKEN для безопасности.\n`
    );
  }

  if (config.admin.enabled) {
    const reservedPorts = [22, 80, 443, 3000, 8080, 8443];
    if (reservedPorts.includes(config.admin.port)) {
      throw new ConfigurationError(
        `admin.port=${config.admin.port} — это зарезервированный порт. ` +
        `Используйте другой (например: 9090)`
      );
    }
  }

  if (
    config.circuitBreaker.enabled &&
    config.circuitBreaker.successThreshold > config.circuitBreaker.failureThreshold
  ) {
    throw new ConfigurationError(
      `circuitBreaker.successThreshold (${config.circuitBreaker.successThreshold}) ` +
      `не может быть больше failureThreshold (${config.circuitBreaker.failureThreshold})`
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
        `Конфликт конфигурации кэша: методы присутствуют и в includeMethods, и в excludeMethods: ` +
        conflict.join(", ")
      );
    }
  }

  const worstCaseL1 = config.cache.maxResponseBytes * config.cache.l1MaxItems;
  if (config.cache.l1MaxSizeBytes > worstCaseL1) {
    
    process.stderr.write(
      `[mcp-optimizer] ℹ cache.l1MaxSizeBytes=${config.cache.l1MaxSizeBytes} больше ` +
      `максимально возможного l1 (${config.cache.maxResponseBytes} × ${config.cache.l1MaxItems} = ${worstCaseL1}). ` +
      `lru-cache будет ограничен по l1MaxItems раньше.\n`
    );
  }
}
