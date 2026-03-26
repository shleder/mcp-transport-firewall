# MCP Transport Firewall

Fail-closed stdio firewall for Model Context Protocol tool traffic.

This repository packages two runnable surfaces:

- a primary stdio firewall that sits between an agent client and a local MCP tool server
- an HTTP review harness that reuses the same trust gates for downstream HTTP tool routes

The stdio runtime is the product boundary that matters most. The HTTP `/mcp` server exists for compatibility testing, route registration, cache inspection, and dashboard review.

## What To Read

- evaluator walkthroughs: [docs/EVALUATOR_WALKTHROUGH.md](docs/EVALUATOR_WALKTHROUGH.md)
- threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- reviewer guide: [docs/REVIEWER_GUIDE.md](docs/REVIEWER_GUIDE.md)
- example payloads: [examples/README.md](examples/README.md)

## Security Properties

- fail-closed authorization with a shared-secret NHI-style envelope
- per-tool scope checks before tool execution
- color-boundary enforcement to block mixed trust domains and session color flips
- preflight gates for high-trust (`blue`) actions
- strict schema validation for registered tool contracts
- structured egress inspection for ShadowLeak-style exfiltration, sensitive path access, and shell-injection markers
- response sanitization plus L1/L2 caching for allowlisted read-style tools
- admin API and React dashboard for route, cache, rate-limit, circuit-breaker, preflight, and SIEM inspection

## Repository Map

```text
src/cli.ts                stdio entrypoint
src/stdio/proxy.ts        stdio firewall runtime
src/index.ts              HTTP review harness
src/admin/                admin API and built UI hosting
src/middleware/           trust gates and fail-closed validators
src/cache/                L1 memory cache and L2 file cache
src/proxy/                HTTP routing, circuit breaker, response sanitizing
ui/                       React dashboard
scripts/                  reproducible reviewer demos
examples/                 demo target and payload samples
docs/                     threat model and evaluator guidance
tests/                    Jest suites for gates, HTTP, admin, and stdio paths
```

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

3. Run the full verification set.

```bash
npm run verify:all
```

4. Run the reproducible stdio demo.

```bash
npm run demo:stdio
```

Expected demo outcomes:

- an allowed `search_files` call reaches the target
- the second identical `search_files` call is served from cache
- a ShadowLeak-style `fetch_url` request is blocked with `SHADOWLEAK_DETECTED`
- a request without `_meta.authorization` is blocked with `AUTH_FAILURE`

## Primary Runtime

For the stdio firewall, see [docs/EVALUATOR_WALKTHROUGH.md](docs/EVALUATOR_WALKTHROUGH.md).

For the HTTP review harness, run:

```bash
npm run dev
npm --prefix ui run dev
```

The HTTP path is secondary and exists for compatibility testing, route registration, cache inspection, and dashboard review.

## Docker

```bash
docker compose up --build
```

The Docker packaging brings up the HTTP review harness and the admin dashboard in one container:

- [http://localhost:3000/health](http://localhost:3000/health)
- [http://localhost:9090/health](http://localhost:9090/health)
- [http://localhost:9090](http://localhost:9090)

Use `npm run demo:stdio` for transport-boundary validation. The Docker deployment is primarily a packaged review surface for the dashboard and HTTP compatibility harness.

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
| `MCP_CACHE_DIR` | stdio + HTTP | persistent L2 cache directory | `.mcp-cache` |
| `MCP_CACHE_TTL_SECONDS` | stdio + HTTP | cache TTL in seconds | `300` |
| `MCP_ADMIN_ENABLED` | stdio + HTTP | enable admin API and dashboard | `false` |
| `MCP_ADMIN_PORT` | stdio + HTTP | admin port | `9090` |
| `ADMIN_TOKEN` | admin | bearer token for protected admin endpoints | none |
| `MCP_PORT` | HTTP | HTTP review harness port | `3000` |
| `MCP_SERVER_ID` | HTTP | cache namespace key prefix | `default` |
| `MCP_ADMIN_CORS_ORIGIN` | admin | allowed admin origin | `*` |

## Project Files

- agent instructions: [AGENTS.md](AGENTS.md)
- changelog: [CHANGELOG.md](CHANGELOG.md)
- security policy: [SECURITY.md](SECURITY.md)
- support guide: [SUPPORT.md](SUPPORT.md)
- code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Current Limits

- The auth envelope is shared-secret based. It is not cryptographic attestation.
- Strict schema enforcement only applies to tools present in the registry.
- The `ast-egress-filter` name is historical. The current implementation is structured recursive string inspection, not a full parser.
- This project is a fail-closed transport firewall, not a sandbox or post-execution containment layer.
