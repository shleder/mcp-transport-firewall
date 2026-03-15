import { generateUuid } from "../utils/crypto.js";
import { safeJsonParse } from "../utils/json.js";
import { InvalidJsonRpcError } from "../errors.js";

export function parseIncomingMessage(rawStr: string): unknown {
  const result = safeJsonParse(rawStr);
  if (!result.success) {
    throw new InvalidJsonRpcError(rawStr);
  }
  return result.data;
}

export function formatOutgoingMessage(payload: unknown): string {
  
  return JSON.stringify(payload) + "\n";
}

export function buildRpcErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {})
    }
  };
}

export function buildRpcSuccessResponse(
  id: string | number | null,
  result: unknown
) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}
