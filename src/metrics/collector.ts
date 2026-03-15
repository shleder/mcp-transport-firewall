import { Counter } from "./counters.js";
import { Histogram } from "./histograms.js";
import type { MetricsConfig } from "../config/schema.js";

export class MetricsCollector {
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  constructor(private readonly config: MetricsConfig) {}

  createCounter(name: string, help: string): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }
    const c = new Counter(name, help);
    this.counters.set(name, c);
    return c;
  }

  createHistogram(name: string, help: string, bounds?: number[]): Histogram {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }
    const h = new Histogram(name, help, bounds);
    this.histograms.set(name, h);
    return h;
  }

  getAllMetrics(): Record<string, unknown> {
    if (!this.config.enabled) return { disabled: true };

    const cObj: Record<string, number> = {};
    for (const [name, counter] of this.counters.entries()) {
      cObj[name] = counter.get();
    }

    const hObj: Record<string, unknown> = {};
    for (const [name, hist] of this.histograms.entries()) {
      hObj[name] = hist.get();
    }

    return {
      uptime_seconds: process.uptime(),
      counters: cObj,
      histograms: hObj,
    };
  }

  resetAll(): void {
    for (const c of this.counters.values()) c.reset();
    for (const h of this.histograms.values()) h.reset();
  }
}

let globalCollector: MetricsCollector | null = null;

export function initGlobalMetrics(config: MetricsConfig): MetricsCollector {
  globalCollector = new MetricsCollector(config);
  return globalCollector;
}

export function getMetrics(): MetricsCollector {
  if (!globalCollector) {
    
    globalCollector = new MetricsCollector({ enabled: false, prometheus: false, flushIntervalMs: 5000 });
  }
  return globalCollector;
}
