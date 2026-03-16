import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ProxyConfigSchema, type ProxyConfig } from "./schema.js";
import { readEnvConfig, getDetectedEnvVars } from "./env.js";
import { validateConfig } from "./validator.js";
import { ConfigurationError } from "../errors.js";
import { logger } from "../logger.js";

export interface LoadConfigOptions {
  cliArgs: string[];
  configFile?: string;
  ignoreEnv?: boolean;
  skipValidation?: boolean;
}

function findConfigFile(): string | undefined {
  const candidates = [
    "mcp-optimizer.json",
    ".mcp-optimizer.json",
    "mcp-optimizer.config.json",
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return undefined;
}

function loadJsonConfig(filePath: string): Partial<ProxyConfig> {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    throw new ConfigurationError(`Configuration file not found: ${absPath}`);
  }
  try {
    const raw = readFileSync(absPath, "utf-8");
    return JSON.parse(raw) as Partial<ProxyConfig>;
  } catch (err) {
    throw new ConfigurationError(
      `Unable to read configuration file: ${absPath}`,
      err
    );
  }
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideVal = override[key];
    if (overrideVal === undefined) continue;
    const baseVal = base[key];
    if (
      typeof overrideVal === "object" &&
      overrideVal !== null &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === "object" &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = overrideVal as T[keyof T];
    }
  }
  return result;
}

interface CliResult {
  targetCommand: string;
  targetArgs: string[];
  configFile?: string;
  verbose?: boolean;
  adminOnly?: boolean;
}

function parseCommandStr(cmdString: string): string[] {
  const regex = /([^\s"']+)|"([^"]*)"|'([^']*)'/g;
  const result: string[] = [];
  let match;
  while ((match = regex.exec(cmdString)) !== null) {
    if (match[2]) {
      result.push(match[2]);
    } else if (match[3]) {
      result.push(match[3]);
    } else {
      result.push(match[1]);
    }
  }
  return result;
}

function parseCli(args: string[]): CliResult {
  let configFile: string | undefined;
  let verbose: boolean | undefined;
  let adminOnly = false;
  let targetString: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--config" || arg === "-c") {
      i++;
      if (i < args.length) configFile = args[i];
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--admin-only") {
      adminOnly = true;
    } else if (arg === "--target" || arg === "-t") {
      i++;
      if (i < args.length) targetString = args[i];
    }
    i++;
  }

  let targetCommand = "";
  let targetArgs: string[] = [];

  if (targetString) {
    const parsed = parseCommandStr(targetString);
    if (parsed.length > 0) {
      targetCommand = parsed[0];
      targetArgs = parsed.slice(1);
    }
  }

  if (!targetCommand && !adminOnly) {
    throw new ConfigurationError(
      "Target MCP server command not specified. " +
      "Usage: mcp-optimizer --target \"command [args...]\" [--config file]\n" +
      "  Or: mcp-optimizer --admin-only --config file"
    );
  }

  return { targetCommand, targetArgs, configFile, verbose, adminOnly };
}

export function loadConfig(options: LoadConfigOptions): ProxyConfig {
  const { cliArgs, configFile: optConfigFile, ignoreEnv, skipValidation } = options;

  const cli = parseCli(cliArgs);

  const resolvedConfigFile = optConfigFile ?? cli.configFile ?? findConfigFile();

  let fileConfig: Partial<ProxyConfig> = {};
  if (resolvedConfigFile) {
    fileConfig = loadJsonConfig(resolvedConfigFile);
    logger.info(`Loaded configuration from file: ${resolvedConfigFile}`);
  }

  const envConfig = ignoreEnv ? null : readEnvConfig();

  const rawConfig = {
    target: {
      command: cli.targetCommand || "echo",
      args: cli.targetArgs,
    },
    cache: deepMerge(
      (fileConfig.cache ?? {}) as Record<string, unknown>,
      (envConfig?.cache ?? {}) as Record<string, unknown>
    ),
    admin: deepMerge(
      (fileConfig.admin ?? {}) as Record<string, unknown>,
      (envConfig?.admin ?? {}) as Record<string, unknown>
    ),
    metrics: deepMerge(
      (fileConfig.metrics ?? {}) as Record<string, unknown>,
      (envConfig?.metrics ?? {}) as Record<string, unknown>
    ),
    logging: deepMerge(
      (fileConfig.logging ?? {}) as Record<string, unknown>,
      (envConfig?.logging ?? {}) as Record<string, unknown>
    ),
    retry: deepMerge(
      (fileConfig.retry ?? {}) as Record<string, unknown>,
      (envConfig?.retry ?? {}) as Record<string, unknown>
    ),
    timeout: deepMerge(
      (fileConfig.timeout ?? {}) as Record<string, unknown>,
      (envConfig?.timeout ?? {}) as Record<string, unknown>
    ),
    rateLimiter: deepMerge(
      (fileConfig.rateLimiter ?? {}) as Record<string, unknown>,
      (envConfig?.rateLimiter ?? {}) as Record<string, unknown>
    ),
    circuitBreaker: deepMerge(
      (fileConfig.circuitBreaker ?? {}) as Record<string, unknown>,
      (envConfig?.circuitBreaker ?? {}) as Record<string, unknown>
    ),
    verbose: cli.verbose ?? envConfig?.verbose ?? fileConfig.verbose,
  };

  const parseResult = ProxyConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigurationError(
      `Invalid configuration:\n${issues}`,
      parseResult.error.issues
    );
  }

  const config = parseResult.data;

  if (config.verbose) {
    config.logging.level = "debug";
  }

  if (!skipValidation) {
    validateConfig(config);
  }

  if (config.verbose && !ignoreEnv) {
    const detected = getDetectedEnvVars();
    if (Object.keys(detected).length > 0) {
      logger.info(`Detected environment variables: ${JSON.stringify(detected)}`);
    }
  }

  return config;
}
