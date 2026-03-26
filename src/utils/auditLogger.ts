import fs from 'fs';
import dgram from 'node:dgram';
import path from 'path';

const logFilePath = path.join(process.cwd(), 'audit.log');

export type AuditEvent = {
  timestamp: string;
  event: string;
  ip?: string;
  reason?: string;
  [key: string]: unknown;
};

export interface BlockedRequestReasonCount {
  code: string;
  count: number;
}

export interface BlockedRequestSample {
  timestamp: string;
  event: string;
  code: string;
  reason?: string;
  ip?: string;
  path?: string;
}

export interface BlockedRequestMetrics {
  total: number;
  lastBlockedAt: string | null;
  byCode: BlockedRequestReasonCount[];
  recent: BlockedRequestSample[];
}

const blockedRequestCodes = new Set([
  'ADMIN_NOT_CONFIGURED',
  'AUTH_FAILURE',
  'CIRCUIT_OPEN',
  'CROSS_TOOL_HIJACK',
  'CROSS_TOOL_HIJACK_SESSION',
  'ETT_TRIGGER',
  'FIREWALL_BLOCK',
  'INVALID_MCP_REQUEST',
  'INVALID_REQUEST',
  'MISSING_SCOPE',
  'PREFLIGHT_NOT_FOUND',
  'PREFLIGHT_REPLAY_BLOCKED',
  'PREFLIGHT_REQUIRED',
  'RATE_LIMIT_EXCEEDED',
  'SCHEMA_VALIDATION_FAILURE',
  'SCHEMA_VALIDATION_FAILED',
  'TARGET_UNREACHABLE',
  'UNKNOWN_ROUTE',
  'UNAUTHORIZED',
]);

const blockedMetricsState = {
  total: 0,
  lastBlockedAt: null as string | null,
  byCode: new Map<string, number>(),
  recent: [] as BlockedRequestSample[],
  recentLimit: 10,
};

const createEntry = (timestamp: string, event: string, details: Record<string, unknown>): string => {
  return JSON.stringify({
    timestamp,
    event,
    ...details,
  });
};

const getBlockedRequestCode = (event: string, details: Record<string, unknown>): string | null => {
  if (typeof details.code === 'string' && details.code.length > 0) {
    return details.code;
  }

  if (blockedRequestCodes.has(event)) {
    return event;
  }

  return null;
};

const recordBlockedRequest = (timestamp: string, event: string, details: Record<string, unknown>): void => {
  const code = getBlockedRequestCode(event, details);
  if (!code) {
    return;
  }

  blockedMetricsState.total += 1;
  blockedMetricsState.lastBlockedAt = timestamp;
  blockedMetricsState.byCode.set(code, (blockedMetricsState.byCode.get(code) ?? 0) + 1);
  blockedMetricsState.recent.unshift({
    timestamp,
    event,
    code,
    reason: typeof details.reason === 'string' ? details.reason : undefined,
    ip: typeof details.ip === 'string' ? details.ip : undefined,
    path: typeof details.path === 'string' ? details.path : undefined,
  });

  if (blockedMetricsState.recent.length > blockedMetricsState.recentLimit) {
    blockedMetricsState.recent.length = blockedMetricsState.recentLimit;
  }
};

export const auditLog = (event: string, details: Record<string, unknown>): void => {
  const timestamp = new Date().toISOString();
  const entry = createEntry(timestamp, event, details) + '\n';
  fs.appendFileSync(logFilePath, entry, { flag: 'a' });
  process.stderr.write(`[AUDIT] ${entry}`);
  recordBlockedRequest(timestamp, event, details);
};

export const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  auditLog(event, details);
};

export const writeStderrLog = (event: string, details: Record<string, unknown>): void => {
  const timestamp = new Date().toISOString();
  const entry = createEntry(timestamp, event, details);
  process.stderr.write(`[AUDIT] ${entry}\n`);
  recordBlockedRequest(timestamp, event, details);
};

export interface SIEMConfig {
  enabled: boolean;
  format: 'CEF' | 'SYSLOG';
  host: string;
  port: number;
}

let siemConfig: SIEMConfig = {
  enabled: false,
  format: 'SYSLOG',
  host: 'localhost',
  port: 514,
};

export const getSIEMConfig = (): SIEMConfig => {
  return { ...siemConfig };
};

export const configureSIEM = (config: Partial<SIEMConfig>): void => {
  siemConfig = { ...siemConfig, ...config };
};

const formatCEF = (event: AuditEvent): string => {
  const severity = event.event.includes('BLOCK') || event.event.includes('VIOLATION') ? 8 : 5;
  const deviceVendor = 'MCP-FIREWALL';
  const deviceProduct = 'mcp-proxy-firewall';
  const deviceVersion = '2.0.0';
  const extension = Object.entries(event)
    .filter(([key]) => key !== 'timestamp')
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  
  return `CEF:${severity}|${deviceVendor}|${deviceProduct}|${deviceVersion}|${event.event}|${event.event}|${extension}`;
};

const formatSYSLOG = (event: AuditEvent): string => {
  const priority = 134;
  const timestamp = event.timestamp;
  const hostname = 'mcp-firewall';
  const appName = 'proxy';
  const msg = Object.entries(event)
    .map(([key, value]) => `${key}="${JSON.stringify(value)}"`)
    .join(' ');
  
  return `<${priority}>${timestamp} ${hostname} ${appName}: ${event.event} ${msg}`;
};

export const exportToSIEM = (event: AuditEvent): void => {
  if (!siemConfig.enabled) return;

  const formatted = siemConfig.format === 'CEF' 
    ? formatCEF(event) 
    : formatSYSLOG(event);

  if (process.env.NODE_ENV === 'production') {
    const client = dgram.createSocket('udp4');
    
    client.send(formatted, siemConfig.port, siemConfig.host, (err: Error | null) => {
      if (err) {
        process.stderr.write(`[SIEM ERROR] ${err.message}\n`);
      }
      client.close();
    });
  } else {
    process.stderr.write(`[SIEM] ${formatted}\n`);
  }
};

export const auditLogWithSIEM = (event: string, details: Record<string, unknown>): void => {
  auditLog(event, details);
  exportToSIEM({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  } as AuditEvent);
};

export const getBlockedRequestMetrics = (): BlockedRequestMetrics => {
  return {
    total: blockedMetricsState.total,
    lastBlockedAt: blockedMetricsState.lastBlockedAt,
    byCode: Array.from(blockedMetricsState.byCode.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.code.localeCompare(right.code);
      }),
    recent: [...blockedMetricsState.recent],
  };
};

export const resetBlockedRequestMetrics = (): void => {
  blockedMetricsState.total = 0;
  blockedMetricsState.lastBlockedAt = null;
  blockedMetricsState.byCode.clear();
  blockedMetricsState.recent.length = 0;
};
