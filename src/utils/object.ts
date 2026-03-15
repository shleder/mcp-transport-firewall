

export function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  ...overrides: Partial<T>[]
): T {
  let result = { ...base };
  for (const override of overrides) {
    for (const key of Object.keys(override) as (keyof T)[]) {
      const overrideVal = override[key];
      if (overrideVal === undefined) continue;
      const baseVal = result[key];
      if (
        typeof overrideVal === "object" &&
        overrideVal !== null &&
        !Array.isArray(overrideVal) &&
        typeof baseVal === "object" &&
        baseVal !== null &&
        !Array.isArray(baseVal)
      ) {
        result[key] = deepMerge(
          baseVal as Record<string, unknown>,
          overrideVal as Record<string, unknown>
        ) as T[keyof T];
      } else {
        result[key] = overrideVal as T[keyof T];
      }
    }
  }
  return result;
}

export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

export function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => U
): Record<string, U> {
  const result: Record<string, U> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value, key);
  }
  return result;
}

export function filterEntries<T>(
  obj: Record<string, T>,
  predicate: (value: T, key: string) => boolean
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (predicate(value, key)) result[key] = value;
  }
  return result;
}

export function renameKeys<T extends Record<string, unknown>>(
  obj: T,
  mapping: Partial<Record<keyof T, string>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = (mapping as Record<string, string>)[key] ?? key;
    result[newKey] = value;
  }
  return result;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

export function countNestedKeys(obj: unknown): number {
  if (!isPlainObject(obj)) return 0;
  let count = 0;
  for (const value of Object.values(obj)) {
    count++;
    count += countNestedKeys(value);
  }
  return count;
}

export function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, unknown> = {}
): Record<string, unknown> {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      flattenObject(value, fullKey, result);
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}
