import { describe, expect, it } from '@jest/globals';
import { resolveProxyRuntimeConfig } from '../src/runtime-config.js';

describe('resolveProxyRuntimeConfig', () => {
  it('returns defaults when env values are missing', () => {
    expect(resolveProxyRuntimeConfig({})).toEqual({
      adminPort: 9090,
      cacheTtlSeconds: 300,
      targetTimeoutMs: 30000,
    });
  });

  it('falls back when timeout-like env values are invalid', () => {
    expect(resolveProxyRuntimeConfig({
      MCP_ADMIN_PORT: 'not-a-port',
      MCP_CACHE_TTL_SECONDS: '0',
      MCP_TARGET_TIMEOUT_MS: '',
    })).toEqual({
      adminPort: 9090,
      cacheTtlSeconds: 300,
      targetTimeoutMs: 30000,
    });
  });

  it('preserves valid bounded values', () => {
    expect(resolveProxyRuntimeConfig({
      MCP_ADMIN_PORT: '9191',
      MCP_CACHE_TTL_SECONDS: '600',
      MCP_TARGET_TIMEOUT_MS: '45000',
    })).toEqual({
      adminPort: 9191,
      cacheTtlSeconds: 600,
      targetTimeoutMs: 45000,
    });
  });
});
