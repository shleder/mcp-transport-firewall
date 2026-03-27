import { getCache } from '../cache/index.js';
import { getPreflightStats } from '../middleware/preflight-validator.js';
import { getAllCircuitBreakerStats } from '../proxy/circuit-breaker.js';
import { getRegisteredRoutes } from '../proxy/router.js';
import { getBlockedRequestMetrics } from '../utils/auditLogger.js';

interface MetricLineOptions {
  labels?: Record<string, string>;
  value: number;
}

const runtimeCounters = {
  httpRequestsTotal: 0,
  stdioRequestsTotal: 0,
};

const sanitizeMetricLabel = (value: string): string => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
};

const renderMetric = (name: string, help: string, type: 'counter' | 'gauge', options: MetricLineOptions): string[] => {
  const labelEntries = Object.entries(options.labels ?? {});
  const labelSuffix = labelEntries.length === 0
    ? ''
    : `{${labelEntries
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}="${sanitizeMetricLabel(value)}"`)
        .join(',')}}`;

  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
    `${name}${labelSuffix} ${options.value}`,
  ];
};

const renderMetricSeries = (
  name: string,
  help: string,
  type: 'counter' | 'gauge',
  series: MetricLineOptions[],
): string[] => {
  const lines = [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
  ];

  for (const item of series) {
    const labelEntries = Object.entries(item.labels ?? {});
    const labelSuffix = labelEntries.length === 0
      ? ''
      : `{${labelEntries
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `${key}="${sanitizeMetricLabel(value)}"`)
          .join(',')}}`;

    lines.push(`${name}${labelSuffix} ${item.value}`);
  }

  return lines;
};

export const recordHttpMcpRequest = (): void => {
  runtimeCounters.httpRequestsTotal += 1;
};

export const recordStdioMcpRequest = (): void => {
  runtimeCounters.stdioRequestsTotal += 1;
};

export const resetRuntimeMetrics = (): void => {
  runtimeCounters.httpRequestsTotal = 0;
  runtimeCounters.stdioRequestsTotal = 0;
};

export const renderPrometheusMetrics = (): string => {
  const lines: string[] = [];
  const blockedRequests = getBlockedRequestMetrics();
  const cacheStats = getCache()?.getStats();
  const preflightStats = getPreflightStats();
  const circuitBreakers = getAllCircuitBreakerStats();

  lines.push(
    ...renderMetric(
      'mcp_firewall_http_requests_total',
      'Total HTTP /mcp requests observed by the MCP transport firewall.',
      'counter',
      { value: runtimeCounters.httpRequestsTotal },
    ),
    ...renderMetric(
      'mcp_firewall_stdio_requests_total',
      'Total stdio JSON-RPC requests observed by the MCP transport firewall.',
      'counter',
      { value: runtimeCounters.stdioRequestsTotal },
    ),
    ...renderMetric(
      'mcp_firewall_blocked_requests_total',
      'Total requests blocked by fail-closed trust gates.',
      'counter',
      { value: blockedRequests.total },
    ),
    ...renderMetric(
      'mcp_firewall_registered_routes',
      'Current number of registered downstream HTTP tool routes.',
      'gauge',
      { value: getRegisteredRoutes().size },
    ),
    ...renderMetric(
      'mcp_firewall_preflight_pending',
      'Current number of registered but unused preflight IDs.',
      'gauge',
      { value: preflightStats.pending },
    ),
    ...renderMetric(
      'mcp_firewall_preflight_consumed',
      'Current number of consumed preflight IDs still retained for replay protection.',
      'gauge',
      { value: preflightStats.consumed },
    ),
    ...renderMetric(
      'mcp_firewall_circuit_breakers_total',
      'Current number of circuit breakers managed by the firewall.',
      'gauge',
      { value: circuitBreakers.length },
    ),
    ...renderMetric(
      'mcp_firewall_circuit_breakers_open',
      'Current number of OPEN circuit breakers.',
      'gauge',
      { value: circuitBreakers.filter((breaker) => breaker.state === 'OPEN').length },
    ),
    ...renderMetric(
      'mcp_firewall_circuit_breakers_half_open',
      'Current number of HALF_OPEN circuit breakers.',
      'gauge',
      { value: circuitBreakers.filter((breaker) => breaker.state === 'HALF_OPEN').length },
    ),
    ...renderMetric(
      'mcp_firewall_circuit_breakers_closed',
      'Current number of CLOSED circuit breakers.',
      'gauge',
      { value: circuitBreakers.filter((breaker) => breaker.state === 'CLOSED').length },
    ),
    ...renderMetric(
      'mcp_firewall_cache_hits_total',
      'Observed cache hits across L1 and L2.',
      'counter',
      { value: cacheStats?.hits.total ?? 0 },
    ),
    ...renderMetric(
      'mcp_firewall_cache_misses_total',
      'Observed cache misses.',
      'counter',
      { value: cacheStats?.misses ?? 0 },
    ),
    ...renderMetric(
      'mcp_firewall_cache_l1_entries',
      'Current number of L1 cache entries.',
      'gauge',
      { value: cacheStats?.l1.size ?? 0 },
    ),
    ...renderMetric(
      'mcp_firewall_cache_l2_entries',
      'Current number of L2 cache entries.',
      'gauge',
      { value: cacheStats?.l2.entries ?? 0 },
    ),
    ...renderMetric(
      'mcp_firewall_cache_l2_expired_entries',
      'Current number of expired L2 cache entries pending cleanup.',
      'gauge',
      { value: cacheStats?.l2.expiredEntries ?? 0 },
    ),
  );

  if (blockedRequests.byCode.length > 0) {
    lines.push(
      ...renderMetricSeries(
        'mcp_firewall_blocked_requests_by_code_total',
        'Blocked requests grouped by denial code.',
        'counter',
        blockedRequests.byCode.map((item) => ({
          labels: { code: item.code },
          value: item.count,
        })),
      ),
    );
  }

  return lines.join('\n') + '\n';
};
