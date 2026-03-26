#!/usr/bin/env node

import 'dotenv/config';
import { StdioFirewallProxy } from './stdio/proxy.js';

interface CliOptions {
  targetCommand?: string;
  targetArgs: string[];
  verbose: boolean;
  help: boolean;
}

const splitCommandString = (value: string): string[] => {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return matches.map((part) => part.replace(/^"|"$/g, ''));
};

const parseCliArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    targetArgs: [],
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      break;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--target' || arg === '-t') {
      const next = args[i + 1];
      if (!next) {
        throw new Error('Missing value for --target');
      }
      const parsed = splitCommandString(next);
      options.targetCommand = parsed[0];
      options.targetArgs = parsed.slice(1);
      i += 1;
      continue;
    }

    if (arg === '--') {
      const rest = args.slice(i + 1);
      options.targetCommand = rest[0];
      options.targetArgs = rest.slice(1);
      break;
    }

    if (!options.targetCommand) {
      options.targetCommand = arg;
    } else {
      options.targetArgs.push(arg);
    }
  }

  return options;
};

const printHelp = (): void => {
  process.stdout.write(`MCP Transport Firewall

Usage:
  mcp-transport-firewall --target "node target.js"
  mcp-transport-firewall -- node target.js

Environment:
  PROXY_AUTH_TOKEN        Optional NHI secret for fail-closed auth
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

  if (!cli.targetCommand) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const proxy = new StdioFirewallProxy({
    targetCommand: cli.targetCommand,
    targetArgs: cli.targetArgs,
    adminEnabled: process.env.MCP_ADMIN_ENABLED === 'true' || process.env.ADMIN_ENABLED === 'true',
    adminPort: parseInt(process.env.MCP_ADMIN_PORT ?? process.env.ADMIN_PORT ?? '9090', 10),
    cacheDir: process.env.MCP_CACHE_DIR ?? process.env.CACHE_DIR,
    cacheTtlSeconds: parseInt(process.env.MCP_CACHE_TTL_SECONDS ?? process.env.CACHE_TTL_SECONDS ?? '300', 10),
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
