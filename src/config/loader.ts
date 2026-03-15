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
    throw new ConfigurationError(`Файл конфигурации не найден: ${absPath}`);
  }
  try {
    const raw = readFileSync(absPath, "utf-8");
    return JSON.parse(raw) as Partial<ProxyConfig>;
  } catch (err) {
    throw new ConfigurationError(
      `Невозможно прочитать файл конфигурации: ${absPath}`,
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
}

function parseCli(args: string[]): CliResult {
  const remaining: string[] = [];
  let configFile: string | undefined;
  let verbose: boolean | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--config" || arg === "-c") {
      i++;
      configFile = args[i];
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else {
      remaining.push(arg);
    }
    i++;
  }

  const [targetCommand = "", ...targetArgs] = remaining;

  if (!targetCommand) {
    throw new ConfigurationError(
      "Не указана команда целевого MCP-сервера. " +
      "Использование: mcp-optimizer [--config file] <command> [args...]"
    );
  }

  return { targetCommand, targetArgs, configFile, verbose };
}

export function loadConfig(options: LoadConfigOptions): ProxyConfig {
  const { cliArgs, configFile: optConfigFile, ignoreEnv, skipValidation } = options;

  const cli = parseCli(cliArgs);

  const resolvedConfigFile = optConfigFile ?? cli.configFile ?? findConfigFile();

  let fileConfig: Partial<ProxyConfig> = {};
  if (resolvedConfigFile) {
    fileConfig = loadJsonConfig(resolvedConfigFile);
    logger.info(`📄 Загружена конфигурация из файла: ${resolvedConfigFile}`);
  }

  const envConfig = ignoreEnv ? null : readEnvConfig();

  const rawConfig = {
    target: {
      command: cli.targetCommand,
      args: cli.targetArgs,
    },
    
    cache: deepMerge(
      deepMerge(
        (fileConfig.cache ?? {}) as Record<string, unknown>,
        (envConfig?.cache ?? {}) as Record<string, unknown>
      ),
      {} as Record<string, unknown>
    ),
    admin: deepMerge(
      deepMerge(
        (fileConfig.admin ?? {}) as Record<string, unknown>,
        (envConfig?.admin ?? {}) as Record<string, unknown>
      ),
      {} as Record<string, unknown>
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
      `Неверная конфигурация:\n${issues}`,
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
      logger.info(`🔧 Обнаруженные ENV-переменные: ${JSON.stringify(detected)}`);
    }
  }

  return config;
}
