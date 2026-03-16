import type { MetricsCollector } from "./collector.js";

export function formatPrometheus(collector: MetricsCollector): string {
  const metrics = collector.getAllMetrics();
  if (metrics.disabled) {
    return "# HELP mcp_optimizer_metrics_enabled Metrics collection is disabled in configuration.\n" +
           "# TYPE mcp_optimizer_metrics_enabled gauge\n" +
           "mcp_optimizer_metrics_enabled 0\n";
  }

  const lines: string[] = [];
  const prefix = "mcp_optimizer_";

  lines.push(`# HELP ${prefix}uptime_seconds Process uptime in seconds.`);
  lines.push(`# TYPE ${prefix}uptime_seconds gauge`);
  lines.push(`${prefix}uptime_seconds ${metrics.uptime_seconds}`);
  lines.push("");

  const counters = metrics.counters as Record<string, number>;
  for (const [name, value] of Object.entries(counters)) {

    const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`# HELP ${prefix}${safeName} Total counter for ${name}`);
    lines.push(`# TYPE ${prefix}${safeName} counter`);
    lines.push(`${prefix}${safeName} ${value}`);
  }
  lines.push("");

  const histograms = metrics.histograms as Record<string, { sum: number; count: number; buckets: Record<string, number> }>;
  for (const [name, data] of Object.entries(histograms)) {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`# HELP ${prefix}${safeName} Histogram for ${name}`);
    lines.push(`# TYPE ${prefix}${safeName} histogram`);

    lines.push(`${prefix}${safeName}_sum ${data.sum}`);
    lines.push(`${prefix}${safeName}_count ${data.count}`);

    let cumulative = 0;

    const bounds = Object.keys(data.buckets)
      .map(k => k === "+Inf" ? Infinity : Number(k))
      .sort((a, b) => a - b);
      
    for (const bound of bounds) {
      const boundKey = bound === Infinity ? "+Inf" : String(bound);
      const val = data.buckets[boundKey] ?? 0;
      cumulative += val;
      const le = bound === Infinity ? "+Inf" : String(bound);
      lines.push(`${prefix}${safeName}_bucket{le="${le}"} ${cumulative}`);
    }
  }

  return lines.join("\n") + "\n";
}
