import type { PendingMcpRequest } from "../types/rpc.js";
import { isJsonRpcResponse } from "../utils/validation.js";
import { logger } from "../logger.js";
import type { CacheManagerStats } from "../cache/manager.js"; 

import { InvalidJsonRpcError } from "../errors.js";

export class ResponseInterceptor {
  
  private pendingRequests = new Map<string | number, PendingMcpRequest>();

  registerPending(req: PendingMcpRequest): void {
    if (req.id !== null && req.id !== undefined) {
      this.pendingRequests.set(req.id, req);
    }
  }

  removePending(id: string | number): void {
    this.pendingRequests.delete(id);
  }

  processTargetMessage(message: unknown): {
    req?: PendingMcpRequest;
    isPassthrough: boolean;
  } {
    if (!isJsonRpcResponse(message)) {
      
      return { isPassthrough: true };
    }

    const response = message as { id: string | number | null };
    
    if (response.id === null || response.id === undefined) {
      
      logger.warn("Получен ответ (Response) от сервера без поля id");
      return { isPassthrough: true };
    }

    const pendingReq = this.pendingRequests.get(response.id);

    if (!pendingReq) {
      
      return { isPassthrough: true };
    }

    return { req: pendingReq, isPassthrough: false };
  }

  cleanupStaleRequests(timeoutMs: number): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, req] of this.pendingRequests.entries()) {
      if (now - req.timestampMs > timeoutMs) {
        this.pendingRequests.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.warn(`🧹 Очищено ${cleaned} зависших запросов (без ответа от сервера)`);
    }
    return cleaned;
  }
}
