import type { MetricsCollector } from "./collector.js";
import { logger } from "../logger.js";
import type { MetricsConfig } from "../config/schema.js";

export class MetricsReporter {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly collector: MetricsCollector,
    private readonly config: MetricsConfig
  ) {}

  start(): void {
    if (!this.config.enabled) return;
    if (this.config.flushIntervalMs <= 0) return;

    this.timer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);

    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  flush(): void {
    const data = this.collector.getAllMetrics();

    logger.debug(`[Metrics Flush] Uptime: ${Math.round(data.uptime_seconds as number)}s. counters: ${JSON.stringify(data.counters)}`);
  }
}
