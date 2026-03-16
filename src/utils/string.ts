

export function truncate(str: string, maxLength: number, suffix = "…"): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function normalizeWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, " ");
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateSimpleId(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function padLeft(str: string | number, length: number, char = "0"): string {
  return String(str).padStart(length, char);
}

export function maskSecret(secret: string, showFirst = 4, showLast = 4): string {
  if (secret.length <= showFirst + showLast) return "*".repeat(secret.length);
  return (
    secret.slice(0, showFirst) +
    "***" +
    secret.slice(secret.length - showLast)
  );
}

export function maskAuthHeader(header: string): string {
  const [scheme, token] = header.split(" ");
  if (!token) return maskSecret(header);
  return `${scheme} ${maskSecret(token)}`;
}

export function pluralize(n: number, one: string, other: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${other}`;
}

export function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
