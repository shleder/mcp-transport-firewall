import { describe, expect, it } from '@jest/globals';
import {
  validatePackageMetadata,
} from '../scripts/assert-package-metadata.mjs';
import {
  verifyRegistryMetadata,
} from '../scripts/verify-registry-metadata.mjs';
import {
  verifyReleaseParity,
} from '../scripts/verify-release-parity.mjs';

describe('release guardrails', () => {
  it('accepts expected package metadata', () => {
    const mismatches = validatePackageMetadata({
      name: 'mcp-transport-firewall',
      repository: {
        type: 'git',
        url: 'git+https://github.com/shleder/mcp-transport-firewall.git',
      },
      homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
      bugs: {
        url: 'https://github.com/shleder/mcp-transport-firewall/issues',
      },
      publishConfig: {
        access: 'public',
      },
    });

    expect(mismatches).toEqual([]);
  });

  it('rejects package metadata that points to a different homepage', () => {
    const mismatches = validatePackageMetadata({
      name: 'mcp-transport-firewall',
      repository: {
        type: 'git',
        url: 'git+https://github.com/shleder/mcp-transport-firewall.git',
      },
      homepage: 'https://example.com/wrong-homepage',
      bugs: {
        url: 'https://github.com/shleder/mcp-transport-firewall/issues',
      },
      publishConfig: {
        access: 'public',
      },
    });

    expect(mismatches).toContainEqual(expect.stringContaining('homepage must be'));
  });

  it('accepts registry metadata when repo identity and gitHead match', () => {
    const result = verifyRegistryMetadata({
      pkg: {
        name: 'mcp-transport-firewall',
        version: '2.2.3',
        repository: {
          url: 'git+https://github.com/shleder/mcp-transport-firewall.git',
        },
        homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
        bugs: {
          url: 'https://github.com/shleder/mcp-transport-firewall/issues',
        },
      },
      env: {
        PACKAGE_VERSION: '2.2.3',
        EXPECTED_GIT_HEAD: 'abc123',
      },
      registryMetadata: {
        version: '2.2.3',
        repository: {
          url: 'git+https://github.com/shleder/mcp-transport-firewall.git',
        },
        homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
        bugs: {
          url: 'https://github.com/shleder/mcp-transport-firewall/issues',
        },
        gitHead: 'abc123',
      },
    });

    expect(result.mismatches).toEqual([]);
  });

  it('rejects registry metadata with a mismatched gitHead', () => {
    const result = verifyRegistryMetadata({
      pkg: {
        name: 'mcp-transport-firewall',
        version: '2.2.3',
        repository: {
          url: 'git+https://github.com/shleder/mcp-transport-firewall.git',
        },
        homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
        bugs: {
          url: 'https://github.com/shleder/mcp-transport-firewall/issues',
        },
      },
      env: {
        PACKAGE_VERSION: '2.2.3',
        EXPECTED_GIT_HEAD: 'abc123',
      },
      registryMetadata: {
        version: '2.2.3',
        repository: {
          url: 'git+https://github.com/shleder/mcp-transport-firewall.git',
        },
        homepage: 'https://github.com/shleder/mcp-transport-firewall#readme',
        bugs: {
          url: 'https://github.com/shleder/mcp-transport-firewall/issues',
        },
        gitHead: 'def456',
      },
    });

    expect(result.mismatches).toContainEqual(expect.stringContaining('registry gitHead must be'));
  });

  it('accepts release parity in the expected repo with the expected tag', () => {
    const result = verifyReleaseParity({
      pkg: {
        version: '2.2.5',
      },
      env: {
        GITHUB_REF_NAME: 'v2.2.5',
        GITHUB_REPOSITORY: 'shleder/mcp-transport-firewall',
      },
      readGitFn: (...args: string[]) => {
        if (args[0] === 'config') {
          return 'https://github.com/shleder/mcp-transport-firewall.git';
        }

        return 'abc123';
      },
    });

    expect(result.expectedTag).toBe('v2.2.5');
    expect(result.normalizedOriginRepository).toBe('shleder/mcp-transport-firewall');
    expect(result.mismatches).toEqual([]);
  });

  it('rejects release parity when the repo is not the expected one', () => {
    const result = verifyReleaseParity({
      pkg: {
        version: '2.2.5',
      },
      env: {
        GITHUB_REF_NAME: 'v2.2.5',
        GITHUB_REPOSITORY: 'wrong-owner/mcp-transport-firewall',
      },
      readGitFn: (...args: string[]) => {
        if (args[0] === 'config') {
          return 'https://github.com/shleder/mcp-transport-firewall.git';
        }

        return 'abc123';
      },
    });

    expect(result.mismatches).toContainEqual(expect.stringContaining('GITHUB_REPOSITORY must be'));
  });

  it('accepts SSH origin URLs when they resolve to the canonical repository', () => {
    const result = verifyReleaseParity({
      pkg: {
        version: '2.2.5',
      },
      env: {
        GITHUB_REF_NAME: 'v2.2.5',
        GITHUB_REPOSITORY: 'shleder/mcp-transport-firewall',
      },
      readGitFn: (...args: string[]) => {
        if (args[0] === 'config') {
          return 'git@github.com:shleder/mcp-transport-firewall.git';
        }

        return 'abc123';
      },
    });

    expect(result.normalizedOriginRepository).toBe('shleder/mcp-transport-firewall');
    expect(result.mismatches).toEqual([]);
  });

  it('rejects origins that only contain the canonical repository as a substring', () => {
    const result = verifyReleaseParity({
      pkg: {
        version: '2.2.5',
      },
      env: {
        GITHUB_REF_NAME: 'v2.2.5',
        GITHUB_REPOSITORY: 'shleder/mcp-transport-firewall',
      },
      readGitFn: (...args: string[]) => {
        if (args[0] === 'config') {
          return 'https://github.com/notshleder/mcp-transport-firewall.git';
        }

        return 'abc123';
      },
    });

    expect(result.mismatches).toContain(
      'remote.origin.url must point to shleder/mcp-transport-firewall, got notshleder/mcp-transport-firewall via https://github.com/notshleder/mcp-transport-firewall.git'
    );
  });

  it('rejects lookalike hostnames even when the owner and repo path match', () => {
    const result = verifyReleaseParity({
      pkg: {
        version: '2.2.5',
      },
      env: {
        GITHUB_REF_NAME: 'v2.2.5',
        GITHUB_REPOSITORY: 'shleder/mcp-transport-firewall',
      },
      readGitFn: (...args: string[]) => {
        if (args[0] === 'config') {
          return 'https://notgithub.com/shleder/mcp-transport-firewall.git';
        }

        return 'abc123';
      },
    });

    expect(result.normalizedOriginRepository).toBeNull();
    expect(result.mismatches).toContain(
      'remote.origin.url must point to shleder/mcp-transport-firewall, got https://notgithub.com/shleder/mcp-transport-firewall.git'
    );
  });

  it('reports a missing origin remote as a structured mismatch', () => {
    const result = verifyReleaseParity({
      pkg: {
        version: '2.2.5',
      },
      env: {
        GITHUB_REF_NAME: 'v2.2.5',
        GITHUB_REPOSITORY: 'shleder/mcp-transport-firewall',
      },
      readGitFn: (...args: string[]) => {
        if (args[0] === 'config') {
          throw new Error('missing origin');
        }

        return 'abc123';
      },
    });

    expect(result.mismatches).toContain(
      'remote.origin.url is not configured; expected shleder/mcp-transport-firewall'
    );
  });
});
