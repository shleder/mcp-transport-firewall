import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../../logger.js";
import { hrNow, elapsed } from "../../utils/time.js";

export async function withLogging(
  req: IncomingMessage,
  res: ServerResponse,
  handler: () => Promise<void>
): Promise<void> {
  const startHr = hrNow();
  const id = Math.random().toString(36).substring(2, 6);
  const method = req.method ?? "UNKNOWN";
  const url = req.url ?? "/";

  logger.debug(`[Admin HTTP ${id}] ${method} ${url} - Начат`);

  const originalEnd = res.end;
  let responseSent = false;
  
  res.end = function(this: ServerResponse, ...args: unknown[]) {
    if (!responseSent) {
      responseSent = true;
      const ms = elapsed(startHr);
      const status = res.statusCode;
      const color = status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
      logger.debug(`[Admin HTTP ${id}] ${method} ${url} - ${color}${status}\x1b[0m (${ms}ms)`);
    }
    return originalEnd.apply(this, args as any);
  } as typeof res.end;

  try {
    await handler();
  } catch (err) {
    
    if (!responseSent) {
      if ((err as any)?.statusCode) {
        
        throw err; 
      }
      logger.error(`[Admin HTTP ${id}] ❌ Ошибка выполнения ${method} ${url}:`, err);
      throw err;
    }
  }
}
