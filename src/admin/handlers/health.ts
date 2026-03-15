import type { ServerResponse } from "node:http";
import { HTTP_STATUS } from "../../constants.js";

export function handleHealth(res: ServerResponse): void {
  const data = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  
  res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
