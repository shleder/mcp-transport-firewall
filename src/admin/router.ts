import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProxyConfig } from "../config/schema.js";
import type { CacheManager } from "../cache/manager.js";

import { handleHealth } from "./handlers/health.js";
import { handleStats } from "./handlers/stats.js";
import { handleConfig } from "./handlers/config.js";
import { handleCacheRoutes } from "./handlers/cache.js";

import { requireAuth } from "./middleware/auth.js";
import { applyCors } from "./middleware/cors.js";
import { withLogging } from "./middleware/logging.js";

import { AdminApiError, McpOptimizerError, NotFoundError } from "../errors.js";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

export class AdminRouter {
  constructor(
    private readonly config: ProxyConfig,
    private readonly cacheManager: CacheManager
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const urlObj = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
    const path = urlObj.pathname;

    await withLogging(req, res, async () => {
      
      if (applyCors(req, res, { 
        enabled: this.config.admin.corsEnabled, 
        origins: this.config.admin.corsOrigins 
      })) {
        return; 
      }

      if (path !== "/health") {
        requireAuth(req, res, this.config.admin.token);
      }

      if (req.method === "GET" && path === "/health") {
        return handleHealth(res);
      }
      
      if (req.method === "GET" && path === "/stats") {
        return handleStats(req, res, this.cacheManager);
      }

      if (req.method === "GET" && path === "/config") {
        return handleConfig(res, this.config);
      }

      if (path.startsWith("/cache")) {
        return await handleCacheRoutes(req, res, this.cacheManager);
      }

      // Serve Web Dashboard assets (Fallback logic)
      if (req.method === "GET") {
        if (this.serveStatic(path, res)) {
          return;
        }
      }

      throw new NotFoundError(path);
    }).catch((err) => this.errorHandler(err, res));
  }

  private serveStatic(urlPath: string, res: ServerResponse): boolean {
    const basePath = resolve(process.cwd(), "ui", "dist");
    
    if (!existsSync(basePath)) return false;

    // Default to index.html for root path or client-side routing
    let targetPath = join(basePath, urlPath === "/" || urlPath === "" ? "index.html" : urlPath);

    if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
        targetPath = join(targetPath, "index.html");
    }

    if (!existsSync(targetPath)) {
        // Fallback to index.html for SPA routing
        const fallbackPath = join(basePath, "index.html");
        if (existsSync(fallbackPath)) {
            targetPath = fallbackPath;
        } else {
            return false;
        }
    }

    const ext = extname(targetPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpg",
        ".svg": "image/svg+xml"
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    
    try {
        const content = readFileSync(targetPath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
        return true;
    } catch {
        return false;
    }
  }

  private errorHandler(err: unknown, res: ServerResponse): void {
    if (res.headersSent) return;

    let statusCode = 500;
    let payload: Record<string, unknown> = {
      error: "Internal Server Error",
      code: "INTERNAL_ERROR"
    };

    if (err instanceof McpOptimizerError) {
      statusCode = err.statusCode;
      payload = {
        error: err.message,
        code: err.code,
        details: err.details
      };
    } else if (err instanceof Error) {
      payload.error = err.message;
    }

    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  }
}
