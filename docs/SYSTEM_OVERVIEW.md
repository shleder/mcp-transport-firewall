# System Overview

Updated: 2026-04-02

## Product Shape

`mcp-transport-firewall` ships one npm package with one operator-facing stdio boundary and one bundled embedded fallback target:

- downstream stdio firewall proxy for a real local MCP target
- bundled embedded MCP server for status/help tools when no external target is configured

The package surface is defined in `package.json` and currently exported as:

- CLI bin: `dist/cli.js`
- library entry: `dist/lib.js`

## Primary User-Facing Path

The primary path is the stdio proxy:

1. `src/cli.ts` parses CLI/env input.
2. `src/cli-options.ts` resolves the downstream target.
3. `src/runtime-config.ts` resolves bounded runtime settings.
4. `src/stdio/proxy.ts` spawns the target, inspects `tools/call`, enforces trust gates, serves cache hits where allowed, and sanitizes downstream responses.

If no target is supplied, `src/cli-options.ts` falls back to the current package entrypoint with `--embedded-target`. The operator still talks to the stdio proxy, and the bundled tools come from `src/embedded/server.ts`:

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
- `src/proxy/router.ts`: live tool-to-target route registry for the HTTP harness, restored from a local `route-registry.json` snapshot under the startup cache root
- `src/middleware/preflight-validator.ts`: in-memory preflight and replay registries that reset on restart
- `src/middleware/color-boundary.ts`: in-memory color session state that resets on restart
- `src/middleware/rate-limiter.ts`: in-memory tenant override config that resets on restart in this batch

## Verification Surface

The current verification model is split across:

- unit/integration tests in `tests/`
- tarball smoke in `scripts/pack-smoke.mjs`
- package metadata and release guards in `scripts/assert-package-metadata.mjs`, `scripts/verify-release-parity.mjs`, and `scripts/verify-registry-metadata.mjs`
