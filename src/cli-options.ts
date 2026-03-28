export interface CliOptions {
  targetCommand?: string;
  targetArgs: string[];
  verbose: boolean;
  help: boolean;
  embeddedTarget: boolean;
}

export interface ResolvedTarget {
  targetCommand: string;
  targetArgs: string[];
}

export interface ResolveTargetRuntime {
  command: string;
  execArgv: string[];
  entryScript?: string;
}

const splitCommandString = (value: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quote === "'") {
      if (character === "'") {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (quote === '"') {
      if (character === '"') {
        quote = null;
        continue;
      }

      if (character === '\\') {
        const next = value[index + 1];
        if (next === '"' || next === '\\') {
          current += next;
          index += 1;
          continue;
        }
      }

      current += character;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (quote) {
    throw new Error('Invalid target command: unmatched quote');
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
};

const parseJsonArgs = (value: string): string[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Invalid MCP_TARGET_ARGS_JSON: ${message}`);
  }

  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string')) {
    throw new Error('Invalid MCP_TARGET_ARGS_JSON: expected a JSON array of strings');
  }

  return parsed;
};

export const parseCliArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    targetArgs: [],
    verbose: false,
    help: false,
    embeddedTarget: false,
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

    if (arg === '--embedded-target') {
      options.embeddedTarget = true;
      continue;
    }

    if (arg === '--target' || arg === '-t') {
      const next = args[i + 1];
      if (!next) {
        throw new Error('Missing value for --target');
      }
      const parsed = splitCommandString(next);
      if (parsed.length === 0) {
        throw new Error('Invalid value for --target');
      }
      options.targetCommand = parsed[0];
      options.targetArgs = parsed.slice(1);
      i += 1;
      continue;
    }

    if (arg === '--') {
      const rest = args.slice(i + 1);
      if (rest.length === 0) {
        throw new Error('Missing target command after --');
      }
      options.targetCommand = rest[0];
      options.targetArgs = rest.slice(1);
      break;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (!options.targetCommand) {
      options.targetCommand = arg;
    } else {
      options.targetArgs.push(arg);
    }
  }

  return options;
};

export const resolveTarget = (
  cli: CliOptions,
  env: NodeJS.ProcessEnv = process.env,
  runtime: ResolveTargetRuntime = {
    command: process.execPath,
    execArgv: [...process.execArgv],
    entryScript: process.argv[1],
  },
): ResolvedTarget | undefined => {
  if (cli.targetCommand) {
    return {
      targetCommand: cli.targetCommand,
      targetArgs: cli.targetArgs,
    };
  }

  const envCommand = env.MCP_TARGET_COMMAND?.trim();
  if (envCommand) {
    if (env.MCP_TARGET_ARGS_JSON) {
      return {
        targetCommand: envCommand,
        targetArgs: parseJsonArgs(env.MCP_TARGET_ARGS_JSON),
      };
    }

    if (env.MCP_TARGET_ARGS?.trim()) {
      return {
        targetCommand: envCommand,
        targetArgs: splitCommandString(env.MCP_TARGET_ARGS),
      };
    }

    return {
      targetCommand: envCommand,
      targetArgs: [],
    };
  }

  const fullCommand = env.MCP_TARGET?.trim();
  if (fullCommand) {
    const parsed = splitCommandString(fullCommand);
    if (parsed.length === 0) {
      return undefined;
    }

    return {
      targetCommand: parsed[0],
      targetArgs: parsed.slice(1),
    };
  }

  const entryScript = runtime.entryScript?.trim();
  if (!entryScript) {
    return undefined;
  }

  return {
    targetCommand: runtime.command,
    targetArgs: [...runtime.execArgv, entryScript, '--embedded-target'],
  };
};
