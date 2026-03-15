import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS } from "../../constants.js";
import type { CacheManager } from "../../cache/manager.js";
import { NotFoundError, ValidationError } from "../../errors.js";

async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new ValidationError("Невалидный JSON тело запроса"));
      }
    });
    req.on("error", reject);
  });
}

export async function handleCacheRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  cacheManager: CacheManager
): Promise<void> {
  const method = req.method;
  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  if (method === "GET" && path === "/cache/stats") {
    res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cacheManager.getStats()));
    return;
  }

  if (method === "DELETE" && path === "/cache") {
    cacheManager.clear();
    res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", message: "Кэш полностью очищен" }));
    return;
  }

  if (method === "POST" && path === "/cache/invalidate") {
    const body = await readJsonBody(req);
    
    if (body.key) {
      const result = cacheManager.invalidator.invalidateByKey(body.key);
      res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", result }));
      return;
    }
    
    if (body.method) {
      const result = cacheManager.invalidator.invalidateByMethod(body.method);
      res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", result }));
      return;
    }

    throw new ValidationError("Для инвалидации укажите 'key' или 'method' в теле запроса");
  }

  throw new NotFoundError(path);
}
