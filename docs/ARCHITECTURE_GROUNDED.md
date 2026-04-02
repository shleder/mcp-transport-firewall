# Architecture Grounded

Updated: 2026-04-02

## Entry Points

- `package.json` defines the public package contract: bin `dist/cli.js`, root export `dist/lib.js`, docs included in the tarball, and `prepare` for source installs.
- `src/cli.ts` is the runtime entrypoint for the CLI package surface.
- `src/lib.ts` is the library export surface for consumers that import the package directly.

## Runtime Mode Selection

`src/cli.ts` selects exactly one of two modes:

1. no downstream target resolved: start the embedded MCP server from `src/embedded/server.ts`
2. downstream target resolved: start the stdio firewall proxy from `src/stdio/proxy.ts`

Target resolution order is implemented in `src/cli-options.ts`:

- `--`
- `--target`
- `MCP_TARGET_COMMAND` + `MCP_TARGET_ARGS_JSON`
- `MCP_TARGET_COMMAND` + `MCP_TARGET_ARGS`
- `MCP_TARGET`
- fallback to the embedded server

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
   - preflight validation for blue actions
   - strict tool-schema validation
   - AST/egress validation
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

- `src/proxy/router.ts` uses an in-memory route registry
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
- `src/proxy/router.ts` keeps route state in memory

This means the current control plane is process-local and runtime-local; it is not backed by a remote control store.

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
