# MCP Transport Firewall

Fail-closed stdio firewall for Model Context Protocol tool traffic.

Use it when you want a local control point between an MCP client and local tools, with default-deny behavior for auth, scope, trust-boundary, schema, and egress violations.

This repository ships two runnable surfaces:

- a primary stdio firewall that sits between an MCP client and a local MCP tool server
- an HTTP companion service that reuses the same trust gates for downstream HTTP tool routes

The stdio runtime is the main product path. The HTTP `/mcp` service exists for compatibility testing, route registration, cache inspection, and dashboard use.

## What It Does

- fail-closed authorization with a shared-secret NHI-style envelope
- per-tool scope checks before tool execution
- color-boundary enforcement to block mixed trust domains and session color flips
- preflight gates for high-trust (`blue`) actions
- strict schema validation for common file, directory, search, execute, and fetch contracts, including supported aliases
- structured egress inspection for ShadowLeak-style exfiltration, sensitive path access, and shell-injection markers
- response sanitization plus L1/L2 caching for allowlisted read-style tools
- admin API and React dashboard for route, cache, rate-limit, circuit-breaker, preflight, and SIEM inspection

## Quick Start

1. Install dependencies.

```bash
npm install
npm --prefix ui install
```

2. Copy the example environment.

```powershell
Copy-Item .env.example .env
```

3. Run the stdio demo.

```bash
npm run demo:stdio
```

4. Optional: run the full verification set.

```bash
npm run verify:all
```

5. Optional: run the repeatable benchmark.

```bash
npm run benchmark:stdio
npm run benchmark:stdio -- --json > evidence.json
```

Expected demo outcomes:

- an allowed `search_files` call reaches the target
- the second identical `search_files` call is served from cache
- a ShadowLeak-style `fetch_url` request is blocked with `SHADOWLEAK_DETECTED`
- a request without `_meta.authorization` is blocked with `AUTH_FAILURE`

Expected benchmark outcomes:

- zero false positives across the allow corpus
- zero false negatives across the blocked corpus
- repeat invocations of cacheable allow cases return identical results
- zero cache consistency failures across repeated allow cases
- blocked cases report the expected denial codes

## One-Line Client Launch

If you want to run the firewall from an MCP client without cloning this repository, launch it through `npx` and provide the protected target through environment variables.

Example command:

```bash
npx -y github:maksboreichuk88-commits/mcp-transport-firewall
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "protected-local-tooling": {
      "command": "npx",
      "args": ["-y", "github:maksboreichuk88-commits/mcp-transport-firewall"],
      "env": {
        "PROXY_AUTH_TOKEN": "replace-with-32-byte-secret",
        "MCP_TARGET_COMMAND": "node",
        "MCP_TARGET_ARGS_JSON": "[\"C:/tools/my-mcp-server.js\"]"
      }
    }
  }
}
```

If your client cannot pass JSON arrays easily, the CLI also accepts:

- `MCP_TARGET_ARGS` for a space-delimited argument string
- `MCP_TARGET` for a full target command string

## Run Modes

For the stdio firewall:

```bash
npm run start:cli -- -- node examples/demo-target.js
```

For a local env-based launch path:

```powershell
$env:MCP_TARGET_COMMAND = "node"
$env:MCP_TARGET_ARGS_JSON = "[\"examples/demo-target.js\"]"
npm run start:cli
```

For the HTTP companion service:

```bash
npm run dev
npm --prefix ui run dev
```

The HTTP path is secondary and exists for compatibility testing, route registration, cache inspection, and dashboard use.

## Docker

```bash
docker compose up --build
```

Docker brings up the HTTP companion service and the admin dashboard in one container:

- [http://localhost:3000/health](http://localhost:3000/health)
- [http://localhost:9090/health](http://localhost:9090/health)
- [http://localhost:9090](http://localhost:9090)

Use `npm run demo:stdio` when you want to validate the transport boundary directly. The Docker path is mostly for the dashboard and HTTP companion service.

## Documentation

- threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- stdio walkthrough: [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md)
- benchmark methodology: [docs/EVIDENCE_BENCHMARK.md](docs/EVIDENCE_BENCHMARK.md)
- validation and operations notes: [docs/VALIDATION_GUIDE.md](docs/VALIDATION_GUIDE.md)
- examples and payloads: [examples/README.md](examples/README.md)

## Repository Map

```text
src/cli.ts                stdio entrypoint
src/stdio/proxy.ts        stdio firewall runtime
src/index.ts              HTTP companion service
src/admin/                admin API and built UI hosting
src/middleware/           trust gates and fail-closed validators
src/cache/                L1 memory cache and L2 file cache
src/proxy/                HTTP routing, circuit breaker, response sanitizing
ui/                       React dashboard
scripts/                  demos and repeatable benchmarks
examples/                 demo target and payload samples
docs/                     threat model, benchmark, and operator notes
tests/                    Jest suites for gates, HTTP, admin, and stdio paths
```

## Trust Gates

| Gate | Purpose | Code |
|---|---|---|
| `nhi-auth-validator` | fail-closed shared-secret authorization envelope and scope extraction | `src/middleware/nhi-auth-validator.ts` |
| `scope-validator` | reject tool calls outside declared scopes | `src/middleware/scope-validator.ts` |
| `color-boundary` | block red/blue mixing and session color changes | `src/middleware/color-boundary.ts` |
| `preflight-validator` | require preflight IDs for high-trust actions | `src/middleware/preflight-validator.ts` |
| `schema-validator` | strict tool-argument validation for registered schemas | `src/middleware/schema-validator.ts` |
| `ast-egress-filter` | fail-closed string inspection for exfiltration and injection markers | `src/middleware/ast-egress-filter.ts` |

## Environment Variables

| Variable | Mode | Purpose | Default |
|---|---|---|---|
| `PROXY_AUTH_TOKEN` | stdio + HTTP | shared secret for fail-closed auth | none |
| `MCP_TARGET_COMMAND` | stdio | protected target command for client configs | none |
| `MCP_TARGET_ARGS_JSON` | stdio | JSON array of args for `MCP_TARGET_COMMAND` | none |
| `MCP_TARGET_ARGS` | stdio | space-delimited fallback args for `MCP_TARGET_COMMAND` | none |
| `MCP_TARGET` | stdio | full target command string fallback | none |
| `MCP_CACHE_DIR` | stdio + HTTP | persistent L2 cache directory | `.mcp-cache` |
| `MCP_CACHE_TTL_SECONDS` | stdio + HTTP | cache TTL in seconds | `300` |
| `MCP_ADMIN_ENABLED` | stdio + HTTP | enable admin API and dashboard | `false` |
| `MCP_ADMIN_PORT` | stdio + HTTP | admin port | `9090` |
| `ADMIN_TOKEN` | admin | bearer token for protected admin endpoints | none |
| `MCP_PORT` | HTTP | HTTP companion service port | `3000` |
| `MCP_SERVER_ID` | HTTP | cache namespace key prefix | `default` |
| `MCP_ADMIN_CORS_ORIGIN` | admin | allowed admin origin | `*` |

## Project Files

- changelog: [CHANGELOG.md](CHANGELOG.md)
- security policy: [SECURITY.md](SECURITY.md)
- support guide: [SUPPORT.md](SUPPORT.md)
- code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Current Limits

- The auth envelope is shared-secret based. It is not cryptographic attestation.
- Strict schema enforcement only applies to tools present in the registry.
- The `ast-egress-filter` name is historical. The current implementation is structured recursive string inspection, not a full parser.
- This project is a fail-closed transport firewall, not a sandbox or post-execution containment layer.
