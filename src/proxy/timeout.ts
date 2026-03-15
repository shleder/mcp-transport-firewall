import type { TimeoutConfig } from "../config/schema.js";
import { withTimeout, TimeoutError } from "../utils/async.js";
import { TargetServerTimeoutError } from "../errors.js";

export async function withProxyTimeout<T>(
  method: string,
  config: TimeoutConfig,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await withTimeout(fn(), config.requestMs, method);
  } catch (err) {
    if (err instanceof TimeoutError) {
      throw new TargetServerTimeoutError(method, config.requestMs);
    }
    throw err;
  }
}
