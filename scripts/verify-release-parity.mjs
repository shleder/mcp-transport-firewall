import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const expectedRepository = 'shleder/mcp-transport-firewall';

const readPackageJson = () => JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const readArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
};

const readGit = (...args) =>
  execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

const normalizeRepositoryUrl = (originUrl) => {
  const normalizedUrl = originUrl.replace(/^git\+/, '').trim();
  const sshMatch = normalizedUrl.match(/^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i);

  if (sshMatch?.groups) {
    return `${sshMatch.groups.owner}/${sshMatch.groups.repo}`;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (!/github\.com$/i.test(parsedUrl.hostname)) {
      return null;
    }

    const pathMatch = parsedUrl.pathname.match(/^\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?\/?$/);
    if (!pathMatch?.groups) {
      return null;
    }

    return `${pathMatch.groups.owner}/${pathMatch.groups.repo}`;
  } catch (error) {
    return null;
  }
};

const appendSummary = (lines) => {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
};

export const verifyReleaseParity = ({ pkg, env = process.env, readGitFn = readGit } = {}) => {
  const packageJson = pkg ?? readPackageJson();
  const expectedTag = `v${packageJson.version}`;
  const actualTag = readArgValue('--tag') ?? env.GITHUB_REF_NAME ?? expectedTag;
  const mismatches = [];

  if (actualTag !== expectedTag) {
    mismatches.push(`release tag must be ${expectedTag}, got ${actualTag}`);
  }

  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== expectedRepository) {
    mismatches.push(`GITHUB_REPOSITORY must be ${expectedRepository}, got ${env.GITHUB_REPOSITORY}`);
  }

  let originUrl = '';
  let normalizedOriginRepository = null;

  try {
    originUrl = readGitFn('config', '--get', 'remote.origin.url');
    normalizedOriginRepository = normalizeRepositoryUrl(originUrl);
  } catch (error) {
    mismatches.push(`remote.origin.url is not configured; expected ${expectedRepository}`);
  }

  if (originUrl && normalizedOriginRepository !== expectedRepository) {
    const detail = normalizedOriginRepository
      ? `${normalizedOriginRepository} via ${originUrl}`
      : originUrl;
    mismatches.push(`remote.origin.url must point to ${expectedRepository}, got ${detail}`);
  }

  let tagSha = '';
  try {
    tagSha = readGitFn('rev-list', '-n', '1', actualTag);
  } catch (error) {
    mismatches.push(`git tag ${actualTag} does not exist locally`);
  }

  if (tagSha && env.GITHUB_SHA && tagSha !== env.GITHUB_SHA) {
    mismatches.push(`git tag ${actualTag} points to ${tagSha}, expected ${env.GITHUB_SHA}`);
  }

  return {
    expectedTag,
    actualTag,
    originUrl,
    normalizedOriginRepository,
    tagSha,
    mismatches,
  };
};

export const main = () => {
  const pkg = readPackageJson();
  const result = verifyReleaseParity({ pkg });

  if (result.mismatches.length > 0) {
    console.error('Release parity verification failed:');
    for (const mismatch of result.mismatches) {
      console.error(`- ${mismatch}`);
    }
    process.exit(1);
  }

  appendSummary([
    '## release parity',
    '',
    `- tag: \`${result.actualTag}\``,
    `- origin: \`${result.originUrl}\``,
    `- tag commit: \`${result.tagSha || 'resolved locally'}\``,
  ]);

  console.log(`release parity verified for ${result.actualTag} (${result.tagSha || 'tag present'})`);
};

if (process.argv[1] === currentFilePath) {
  main();
}
