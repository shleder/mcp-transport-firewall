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

const createEntry = (event: string, details: Record<string, unknown>): string => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });
};

export const auditLog = (event: string, details: Record<string, unknown>): void => {
  const entry = createEntry(event, details) + '\n';
  fs.appendFileSync(logFilePath, entry, { flag: 'a' });
  process.stderr.write(`[AUDIT] ${entry}`);
};

export const writeAuditLog = (event: string, details: Record<string, unknown>): void => {
  auditLog(event, details);
};

export const writeStderrLog = (event: string, details: Record<string, unknown>): void => {
  const entry = createEntry(event, details);
  process.stderr.write(`[AUDIT] ${entry}\n`);
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
