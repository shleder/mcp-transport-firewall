import type { ServerResponse } from "node:http";
import { HTTP_STATUS } from "../../constants.js";
import type { ProxyConfig } from "../../config/schema.js";

export function handleConfig(res: ServerResponse, config: ProxyConfig): void {
  
  const safeConfig = JSON.parse(JSON.stringify(config)) as ProxyConfig;

  if (safeConfig.admin?.token) {
    safeConfig.admin.token = "********";
  }

  if (safeConfig.target?.env) {
    for (const key of Object.keys(safeConfig.target.env)) {
      if (key.toLowerCase().includes("token") || key.toLowerCase().includes("key") || key.toLowerCase().includes("secret")) {
        safeConfig.target.env[key] = "********";
      }
    }
  }

  res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
  res.end(JSON.stringify(safeConfig));
}
