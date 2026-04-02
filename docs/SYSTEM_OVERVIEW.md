# System Overview

Updated: 2026-04-02

## Product Shape

`mcp-transport-firewall` ships one npm package with two runtime modes:

- standalone embedded MCP server for status/help tools
- downstream stdio firewall proxy for a real local MCP target

The package surface is defined in `package.json` and currently exported as:

- CLI bin: `dist/cli.js`
- library entry: `dist/lib.js`

## Primary User-Facing Path

The primary path is the stdio proxy:

1. `src/cli.ts` parses CLI/env input.
2. `src/cli-options.ts` resolves the downstream target.
3. `src/runtime-config.ts` resolves bounded runtime settings.
4. `src/stdio/proxy.ts` spawns the target, inspects `tools/call`, enforces trust gates, serves cache hits where allowed, and sanitizes downstream responses.

If no target is supplied, `src/embedded/server.ts` starts the bundled standalone MCP server and exposes:

- `firewall_status`
- `firewall_usage`

## Secondary Surfaces

- `src/index.ts`: HTTP compatibility harness
- `src/admin/index.ts`: admin API plus optional dashboard hosting
- `src/metrics/prometheus.ts`: Prometheus exporter

Important runtime nuance:

- the stdio proxy works from the CLI target configuration
- the HTTP `/mcp` harness has no built-in route map; it only forwards requests after routes are registered through the admin control plane

## Stateful Subsystems

- `src/cache/index.ts`: swappable global cache manager with L1 memory + L2 SQLite persistence
- `src/middleware/preflight-validator.ts`: in-memory preflight and replay registries
- `src/proxy/router.ts`: in-memory tool-to-target route registry for the HTTP harness

## Verification Surface

The current verification model is split across:

- unit/integration tests in `tests/`
- tarball smoke in `scripts/pack-smoke.mjs`
- package metadata and release guards in `scripts/assert-package-metadata.mjs`, `scripts/verify-release-parity.mjs`, and `scripts/verify-registry-metadata.mjs`
