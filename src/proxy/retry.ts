import type { RetryConfig } from "../config/schema.js";
import { retryAsync } from "../utils/async.js";
import { logger } from "../logger.js";
import { TargetServerError } from "../errors.js";

export async function withProxyRetry<T>(
  operationName: string,
  config: RetryConfig,
  fn: () => Promise<T>
): Promise<T> {
  const { maxRetries, delayMs, backoffFactor, maxDelayMs, retryOnNetworkErrors } = config;

  if (maxRetries <= 0) {
    return fn();
  }

  return retryAsync(fn, {
    maxRetries,
    delayMs,
    backoffFactor,
    maxDelayMs,
    shouldRetry: (err, _attempt) => {

      if (err instanceof TargetServerError) {
        return retryOnNetworkErrors;
      }

      if (err instanceof Error && err.name === "TargetServerTimeoutError") {
        return true;
      }

      return false;
    },
    onRetry: (err, attempt, nextDelayMs) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `🔁 [${operationName}] Error: ${msg} | ` +
        `Attempt ${attempt}/${maxRetries} ` +
        `in ${nextDelayMs}ms`
      );
    },
  });
}
