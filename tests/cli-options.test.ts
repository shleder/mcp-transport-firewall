import { describe, expect, it } from '@jest/globals';
import { parseCliArgs, resolveTarget } from '../src/cli-options.js';

describe('cli target resolution', () => {
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
});
