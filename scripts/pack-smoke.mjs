import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const demoTargetPath = path.join(repoRoot, 'examples', 'demo-target.js');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const cliName = packageJson.bin?.['mcp-transport-firewall'];

if (typeof cliName !== 'string') {
  console.error('Missing mcp-transport-firewall bin entry in package.json.');
  process.exit(1);
}

const packOutput = execSync('npm pack --json', {
  cwd: repoRoot,
  encoding: 'utf8',
});

let tarballName;

try {
  const parsed = JSON.parse(packOutput);
  tarballName = parsed?.[0]?.filename;
} catch (error) {
  console.error('Failed to parse npm pack output.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (typeof tarballName !== 'string' || tarballName.length === 0) {
  console.error('npm pack did not return a tarball filename.');
  process.exit(1);
}

const tarballPath = path.join(repoRoot, tarballName);
const quoteArg = (value) => {
  if (process.platform === 'win32') {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

const ensureSuccess = (label, args, env = {}, matcher) => {
  let stdout = '';
  let stderr = '';

  try {
    const command = [npxCommand, ...args.map((arg) => quoteArg(arg))].join(' ');
    stdout = execSync(command, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
      },
      encoding: 'utf8',
      timeout: 120000,
    });
  } catch (error) {
    console.error(`${label} failed.`);
    if (error && typeof error === 'object') {
      const childError = error;
      stdout = typeof childError.stdout === 'string' ? childError.stdout : stdout;
      stderr = typeof childError.stderr === 'string' ? childError.stderr : stderr;
      if (typeof childError.message === 'string') {
        console.error(childError.message);
      }
    } else {
      console.error(String(error));
    }
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    process.exit(1);
  }

  if (matcher && !matcher(stdout, stderr)) {
    console.error(`${label} succeeded but output did not match expectations.`);
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    process.exit(1);
  }
};

const ensureStandaloneMcpServer = async (tarballPath) => {
  const transport = new StdioClientTransport({
    command: npxCommand,
    args: ['--yes', `--package=${tarballPath}`, 'mcp-transport-firewall'],
    cwd: repoRoot,
    env: {
      ...process.env,
      MCP_ADMIN_ENABLED: 'false',
    },
    stderr: 'pipe',
  });

  const client = new Client(
    { name: 'pack-smoke', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    if (!toolNames.includes('firewall_status') || !toolNames.includes('firewall_usage')) {
      throw new Error(`Standalone mode did not expose the expected bundled tools. Saw: ${toolNames.join(', ')}`);
    }

    const status = await client.callTool({
      name: 'firewall_status',
      arguments: {},
    });

    const textBlock = status.content.find((item) => item.type === 'text');
    if (!textBlock || !textBlock.text.includes('standalone embedded MCP server')) {
      throw new Error('Standalone bundled tool did not return the expected status text.');
    }
  } finally {
    await client.close();
  }
};

try {
  ensureSuccess(
    'tarball help smoke test',
    ['--yes', `--package=${tarballPath}`, 'mcp-transport-firewall', '--help'],
    {},
    (stdout) => stdout.includes('MCP Transport Firewall') && stdout.includes('Usage:'),
  );

  ensureSuccess(
    'env-based target resolution smoke test',
    ['--yes', `--package=${tarballPath}`, 'mcp-transport-firewall'],
    {
      PROXY_AUTH_TOKEN: '12345678901234567890123456789012',
      MCP_TARGET_COMMAND: process.execPath,
      MCP_TARGET_ARGS_JSON: JSON.stringify([demoTargetPath]),
      MCP_ADMIN_ENABLED: 'false',
    },
  );

  await ensureStandaloneMcpServer(tarballPath);

  console.log(`package smoke passed for ${tarballName}`);
} finally {
  fs.rmSync(tarballPath, { force: true });
}
