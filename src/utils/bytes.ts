import { BYTES_PER_KB, BYTES_PER_MB, CHARS_PER_TOKEN } from "../constants.js";

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes < 0) return "0 B";
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(decimals)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(decimals)} MB`;
}

export function parseBytes(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i.exec(input.trim());
  if (!match) throw new Error(`Невозможно распарсить размер: ${input}`);
  const [, numStr, unit = "B"] = match;
  const num = parseFloat(numStr);
  switch (unit.toUpperCase()) {
    case "KB": return Math.round(num * BYTES_PER_KB);
    case "MB": return Math.round(num * BYTES_PER_MB);
    case "GB": return Math.round(num * BYTES_PER_MB * 1_024);
    default:   return Math.round(num);
  }
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateValueTokens(value: unknown): number {
  try {
    const str = JSON.stringify(value);
    return estimateTokenCount(str);
  } catch {
    return 0;
  }
}

export function calculateTokenCost(tokenCount: number, pricePerMillionTokens = 15): number {
  return (tokenCount / 1_000_000) * pricePerMillionTokens;
}

export function exceedsByteLimit(str: string, maxBytes: number): boolean {
  return Buffer.byteLength(str, "utf8") > maxBytes;
}

export function getByteSize(str: string): number {
  return Buffer.byteLength(str, "utf8");
}

export function getBufferSize(buf: Buffer): number {
  return buf.byteLength;
}

export function makeProgressBar(ratio: number, width = 20): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}
