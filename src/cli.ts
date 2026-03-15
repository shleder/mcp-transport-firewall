#!/usr/bin/env node

import { loadConfig } from "./config/loader.js";
import { initLogger, logger } from "./logger.js";
import { ProxyEngine } from "./proxy/engine.js";
import { createTransport } from "./transport/factory.js";
import { AdminServer } from "./admin/server.js";
import { initGlobalMetrics } from "./metrics/collector.js";
import { MetricsReporter } from "./metrics/reporter.js";

async function main() {
  try {
    
    const config = loadConfig({ cliArgs: process.argv.slice(2) });

    initLogger({ level: config.logging.level, format: "text", verbose: config.verbose });

    logger.debug("Настройка окружения...");

    const collector = initGlobalMetrics(config.metrics);
    const reporter = new MetricsReporter(collector, config.metrics);
    reporter.start();

    const engine = new ProxyEngine(config);
    await engine.start();

    const adminServer = new AdminServer(config, engine.cacheManager);
    adminServer.start();

    const transport = createTransport(engine);
    transport.start();

    const shutdown = async () => {
      logger.info("🛑 Сигнал завершения получен. Закрытие служб...");
      reporter.stop();
      await adminServer.stop();
      await engine.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    logger.info("✅ MCP Context Optimizer запущен!");

  } catch (err) {
    console.error("❌ Фатальная ошибка при запуске MCP Context Optimizer:");
    console.error(err);
    process.exit(1);
  }
}

main();
