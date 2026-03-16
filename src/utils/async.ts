

export class TimeoutError extends Error {
  constructor(ms: number, operation?: string) {
    super(
      `Operation${operation ? ` '${operation}'` : ""} exceeded timeout of ${ms}ms`
    );
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operationName?: string
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(ms, operationName));
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, delayMs, backoffFactor, maxDelayMs, shouldRetry, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries) break;

      if (shouldRetry && !shouldRetry(err, attempt)) break;

      const delay = Math.min(delayMs * Math.pow(backoffFactor, attempt), maxDelayMs);
      const jitter = delay * (Math.random() * 0.3 - 0.15); 
      const actualDelay = Math.max(0, Math.round(delay + jitter));

      if (onRetry) {
        onRetry(err, attempt + 1, actualDelay);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError;
}

export class InFlightDeduplicator<T = unknown> {
  private readonly inFlight = new Map<string, Promise<T>>();

  async execute(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  get size(): number {
    return this.inFlight.size;
  }

  get keys(): string[] {
    return [...this.inFlight.keys()];
  }
}

export async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const idx = cursor++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number
): (...args: Args) => void {
  let timer: NodeJS.Timeout | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };
}

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  limitMs: number
): (...args: Args) => void {
  let last = 0;
  return (...args: Args) => {
    const now = Date.now();
    if (now - last >= limitMs) {
      last = now;
      fn(...args);
    }
  };
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function trySync<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
