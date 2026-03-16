import { createServer, Server } from "node:http";
import type { ProxyConfig } from "../config/schema.js";
import type { CacheManager } from "../cache/manager.js";
import { AdminRouter } from "./router.js";
import { logger } from "../logger.js";

export class AdminServer {
  private server: Server | null = null;
  private readonly router: AdminRouter;

  constructor(
    private readonly config: ProxyConfig,
    private readonly cacheManager: CacheManager
  ) {
    this.router = new AdminRouter(this.config, this.cacheManager);
  }

  start(): void {
    if (!this.config.admin.enabled) {
      logger.info("Admin API is disabled in configuration.");
      return;
    }

    const { port, host } = this.config.admin;

    this.server = createServer((req, res) => {
      this.router.handle(req, res);
    });

    this.server.on("error", (err) => {
      logger.error(`❌ Admin API server error:`, err);
    });

    this.server.listen(port, host, () => {
      logger.info(`✨ Admin API started at http://${host}:${port}`);
      logger.info(`   - Health: http://${host}:${port}/health`);
      logger.info(`   - Stats:  http://${host}:${port}/stats`);
      logger.info(`   - Config: http://${host}:${port}/config`);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve, reject) => {
      logger.info("🛑 Stopping Admin API server...");
      this.server!.close((err) => {
        if (err) {
          logger.error("❌ Error stopping Admin API:", err);
          return reject(err);
        }
        this.server = null;
        resolve();
      });
    });
  }
}
