import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDirPath, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

const expectedMetadata = {
  name: 'mcp-transport-firewall',
  main: 'dist/lib.js',
  exportRoot: './dist/lib.js',
  exportPackageJson: './package.json',
  binPath: 'dist/cli.js',
  repositoryUrl: 'git+https://github.com/shleder/mcp-transport-firewall.git',
  homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
  bugsUrl: 'https://github.com/shleder/mcp-transport-firewall/issues',
  publishAccess: 'public',
  nodeEngine: '>=20.0.0',
  prepareScript: 'npm run build',
  requiredFiles: [
    'dist',
    'docs',
    '.env.example',
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'SECURITY.md',
    'SUPPORT.md',
  ],
};

export const readPackageJson = () => {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
};

export const validatePackageMetadata = (pkg) => {
  const mismatches = [];
  const packageFiles = Array.isArray(pkg.files) ? pkg.files : [];

  if (pkg.name !== expectedMetadata.name) {
    mismatches.push(`name must be ${expectedMetadata.name}, got ${pkg.name ?? 'undefined'}`);
  }

  if (pkg.main !== expectedMetadata.main) {
    mismatches.push(`main must be ${expectedMetadata.main}, got ${pkg.main ?? 'undefined'}`);
  }

  if (pkg.exports?.['.'] !== expectedMetadata.exportRoot) {
    mismatches.push(`exports["."] must be ${expectedMetadata.exportRoot}, got ${pkg.exports?.['.'] ?? 'undefined'}`);
  }

  if (pkg.exports?.['./package.json'] !== expectedMetadata.exportPackageJson) {
    mismatches.push(`exports["./package.json"] must be ${expectedMetadata.exportPackageJson}, got ${pkg.exports?.['./package.json'] ?? 'undefined'}`);
  }

  if (pkg.bin?.['mcp-transport-firewall'] !== expectedMetadata.binPath) {
    mismatches.push(`bin.mcp-transport-firewall must be ${expectedMetadata.binPath}, got ${pkg.bin?.['mcp-transport-firewall'] ?? 'undefined'}`);
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

  if (pkg.engines?.node !== expectedMetadata.nodeEngine) {
    mismatches.push(`engines.node must be ${expectedMetadata.nodeEngine}, got ${pkg.engines?.node ?? 'undefined'}`);
  }

  if (pkg.scripts?.prepare !== expectedMetadata.prepareScript) {
    mismatches.push(`scripts.prepare must be ${expectedMetadata.prepareScript}, got ${pkg.scripts?.prepare ?? 'undefined'}`);
  }

  for (const requiredFile of expectedMetadata.requiredFiles) {
    if (!packageFiles.includes(requiredFile)) {
      mismatches.push(`files must include ${requiredFile}`);
    }
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
