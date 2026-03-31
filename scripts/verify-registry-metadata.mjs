import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';

const readPackageJson = () => JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const normalizeUrl = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\.git$/u, '').replace(/^git\+/u, '').replace(/\/$/u, '');
};

const readArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
};

const readRegistryMetadata = (packageName, version) => {
  const output = execFileSync(
    npmCommand,
    ['view', `${packageName}@${version}`, 'version', 'repository', 'homepage', 'bugs', 'gitHead', 'maintainers', '--json'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  return JSON.parse(output);
};

const readGitHead = () =>
  execFileSync(gitCommand, ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

const appendSummary = (lines) => {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const verifyRegistryMetadata = ({ pkg, env = process.env, registryMetadata } = {}) => {
  const packageJson = pkg ?? readPackageJson();
  const version = readArgValue('--version') ?? env.PACKAGE_VERSION ?? packageJson.version;
  const expectedGitHead = env.EXPECTED_GIT_HEAD ?? env.GITHUB_SHA ?? readGitHead();
  const published = registryMetadata ?? readRegistryMetadata(packageJson.name, version);
  const mismatches = [];

  if (published.version !== version) {
    mismatches.push(`registry version must be ${version}, got ${published.version ?? 'undefined'}`);
  }

  if (normalizeUrl(published.repository?.url) !== normalizeUrl(packageJson.repository?.url)) {
    mismatches.push(`registry repository.url must be ${packageJson.repository?.url}, got ${published.repository?.url ?? 'undefined'}`);
  }

  if (normalizeUrl(published.homepage) !== normalizeUrl(packageJson.homepage)) {
    mismatches.push(`registry homepage must be ${packageJson.homepage}, got ${published.homepage ?? 'undefined'}`);
  }

  if (normalizeUrl(published.bugs?.url) !== normalizeUrl(packageJson.bugs?.url)) {
    mismatches.push(`registry bugs.url must be ${packageJson.bugs?.url}, got ${published.bugs?.url ?? 'undefined'}`);
  }

  if (published.gitHead !== expectedGitHead) {
    mismatches.push(`registry gitHead must be ${expectedGitHead}, got ${published.gitHead ?? 'undefined'}`);
  }

  return {
    version,
    published,
    mismatches,
  };
};

export const main = async () => {
  const pkg = readPackageJson();
  const attempts = Number(readArgValue('--attempts') ?? process.env.REGISTRY_VERIFY_ATTEMPTS ?? 10);
  const delayMs = Number(readArgValue('--delay-ms') ?? process.env.REGISTRY_VERIFY_DELAY_MS ?? 6000);
  let result = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      result = verifyRegistryMetadata({ pkg });
    } catch (error) {
      result = {
        version: readArgValue('--version') ?? process.env.PACKAGE_VERSION ?? pkg.version,
        published: {},
        mismatches: [error instanceof Error ? error.message : String(error)],
      };
    }

    if (result.mismatches.length === 0) {
      appendSummary([
        '## registry metadata',
        '',
        `- tag: \`${process.env.GITHUB_REF_NAME ?? `v${result.version}`}\``,
        `- package version: \`${result.version}\``,
        `- npm repository: \`${result.published.repository?.url ?? 'undefined'}\``,
        `- npm homepage: \`${result.published.homepage ?? 'undefined'}\``,
        `- npm bugs: \`${result.published.bugs?.url ?? 'undefined'}\``,
        `- npm gitHead: \`${result.published.gitHead ?? 'undefined'}\``,
      ]);

      console.log(`registry metadata verified for ${pkg.name}@${result.version}`);
      console.log(`repository: ${result.published.repository?.url ?? 'undefined'}`);
      console.log(`homepage: ${result.published.homepage ?? 'undefined'}`);
      console.log(`bugs: ${result.published.bugs?.url ?? 'undefined'}`);
      console.log(`gitHead: ${result.published.gitHead ?? 'undefined'}`);
      return;
    }

    if (attempt < attempts) {
      console.log(
        `registry metadata not ready for ${pkg.name}@${result.version} (attempt ${attempt}/${attempts}); retrying in ${delayMs}ms`,
      );
      await wait(delayMs);
    }
  }

  console.error('Registry metadata verification failed:');
  for (const mismatch of result?.mismatches ?? ['unknown registry verification failure']) {
    console.error(`- ${mismatch}`);
  }
  process.exit(1);
};

if (process.argv[1] === currentFilePath) {
  await main();
}
