import { describe, expect, it } from '@jest/globals';
import { parseCliArgs, resolveTarget } from '../src/cli-options.js';

describe('cli target resolution', () => {
  it('rejects unknown flags instead of treating them as a target command', () => {
    expect(() => parseCliArgs(['--wat'])).toThrow('Unknown option: --wat');
  });

  it('resolves a protected target from environment variables when no explicit target args are provided', () => {
    const cli = parseCliArgs([]);

    const target = resolveTarget(cli, {
      MCP_TARGET_COMMAND: 'node',
      MCP_TARGET_ARGS_JSON: JSON.stringify(['examples/demo-target.js']),
    });

    expect(target).toEqual({
      targetCommand: 'node',
      targetArgs: ['examples/demo-target.js'],
    });
  });

  it('lets explicit cli target args override env-based target resolution', () => {
    const cli = parseCliArgs(['--target', 'python server.py']);

    const target = resolveTarget(cli, {
      MCP_TARGET_COMMAND: 'node',
      MCP_TARGET_ARGS_JSON: JSON.stringify(['examples/demo-target.js']),
    });

    expect(target).toEqual({
      targetCommand: 'python',
      targetArgs: ['server.py'],
    });
  });

  it('preserves quoted Windows-style paths in --target strings', () => {
    const cli = parseCliArgs(['--target', '"C:\\Program Files\\nodejs\\node.exe" "C:\\Tools\\demo server.js"']);

    expect(cli).toEqual({
      targetCommand: 'C:\\Program Files\\nodejs\\node.exe',
      targetArgs: ['C:\\Tools\\demo server.js'],
      verbose: false,
      help: false,
      embeddedTarget: false,
    });
  });

  it('falls back to the bundled standalone MCP target when no downstream target is configured', () => {
    const cli = parseCliArgs([]);

    const target = resolveTarget(cli, {}, {
      command: process.execPath,
      execArgv: ['--no-warnings'],
      entryScript: '/virtual/dist/cli.js',
    });

    expect(target).toEqual({
      targetCommand: process.execPath,
      targetArgs: ['--no-warnings', '/virtual/dist/cli.js', '--embedded-target'],
    });
  });
});
