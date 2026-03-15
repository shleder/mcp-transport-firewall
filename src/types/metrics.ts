export interface MetricDump {
  uptime_seconds: number;
  counters: Record<string, number>;
  histograms: Record<string, unknown>;
  disabled?: boolean;
}
