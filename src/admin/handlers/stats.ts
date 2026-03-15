import type { ServerResponse, IncomingMessage } from "node:http";
import { HTTP_STATUS } from "../../constants.js";
import { getMetrics } from "../../metrics/collector.js";
import { formatPrometheus } from "../../metrics/prometheus.js";
import type { CacheManager } from "../../cache/manager.js";

export function handleStats(req: IncomingMessage, res: ServerResponse, cacheManager: CacheManager): void {
  
  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
  const format = url.searchParams.get("format");

  if (format === "prometheus") {
    const text = formatPrometheus(getMetrics());
    res.writeHead(HTTP_STATUS.OK, { "Content-Type": "text/plain; version=0.0.4" });
    res.end(text);
    return;
  }

  const collectorStats = getMetrics().getAllMetrics();
  const cacheStats = cacheManager.getStats();

  const data = {
    ...collectorStats,
    cache: cacheStats
  };

  res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
