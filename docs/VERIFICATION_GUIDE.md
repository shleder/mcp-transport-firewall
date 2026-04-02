## Verification Guide

Updated: 2026-04-02

This repository is easiest to verify as a reproducible transport control, not as a polished product demo.

Recommended verification flow:

1. inspect the risk model in [RISK_MODEL.md](RISK_MODEL.md)
2. inspect the local setup examples in [CLIENT_CONFIG_EXAMPLES.md](CLIENT_CONFIG_EXAMPLES.md)
3. inspect the runtime guarantees in [RUNTIME_CONTRACT.md](RUNTIME_CONTRACT.md)
4. run `npm run assert:package-metadata`
5. run `npm test`
6. run `npm run verify:all`
7. run `npm run benchmark:stdio -- --json --output evidence.json`
8. run `npm run pack:dry-run`
9. run `npm run pack:smoke`
10. inspect `/metrics` on the admin control plane when running the Docker path
11. compare documented claims to tests, benchmark results, tarball behavior, and control-plane state

| Topic | Code | Evidence |
|---|---|---|
| stdio interception path | `src/cli.ts`, `src/stdio/proxy.ts` | `tests/cli.test.ts`, `scripts/stdio-demo.mjs` |
| repeatable evidence corpus | `scripts/stdio-benchmark.mjs`, `examples/evidence-corpus.json` | `docs/STDIO_BENCHMARK_GUIDE.md` |
| package install contract | `scripts/assert-package-metadata.mjs` | `tests/release-guardrails.test.ts` |
| packaged downstream proxy proof | `scripts/pack-smoke.mjs` | `tests/package-proxy-smoke.test.ts` |
| fail-closed auth | `src/middleware/nhi-auth-validator.ts` | `tests/nhi-auth.test.ts`, `tests/cli.test.ts` |
| scope enforcement | `src/middleware/scope-validator.ts` | `tests/scope-validator.test.ts` |
| trust-domain separation | `src/middleware/color-boundary.ts` | `tests/color-boundary.test.ts` |
| high-trust preflight control | `src/middleware/preflight-validator.ts` | `tests/preflight-validator.test.ts` |
| strict tool schemas | `src/middleware/schema-validator.ts`, `src/mcp-tool-schemas.ts` | `tests/schema-validator.test.ts` |
| exfiltration and injection blocking | `src/middleware/ast-egress-filter.ts` | `tests/ast-egress-filter.test.ts`, `tests/cli.test.ts` |
| HTTP harness and route fail-closed behavior | `src/index.ts`, `src/proxy/router.ts` | `tests/app.test.ts`, `tests/router.test.ts` |
| blocked-request and Prometheus metrics | `src/admin/index.ts`, `src/metrics/prometheus.ts` | `tests/admin.test.ts` |

`docker compose up --build` packages:

- the HTTP compatibility harness on port `3000`
- the admin control plane on port `9090`
- the Prometheus-formatted exporter at `http://localhost:9090/metrics`
- persistent cache storage through the compose volume

Use the Docker path when you want:

- a scrapeable control-plane metrics surface
- a built dashboard for blocked requests and cache behavior
- a packaged environment for independent inspection

Use the stdio path when you want:

- direct validation of the transport boundary
- proof that blocked traffic fails before tool execution
- reproducible benchmark output from a deterministic local target

CI does four useful things:

- runs the full verification suite
- keeps the package install contract pinned in testable metadata guardrails
- uploads a JSON benchmark artifact named `stdio-evidence-benchmark`
- runs distributable tarball smoke checks before npm publication

The artifact answers:

- do blocked corpus cases fail with the expected denial code?
- do allow corpus cases stay stable across repeats?
- did a change alter cache consistency or increase false positives?
- does the packaged CLI still expose the documented `mcp-transport-firewall` entry points?

What this repo currently demonstrates:

- fail-closed blocking on missing or invalid auth
- fail-closed blocking on scope mismatch
- fail-closed blocking on mixed red/blue trust domains
- fail-closed blocking on missing or replayed preflight IDs
- strict argument validation for registered tool schemas
- blocking of ShadowLeak-style exfiltration patterns
- response sanitization before tool output is returned
- reproducible benchmark output and control-plane metrics

What it does not claim:

- cryptographic proof of tool identity
- complete prompt-injection elimination
- sandboxing of tool execution
- post-execution rollback or containment
- universal coverage for every possible MCP tool contract
