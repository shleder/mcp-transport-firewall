import fs from 'fs';
import path from 'path';

const logFilePath = path.join(process.cwd(), 'audit.log');

export const auditLog = (event: string, details: Record<string, unknown>) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details
  }) + '\n';
  
  // Append-only audit log
  fs.appendFileSync(logFilePath, entry, { flag: 'a' });
};
