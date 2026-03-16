import { CacheSerializationError } from "../errors.js";

export interface SafeParseResult<T> {
  success: true;
  data: T;
}

export interface SafeParseError {
  success: false;
  error: string;
}

export type SafeParseOutcome<T> = SafeParseResult<T> | SafeParseError;

export function safeJsonParse<T = unknown>(raw: string): SafeParseOutcome<T> {
  try {
    return { success: true, data: JSON.parse(raw) as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown parse error",
    };
  }
}

export function parseJsonOrThrow<T = unknown>(raw: string): T {
  const result = safeJsonParse<T>(raw);
  if (!result.success) {
    throw new CacheSerializationError("deserialize", result.error);
  }
  return result.data;
}

export function normalizeForJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForJson((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function serializeJson(value: unknown, indent?: number): string {
  try {
    return JSON.stringify(normalizeForJson(value), null, indent);
  } catch (err) {
    throw new CacheSerializationError("serialize", err);
  }
}

export function trySerializeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(normalizeForJson(value));
  } catch {
    return undefined;
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => deepEqual(item, b[idx]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    if (!deepEqual(aKeys, bKeys)) return false;
    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }
  return false;
}

export function jsonByteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return 0;
  }
}

export function truncateForLog(value: unknown, maxLength = 200): string {
  const str = typeof value === "string" ? value : JSON.stringify(value) ?? "[unknown]";
  return str.length > maxLength ? str.slice(0, maxLength) + "…" : str;
}
