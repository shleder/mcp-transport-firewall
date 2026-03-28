
Integration Contract

This document defines the stable runtime contract exposed by `mcp-transport-firewall` for package consumers and downstream MCP operators.

Public install contract

```bash
npx -y mcp-transport-firewall
npx -y mcp-transport-firewall --help
npm install -g mcp-transport-firewall
```

Runtime modes

Mode 1: standalone bundled MCP server

- selected when no downstream target is supplied
- starts the embedded MCP server from `src/embedded/server.ts`
- exposes `firewall_status` and `firewall_usage`

Mode 2: protected downstream proxy

- selected when a target is supplied through CLI flags or environment
- starts the stdio firewall proxy from `src/stdio/proxy.ts`
- forwards allowed traffic to the downstream MCP server and returns sanitized results

Target resolution order

1. explicit target from `--`
2. explicit target from `--target`
3. `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON`
4. `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS`
5. `MCP_TARGET`
6. bundled standalone fallback

Primary inspected wire scope

- request inspection applies to JSON-RPC `tools/call`
- trust gates run before downstream execution on inspected requests
- non-`tools/call` JSON-RPC messages pass through the stdio proxy without trust-gate evaluation
- downstream result and error payloads are sanitized before being returned to the caller

Trust-gate contract

The active deny path on inspected requests is:

1. shared-secret authorization and scope extraction
2. scope validation
3. color-boundary validation
4. preflight validation for `blue` actions
5. strict schema validation for registered tool contracts
6. egress and injection marker validation

Blocked requests fail closed and are not forwarded to the downstream target.

Observed denial surfaces include:

- auth failures
- missing scopes
- mixed trust domains
- missing, expired, or replayed preflight IDs
- schema mismatch on registered tools
- ShadowLeak, sensitive-path, shell-injection, and epistemic-risk markers

Downstream failure contract

- default downstream timeout is `30000` milliseconds
- `MCP_TARGET_TIMEOUT_MS` overrides that timeout
- downstream invalid JSON fails pending requests and terminates the target process
- downstream unavailability returns explicit target-unavailable RPC errors
- stop and shutdown paths flush pending requests with fail-closed responses before teardown

Caching contract

- read, list, open, and search style tools are cacheable by default
- write, create, and execute style tools are not cacheable by default
- cache behavior is L1 memory plus L2 SQLite persistence
- cache keys are derived from `serverId`, method name, and request parameters

Configuration contract

Core runtime variables:

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

Compatibility notes

- the primary product boundary is stdio
- the HTTP `/mcp` service is a compatibility harness that reuses the same trust gates
- the package remains model-agnostic and transport-focused
- the documented npm package contract is the canonical install path

Operator expectations

Package consumers can rely on the following stable behaviors within the current v2 line:

- standalone mode starts without a downstream target
- proxy mode requires a downstream target command
- trust gates are evaluated before downstream tool execution on inspected requests
- blocked requests return explicit denial responses
- successful downstream responses are sanitized before they re-enter the client context
- documented examples in `docs/CLIENT_CONFIGS.md` are intended to stay runnable against the published package
