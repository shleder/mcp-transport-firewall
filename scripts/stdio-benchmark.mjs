import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const cliPath = path.join(repoRoot, 'dist', 'cli.js');
const targetPath = path.join(repoRoot, 'examples', 'demo-target.js');
const corpusPath = path.join(repoRoot, 'examples', 'evidence-corpus.json');
const proxyToken = process.env.PROXY_AUTH_TOKEN ?? '12345678901234567890123456789012';

const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const jsonOnly = argv.has('--json');
const readArgValue = (flag) => {
  const index = rawArgs.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return rawArgs[index + 1] ?? null;
};
const outputPathArg = readArgValue('--output');
const outputPath = outputPathArg ? path.resolve(process.cwd(), outputPathArg) : null;

if (!fs.existsSync(cliPath)) {
  console.error('Missing dist/cli.js. Run "npm run build" before "npm run benchmark:stdio".');
  process.exit(1);
}

if (!fs.existsSync(corpusPath)) {
  console.error('Missing examples/evidence-corpus.json.');
  process.exit(1);
}

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const cases = Array.isArray(corpus.cases) ? corpus.cases : [];
const capturedStderrLines = [];

if (cases.length === 0) {
  console.error('No benchmark cases found in examples/evidence-corpus.json.');
  process.exit(1);
}

const createAuthorization = (scopes) => {
  return `Bearer ${Buffer.from(JSON.stringify({ token: proxyToken, scopes }), 'utf8').toString('base64')}`;
};

const createSession = () => {
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

  const pendingResponses = [];
  const stderrLines = [];
  let closed = false;

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

  const close = async () => {
    if (closed) {
      return;
    }

    closed = true;
    proxy.stdin.end();
    if (!proxy.killed) {
      proxy.kill('SIGTERM');
    }
    stdoutReader.close();
  };

  return {
    request,
    close,
    stderrLines,
  };
};

const clone = (value) => {
  return structuredClone(value);
};

const isRecord = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const buildRequest = (benchmarkCase, requestId) => {
  const message = clone(benchmarkCase.request);
  message.id = requestId;

  if (benchmarkCase.auth?.type === 'nhi') {
    const scopes = Array.isArray(benchmarkCase.auth.scopes) ? benchmarkCase.auth.scopes : [];
    const authorization = createAuthorization(scopes);

    message._meta ??= {};
    message._meta.authorization = authorization;

    message.params ??= {};
    message.params._meta ??= {};
    message.params._meta.authorization = authorization;

    if (Array.isArray(message.params.tools)) {
      for (const tool of message.params.tools) {
        if (!isRecord(tool)) {
          continue;
        }

        tool._meta ??= {};
        if (isRecord(tool._meta)) {
          tool._meta.authorization = authorization;
        }
      }
    }
  }

  return message;
};

const getErrorCode = (response) => {
  return response?.error?.data?.code ?? response?.error?.code ?? null;
};

const runCaseInSession = async (session, benchmarkCase, requestIdStart) => {
  const caseResult = {
    id: benchmarkCase.id ?? `case-${requestIdStart}`,
    kind: benchmarkCase.kind,
    repeat: Number.isInteger(benchmarkCase.repeat) && benchmarkCase.repeat > 0 ? benchmarkCase.repeat : 1,
    expectedCode: benchmarkCase.expectedCode ?? null,
    requests: [],
  };

  let nextRequestId = requestIdStart;
  let firstAllowSignature = null;

  for (let iteration = 0; iteration < caseResult.repeat; iteration += 1) {
    const message = buildRequest(benchmarkCase, nextRequestId);
    nextRequestId += 1;

    const response = await session.request(message);
    const errorCode = getErrorCode(response);
    const responseSignature = JSON.stringify(response?.result ?? null);

    if (benchmarkCase.kind === 'allow') {
      if (response?.error) {
        caseResult.requests.push({
          id: message.id,
          status: 'false-positive',
          errorCode,
        });
        continue;
      }

      if (iteration === 0) {
        firstAllowSignature = responseSignature;
        caseResult.requests.push({
          id: message.id,
          status: 'allow-primary',
          response,
        });
        continue;
      } else if (responseSignature !== firstAllowSignature) {
        caseResult.requests.push({
          id: message.id,
          status: 'cache-miss',
          response,
        });
        continue;
      }

      caseResult.requests.push({
        id: message.id,
        status: 'cache-hit',
        response,
      });
      continue;
    }

    if (errorCode === benchmarkCase.expectedCode) {
      caseResult.requests.push({
        id: message.id,
        status: 'blocked',
        errorCode,
      });
      continue;
    }

    caseResult.requests.push({
      id: message.id,
      status: 'false-negative',
      expectedCode: benchmarkCase.expectedCode ?? null,
      errorCode,
      response,
    });
  }

  return caseResult;
};

const main = async () => {
  const startedAt = new Date().toISOString();
  const summary = {
    benchmark: corpus.name ?? 'stdio-evidence-benchmark',
    description: corpus.description ?? '',
    source: path.relative(repoRoot, corpusPath),
    startedAt,
    finishedAt: null,
    verdict: 'pending',
    cases: [],
    totals: {
      cases: 0,
      requests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      cacheHits: 0,
      cacheConsistencyFailures: 0,
      falsePositives: 0,
      falseNegatives: 0,
    },
    blockedByCode: {},
  };

  let nextRequestId = 1;

  const allowCases = cases.filter((benchmarkCase) => benchmarkCase.kind === 'allow');
  const blockCases = cases.filter((benchmarkCase) => benchmarkCase.kind !== 'allow');

  const allowSession = createSession();
  try {
    for (const benchmarkCase of allowCases) {
      const caseResult = await runCaseInSession(allowSession, benchmarkCase, nextRequestId);
      nextRequestId += caseResult.requests.length;
      summary.totals.cases += 1;
      summary.cases.push(caseResult);

      for (const requestResult of caseResult.requests) {
        summary.totals.requests += 1;
        summary.totals.allowedRequests += 1;

        if (requestResult.status === 'false-positive') {
          summary.totals.falsePositives += 1;
        } else if (requestResult.status === 'cache-miss') {
          summary.totals.cacheConsistencyFailures += 1;
        } else if (requestResult.status === 'cache-hit') {
          summary.totals.cacheHits += 1;
        }
      }
    }
  } finally {
    await allowSession.close();
    capturedStderrLines.push(...allowSession.stderrLines);
  }

  const blockChunkSize = 3;
  for (let index = 0; index < blockCases.length; index += blockChunkSize) {
    const blockSession = createSession();
    const chunk = blockCases.slice(index, index + blockChunkSize);

    try {
      for (const benchmarkCase of chunk) {
        const caseResult = await runCaseInSession(blockSession, benchmarkCase, nextRequestId);
        nextRequestId += caseResult.requests.length;
        summary.totals.cases += 1;
        summary.cases.push(caseResult);

        for (const requestResult of caseResult.requests) {
          summary.totals.requests += 1;
          summary.totals.blockedRequests += 1;

          if (requestResult.status === 'blocked') {
            const code = requestResult.errorCode;
            if (typeof code === 'string') {
              summary.blockedByCode[code] = (summary.blockedByCode[code] ?? 0) + 1;
            }
          } else {
            summary.totals.falseNegatives += 1;
          }
        }
      }
    } finally {
      await blockSession.close();
      capturedStderrLines.push(...blockSession.stderrLines);
    }
  }

  summary.finishedAt = new Date().toISOString();

  const failed = summary.totals.falsePositives > 0 ||
    summary.totals.falseNegatives > 0 ||
    summary.totals.cacheConsistencyFailures > 0;
  summary.verdict = failed ? 'failed' : 'passed';
  const jsonReport = JSON.stringify(summary, null, 2);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${jsonReport}\n`, 'utf8');
  }

  if (jsonOnly) {
    if (!outputPath) {
      console.log(jsonReport);
    } else {
      console.log(`wrote benchmark JSON to ${path.relative(process.cwd(), outputPath)}`);
    }
  } else {
    console.log(`${summary.benchmark} ${summary.verdict}`);
    console.log(`source: ${summary.source}`);
    console.log(`cases: ${summary.totals.cases}`);
    console.log(`requests: ${summary.totals.requests}`);
    console.log(`allowed: ${summary.totals.allowedRequests}`);
    console.log(`blocked: ${summary.totals.blockedRequests}`);
    console.log(`cache hits: ${summary.totals.cacheHits}`);
    console.log(`cache consistency failures: ${summary.totals.cacheConsistencyFailures}`);
    console.log(`false positives: ${summary.totals.falsePositives}`);
    console.log(`false negatives: ${summary.totals.falseNegatives}`);
    for (const [code, count] of Object.entries(summary.blockedByCode)) {
      console.log(`blocked-by-code: ${code} x${count}`);
    }
    if (outputPath) {
      console.log(`json artifact: ${path.relative(process.cwd(), outputPath)}`);
    }
    console.log(jsonReport);
  }

  if (failed) {
    process.exitCode = 1;
  }
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  if (capturedStderrLines.length > 0) {
    console.error(capturedStderrLines.join(''));
  }
  process.exitCode = 1;
}
