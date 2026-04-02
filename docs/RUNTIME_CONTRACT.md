## Runtime Contract

This page describes the expected runtime behavior of `mcp-transport-firewall` for local operators and downstream MCP setups.

Supported entry points:

```bash
npx -y mcp-transport-firewall
npx -y mcp-transport-firewall --help
npm install -g mcp-transport-firewall
```

Recommended order:

1. prove the boundary locally with `npm run demo:stdio`
2. wire protected downstream proxy mode into your MCP client
3. use the embedded fallback path only when you want bundled status tools without wiring another downstream target

## Runtime paths

Mode 1: bundled embedded target

- reached when the current package entrypoint runs with `--embedded-target`
- starts the embedded MCP server from `src/embedded/server.ts`
- exposes `firewall_status` and `firewall_usage`
- serves as the default fallback target behind the stdio boundary when no explicit downstream target is supplied

Mode 2: protected downstream proxy

- this is the default operator-facing CLI path
- starts the stdio firewall proxy from `src/stdio/proxy.ts`
- forwards allowed traffic to either an explicit downstream MCP server or the bundled embedded fallback target, then returns sanitized results

## Target resolution order

1. explicit target from `--`
2. explicit target from `--target`
3. `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON`
4. `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS`
5. `MCP_TARGET`
6. current package entrypoint with `--embedded-target`

## Inspected wire scope

- request inspection applies to JSON-RPC `tools/call`
- trust gates run before downstream execution on inspected requests
- non-`tools/call` JSON-RPC messages pass through the stdio proxy without trust-gate evaluation
- downstream result and error payloads are sanitized before they return to the caller

## Trust-gate order

1. shared-secret authorization and scope extraction
2. scope validation
3. color-boundary validation
4. egress and injection marker validation
5. preflight validation for explicit `blue` actions and default high-trust tool families
6. strict schema validation for registered tool contracts

Blocked requests fail closed and are not forwarded to the downstream target.

Observed denial surfaces include:

- auth failures
- missing scopes
- mixed trust domains
- missing, expired, or replayed preflight IDs
- schema mismatch on registered tools
- ShadowLeak, sensitive-path, shell-injection, and epistemic-risk markers

## Downstream failure behavior

- default downstream timeout is `30000` milliseconds
- `MCP_TARGET_TIMEOUT_MS` overrides that timeout
- downstream invalid JSON fails pending requests and terminates the target process
- downstream unavailability returns explicit target-unavailable RPC errors
- stop and shutdown paths flush pending requests with fail-closed responses before teardown

## Caching behavior

- read, list, open, and search style tools are cacheable by default
- write, create, and execute style tools are not cacheable by default
- cache behavior is L1 memory plus L2 SQLite persistence
- cache keys are derived from `serverId`, method name, and request parameters

## Secondary operator-state contract

- the HTTP/admin route registry now survives restart
- on process start, secondary-surface route state is restored from `route-registry.json` under the startup cache root (`MCP_CACHE_DIR` or the default `.mcp-cache` directory)
- admin route registration, deletion, and clear operations update that on-disk snapshot before the in-memory registry is swapped in
- if the route snapshot is missing, unreadable, or invalid, the HTTP harness fails closed with an empty registry instead of guessing
- preflight registrations remain in-memory and do not survive restart
- color-boundary session state remains in-memory and does not survive restart
- tenant rate-limit config remains in-memory and does not survive restart in this batch

## Core runtime variables

| Variable | Mode | Behavior |
|---|---|---|
| `PROXY_AUTH_TOKEN` | stdio + HTTP | enables shared-secret auth and scope extraction |
| `MCP_TARGET_COMMAND` | stdio | sets downstream target command |
| `MCP_TARGET_ARGS_JSON` | stdio | preferred JSON array target args |
| `MCP_TARGET_ARGS` | stdio | space-delimited target args fallback |
| `MCP_TARGET` | stdio | full target command fallback |
| `MCP_TARGET_TIMEOUT_MS` | stdio | downstream response timeout override |
| `MCP_CACHE_DIR` | stdio + HTTP | persistent L2 cache directory |
| `MCP_CACHE_TTL_SECONDS` | stdio + HTTP | cache TTL |
| `MCP_ADMIN_ENABLED` | stdio + HTTP | enables admin API and dashboard |
| `MCP_ADMIN_PORT` | stdio + HTTP | admin API port |
| `ADMIN_TOKEN` | admin | protects admin mutation endpoints |
| `MCP_PORT` | HTTP | HTTP companion port |

## Notes

- the main protected boundary is stdio
- the first integration story is protected downstream proxy mode
- the HTTP `/mcp` service is a compatibility harness that reuses the same trust gates
- documented examples in `docs/CLIENT_CONFIG_EXAMPLES.md` should stay runnable against the current package
