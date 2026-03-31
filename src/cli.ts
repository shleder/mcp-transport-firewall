#!/usr/bin/env node

import 'dotenv/config';
import { parseCliArgs, resolveTarget } from './cli-options.js';
import { startEmbeddedMcpServer } from './embedded/server.js';
import { resolveProxyRuntimeConfig } from './runtime-config.js';
import { createStdioFirewallProxy } from './stdio/proxy.js';

const printHelp = (): void => {
  process.stdout.write(`MCP Transport Firewall

Usage:
  mcp-transport-firewall
  mcp-transport-firewall -- node target.js
  mcp-transport-firewall --target "node target.js"

Modes:
  no target supplied      start the bundled standalone MCP server
  target supplied         wrap a downstream MCP server behind the fail-closed stdio firewall

Standalone tools:
  firewall_status         runtime status and deployment flags
  firewall_usage          launch guidance for standalone and downstream proxy mode

Environment:
  PROXY_AUTH_TOKEN        Optional NHI secret for fail-closed auth
  MCP_TARGET_COMMAND      Protected target command for MCP client configs
  MCP_TARGET_ARGS_JSON    JSON array of target args for MCP_TARGET_COMMAND
  MCP_TARGET_ARGS         Space-delimited fallback for target args
  MCP_TARGET              Full target command string fallback
  MCP_TARGET_TIMEOUT_MS   Downstream response timeout in milliseconds
  MCP_ADMIN_ENABLED       Start admin API/dashboard when set to true
  MCP_ADMIN_PORT          Admin API port, default 9090
  MCP_CACHE_DIR           Persistent cache directory
  MCP_CACHE_TTL_SECONDS   Persistent cache TTL in seconds
`);
};

const main = async (): Promise<void> => {
  const cli = parseCliArgs(process.argv.slice(2));

  if (cli.help) {
    printHelp();
    return;
  }

  if (cli.embeddedTarget) {
    await startEmbeddedMcpServer();
    return;
  }

  const target = resolveTarget(cli);
  const runtimeConfig = resolveProxyRuntimeConfig(process.env);

  if (!target) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const proxy = createStdioFirewallProxy({
    targetCommand: target.targetCommand,
    targetArgs: target.targetArgs,
    adminEnabled: process.env.MCP_ADMIN_ENABLED === 'true' || process.env.ADMIN_ENABLED === 'true',
    adminPort: runtimeConfig.adminPort,
    cacheDir: process.env.MCP_CACHE_DIR ?? process.env.CACHE_DIR,
    cacheTtlSeconds: runtimeConfig.cacheTtlSeconds,
    targetTimeoutMs: runtimeConfig.targetTimeoutMs,
    verbose: cli.verbose || process.env.MCP_VERBOSE === 'true' || process.env.VERBOSE === 'true',
    proxyAuthToken: process.env.PROXY_AUTH_TOKEN,
  });

  const shutdown = async (): Promise<void> => {
    await proxy.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  await proxy.start();
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(message + '\n');
  process.exit(1);
});
