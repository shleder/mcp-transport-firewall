import type { IncomingMessage, ServerResponse } from "node:http";

export interface CorsOptions {
  enabled: boolean;
  origins: string[];
}

export function applyCors(req: IncomingMessage, res: ServerResponse, options: CorsOptions): boolean {
  if (!options.enabled) return false;

  const origin = req.headers.origin;

  let allowedOrigin = "";
  if (options.origins.includes("*")) {
    allowedOrigin = "*";
  } else if (origin && options.origins.includes(origin)) {
    allowedOrigin = origin;
  }

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400"); 
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}
