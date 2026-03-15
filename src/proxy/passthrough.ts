import { logger } from "../logger.js";
import { isJsonRpcRequest, isJsonRpcNotification } from "../utils/validation.js";

export function isPassthroughMessage(message: unknown): boolean {
  if (isJsonRpcNotification(message)) return true;
  
  if (isJsonRpcRequest(message)) {
    const req = message as { method: string };

    if (req.method === "tools/call" || req.method.startsWith("resources/read")) {
      return false;
    }

    return true;
  }

  return true;
}

export function logPassthrough(message: unknown, direction: "C->S" | "S->C"): void {
  if (isJsonRpcRequest(message)) {
    const method = (message as { method: string }).method;
    logger.debug(`[Passthrough ${direction}] Request: ${method}`);
  } else if (isJsonRpcNotification(message)) {
    const method = (message as { method: string }).method;
    logger.debug(`[Passthrough ${direction}] Notification: ${method}`);
  } else {
    logger.debug(`[Passthrough ${direction}] Response -> Client`);
  }
}
