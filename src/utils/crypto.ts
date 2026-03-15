import { createHash, createHmac, randomBytes } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function sha512(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex");
}

export function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

export function shortHash(input: string, length = 8): string {
  return sha256(input).slice(0, length);
}

export function hmacSha256(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export function verifyHmac(data: string, signature: string, secret: string): boolean {
  const expected = hmacSha256(data, secret);
  if (expected.length !== signature.length) return false;
  
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}

export function generateAdminToken(): string {
  return `mcp-${generateToken(24)}`;
}

export function generateUuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; 
  bytes[8] = (bytes[8] & 0x3f) | 0x80; 
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortObjectKeys((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function buildCacheKey(
  serverId: string,
  method: string,
  params: Record<string, unknown> | undefined
): string {
  const normalized = sortObjectKeys(params ?? {});
  const raw = `${serverId}\x00${method}\x00${JSON.stringify(normalized)}`;
  return sha256(raw);
}

export function shortCacheKey(fullKey: string): string {
  return fullKey.slice(0, 8);
}
