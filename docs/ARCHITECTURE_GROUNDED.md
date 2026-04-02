# Architecture Grounded

Updated: 2026-04-02

## Entry Points

- `package.json` defines the public package contract: bin `dist/cli.js`, root export `dist/lib.js`, docs included in the tarball, and `prepare` for source installs.
- `src/cli.ts` is the runtime entrypoint for the CLI package surface.
- `src/lib.ts` is the library export surface for consumers that import the package directly.

## Runtime Mode Selection

`src/cli.ts` has two runtime codepaths:

1. explicit `--embedded-target`: start the bundled embedded MCP server from `src/embedded/server.ts`
2. default CLI path: resolve a target and start the stdio firewall proxy from `src/stdio/proxy.ts`

Target resolution order is implemented in `src/cli-options.ts`:

- `--`
- `--target`
- `MCP_TARGET_COMMAND` + `MCP_TARGET_ARGS_JSON`
- `MCP_TARGET_COMMAND` + `MCP_TARGET_ARGS`
- `MCP_TARGET`
- fallback to the current package entrypoint with `--embedded-target`

Grounded operator detail:

- a plain `npx -y mcp-transport-firewall` invocation still enters the stdio proxy path
- if no explicit downstream target is configured, the proxy spawns the packaged embedded server as its fallback target

## Stdio Proxy Path

The primary execution path lives in `src/stdio/proxy.ts`.

Request flow:

1. spawn downstream target process
2. read newline-delimited JSON-RPC from client stdin
3. inspect `tools/call`
4. enforce trust gates in this order:
   - auth extraction and token/scope validation
   - scope validation
   - color-boundary validation
   - AST/egress validation
   - preflight validation for explicit `blue` and default high-trust tools
   - strict tool-schema validation
5. serve cache hit when allowed
6. forward allowed JSON-RPC to the downstream target
7. sanitize downstream result or error
8. enforce oversized-response OOM guard before returning output

Non-`tools/call` JSON-RPC messages pass through the stdio proxy without trust-gate inspection, but downstream responses are still normalized through the proxy response path.

## HTTP Harness Path

`src/index.ts` exposes an Express-based compatibility harness:

- `GET /health`
- `POST /mcp`
- `GET /sse`

`POST /mcp` reuses the same trust-gate chain as the stdio path, then calls `routeRequest()` from `src/proxy/router.ts`.

Important grounded detail:

- `src/proxy/router.ts` restores and updates a persisted `route-registry.json` snapshot for the HTTP/admin surface
- there are no built-in routes in the codebase
- if no admin route has been registered, the HTTP harness fails closed with `UNKNOWN_ROUTE`

So the HTTP harness is real, but it is a secondary, control-plane-configured surface rather than a ready-to-run default workflow.

## Control Plane

`src/admin/index.ts` owns the mutable control plane:

- route registration and deletion
- cache initialization and clearing
- preflight registration
- tenant rate-limit configuration
- circuit-breaker creation
- SIEM configuration
- aggregated stats and Prometheus metrics
- optional static dashboard hosting from `ui/dist`

## Stateful Internals

- `src/cache/index.ts` exposes a swappable global cache manager so long-lived proxy references can survive cache reinitialization
- `src/middleware/preflight-validator.ts` keeps pending and consumed preflight IDs in memory
- `src/middleware/color-boundary.ts` keeps per-session color state in memory
- `src/middleware/rate-limiter.ts` keeps tenant override config in memory
- `src/proxy/router.ts` keeps live route state in memory, but now backs the HTTP/admin route registry with a local `route-registry.json` snapshot under the startup cache root

This means the current control plane is still local and process-scoped overall. In this batch only the HTTP/admin route registry becomes restart-durable; preflight, color sessions, and tenant rate-limit overrides remain process-local and reset on restart.

## Verification And Release Guardrails

The current authoritative verification surfaces are:

- runtime/unit tests in `tests/`
- tarball smoke in `scripts/pack-smoke.mjs`
- package metadata guardrails in `scripts/assert-package-metadata.mjs`
- release/tag/origin checks in `scripts/verify-release-parity.mjs`
- npm registry parity checks in `scripts/verify-registry-metadata.mjs`

The checked-out local branch also extends the test surface with:

- `tests/release-guardrails.test.ts` for package install contract assertions
- `tests/package-proxy-smoke.test.ts` for tarball-based downstream proxy proof
