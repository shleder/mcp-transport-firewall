export interface CliOptions {
  targetCommand?: string;
  targetArgs: string[];
  verbose: boolean;
  help: boolean;
}

export interface ResolvedTarget {
  targetCommand: string;
  targetArgs: string[];
}

const splitCommandString = (value: string): string[] => {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return matches.map((part) => part.replace(/^"|"$/g, ''));
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

export const resolveTarget = (
  cli: CliOptions,
  env: NodeJS.ProcessEnv = process.env,
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
  if (!fullCommand) {
    return undefined;
  }

  const parsed = splitCommandString(fullCommand);
  if (parsed.length === 0) {
    return undefined;
  }

  return {
    targetCommand: parsed[0],
    targetArgs: parsed.slice(1),
  };
};
