import { z } from "zod";

export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") + ": " : "";
      return `  • ${path}${issue.message}`;
    })
    .join("\n");
}

export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; errors: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, errors: formatZodErrors(result.error) };
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

export function isMcpMethodName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_/]*$/i.test(value);
}

export function isValidSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidPort(value: unknown): value is number {
  return isPositiveInt(value) && (value as number) <= 65_535;
}

export function sanitizeIdentifier(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

export function findOversizedStrings(
  obj: unknown,
  maxLength: number,
  path = ""
): string[] {
  const violations: string[] = [];
  if (typeof obj === "string") {
    if (obj.length > maxLength) violations.push(path || "(root)");
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) =>
      violations.push(...findOversizedStrings(item, maxLength, `${path}[${idx}]`))
    );
  } else if (obj !== null && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      violations.push(
        ...findOversizedStrings(value, maxLength, path ? `${path}.${key}` : key)
      );
    }
  }
  return violations;
}

export function isJsonRpcRequest(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj["jsonrpc"] === "2.0" &&
    typeof obj["method"] === "string" &&
    obj["method"].length > 0
  );
}

export function isJsonRpcResponse(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj["jsonrpc"] === "2.0" &&
    ("result" in obj || "error" in obj)
  );
}

export function isJsonRpcNotification(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj["jsonrpc"] === "2.0" && "method" in obj && !("id" in obj);
}
