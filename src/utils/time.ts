

export const nowMs = (): number => Date.now();

export const nowSec = (): number => Math.floor(Date.now() / 1000);

export const hrNow = (): number => performance.now();

export function elapsed(startHr: number): number {
  return Math.round(performance.now() - startHr);
}

export function computeExpiresAt(ttlSeconds: number): number {
  return Date.now() + ttlSeconds * 1_000;
}

export function isExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

export function remainingTtlSeconds(expiresAt: number): number {
  const remainMs = expiresAt - Date.now();
  return Math.max(0, Math.floor(remainMs / 1_000));
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (ms < 3_600_000) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatTtl(seconds: number): string {
  return formatDuration(seconds * 1_000);
}

export function formatDateTime(date: Date = new Date()): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exponentialBackoff(
  attempt: number,
  baseDelayMs: number,
  factor: number,
  maxDelayMs: number
): number {
  const delay = baseDelayMs * Math.pow(factor, attempt);
  return Math.min(delay, maxDelayMs);
}

export function backoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  factor: number,
  maxDelayMs: number
): number {
  const base = exponentialBackoff(attempt, baseDelayMs, factor, maxDelayMs);
  const jitter = base * (Math.random() * 0.5 - 0.25); 
  return Math.max(0, Math.round(base + jitter));
}

export function timeAgo(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  if (diffMs < 1_000) return "just now";
  return formatDuration(diffMs) + " ago";
}
