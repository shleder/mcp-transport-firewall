import type { ProxyEngine } from "../proxy/engine.js";
import { StdioTransport } from "./stdio.js";
import { logger } from "../logger.js";

export function createTransport(engine: ProxyEngine): StdioTransport {
  
  logger.debug("Initializing transport: stdio");
  return new StdioTransport(engine);
}
