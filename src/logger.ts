const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

const prefix = () =>
  `${DIM}[${new Date().toISOString()}]${RESET}`;

export function initLogger(config: { level?: string; format?: string; verbose?: boolean }): void {
  
}

export const logger = {
  debug: (msg: string) => process.stderr.write(`${prefix()} ${CYAN}🐛 ${RESET}${msg}\n`),
  info: (msg: string) =>
    process.stderr.write(`${prefix()} ${CYAN}ℹ ${RESET}${msg}\n`),

  success: (msg: string) =>
    process.stderr.write(`${prefix()} ${GREEN}✓ ${RESET}${msg}\n`),

  warn: (msg: string) =>
    process.stderr.write(`${prefix()} ${YELLOW}⚠ ${RESET}${msg}\n`),

  error: (msg: string, err?: unknown) => {
    process.stderr.write(`${prefix()} ${RED}✗ ${RESET}${msg}\n`);
    if (err instanceof Error) {
      process.stderr.write(`${DIM}  ${err.stack ?? err.message}${RESET}\n`);
    }
  },

  proxy: (direction: "→" | "←", method: string) =>
    process.stderr.write(
      `${prefix()} ${BLUE}${BOLD}${direction}${RESET} ${MAGENTA}${method}${RESET}\n`
    ),

  cacheHit: (source: "L1" | "L2", method: string, tokensSaved: number, latencyMs: number) =>
    process.stderr.write(
      `${prefix()} ${GREEN}${BOLD} Cache Hit!${RESET} [${CYAN}${source}${RESET}] ${MAGENTA}${method}${RESET}\n` +
      `          ${GREEN}Estimated Tokens Saved: ~${tokensSaved}${RESET}\n` +
      `          ${CYAN}⏱ Latency: ${latencyMs} ms${RESET}\n`
    ),

  cacheMiss: (method: string) =>
    process.stderr.write(
      `${prefix()} ${YELLOW}⟳ Cache Miss${RESET} — проксирую: ${MAGENTA}${method}${RESET}\n`
    ),
};
