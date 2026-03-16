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

    logger.debug("Setting up environment...");

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
      logger.info("Shutdown signal received. Closing services...");
      reporter.stop();
      await adminServer.stop();
      await engine.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    logger.info("MCP Context Optimizer started!");

  } catch (err) {
    console.error("Fatal error during MCP Context Optimizer startup:");
    console.error(err);
    process.exit(1);
  }
}

main();
