import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

const expectedMetadata = {
  name: 'mcp-transport-firewall',
  repositoryUrl: 'git+https://github.com/shleder/mcp-transport-firewall.git',
  homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
  bugsUrl: 'https://github.com/shleder/mcp-transport-firewall/issues',
  publishAccess: 'public',
};

export const readPackageJson = () => {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
};

export const validatePackageMetadata = (pkg) => {
  const mismatches = [];

  if (pkg.name !== expectedMetadata.name) {
    mismatches.push(`name must be ${expectedMetadata.name}, got ${pkg.name ?? 'undefined'}`);
  }

  if (pkg.repository?.url !== expectedMetadata.repositoryUrl) {
    mismatches.push(`repository.url must be ${expectedMetadata.repositoryUrl}, got ${pkg.repository?.url ?? 'undefined'}`);
  }

  if (pkg.homepage !== expectedMetadata.homepage) {
    mismatches.push(`homepage must be ${expectedMetadata.homepage}, got ${pkg.homepage ?? 'undefined'}`);
  }

  if (pkg.bugs?.url !== expectedMetadata.bugsUrl) {
    mismatches.push(`bugs.url must be ${expectedMetadata.bugsUrl}, got ${pkg.bugs?.url ?? 'undefined'}`);
  }

  if (pkg.publishConfig?.access !== expectedMetadata.publishAccess) {
    mismatches.push(`publishConfig.access must be ${expectedMetadata.publishAccess}, got ${pkg.publishConfig?.access ?? 'undefined'}`);
  }

  return mismatches;
};

export const main = () => {
  const pkg = readPackageJson();
  const mismatches = validatePackageMetadata(pkg);

  if (mismatches.length > 0) {
    console.error('Package metadata assertion failed:');
    for (const mismatch of mismatches) {
      console.error(`- ${mismatch}`);
    }
    process.exit(1);
  }

  console.log(`package metadata assertion passed for ${pkg.name}@${pkg.version}`);
};

if (process.argv[1] === currentFilePath) {
  main();
}
