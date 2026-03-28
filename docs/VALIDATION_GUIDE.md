
This repository is easiest to validate as a **reproducible defensive control**, not as a product demo.

The most useful validation flow is:

1. inspect the threat model in [THREAT_MODEL.md](THREAT_MODEL.md)
2. run `npm run verify:all`
3. run `npm run benchmark:stdio -- --json > evidence.json`
4. run `npm run pack:dry-run`
5. run `npm run pack:smoke`
6. inspect `/metrics` on the admin control plane when running the Docker path
7. compare documented claims to tests, benchmark results, tarball behavior, and control-plane state


| Topic | Code | Evidence |
|---|---|---|
| stdio interception path | `src/cli.ts`, `src/stdio/proxy.ts` | `tests/cli.test.ts`, `scripts/stdio-demo.mjs` |
| repeatable evidence corpus | `scripts/stdio-benchmark.mjs`, `examples/evidence-corpus.json` | `docs/EVIDENCE_BENCHMARK.md` |
| fail-closed auth | `src/middleware/nhi-auth-validator.ts` | `tests/nhi-auth.test.ts`, `tests/cli.test.ts` |
| scope enforcement | `src/middleware/scope-validator.ts` | `tests/scope-validator.test.ts` |
| trust-domain separation | `src/middleware/color-boundary.ts` | `tests/color-boundary.test.ts` |
| high-trust preflight control | `src/middleware/preflight-validator.ts` | `tests/preflight-validator.test.ts` |
| strict tool schemas | `src/middleware/schema-validator.ts`, `src/mcp-tool-schemas.ts` | `tests/schema-validator.test.ts` |
| exfiltration and injection blocking | `src/middleware/ast-egress-filter.ts` | `tests/ast-egress-filter.test.ts`, `tests/cli.test.ts` |
| HTTP harness and route fail-closed behavior | `src/index.ts`, `src/proxy/router.ts` | `tests/app.test.ts`, `tests/router.test.ts` |
| blocked-request and Prometheus metrics | `src/admin/index.ts`, `src/metrics/prometheus.ts` | `tests/admin.test.ts` |


`docker compose up --build` packages:

- the HTTP review harness on port `3000`
- the admin control plane on port `9090`
- the Prometheus-formatted exporter at `http://localhost:9090/metrics`
- persistent cache storage through the compose volume

Use the Docker path when you want:

- a scrapeable control-plane metrics surface
- a built dashboard for blocked requests and cache behavior
- a packaged environment for independent inspection

Use the stdio walkthrough when you want:

- direct validation of the transport boundary
- proof that blocked traffic fails before tool execution
- reproducible benchmark output from a deterministic local target


The repository CI is designed to do three things on hosted runners:

- run the full verification suite
- upload a JSON benchmark artifact named `stdio-evidence-benchmark`
- run distributable tarball smoke checks before npm publication

The artifact is designed to answer the following inspection questions:

- do blocked corpus cases fail with the expected denial code?
- do allow corpus cases remain stable across repeats?
- did a change alter cache consistency or increase false positives?
- does the packaged CLI still expose the documented `mcp-transport-firewall` contract?


- fail-closed blocking on missing or invalid auth
- fail-closed blocking on scope mismatch
- fail-closed blocking on mixed red/blue trust domains
- fail-closed blocking on missing or replayed preflight IDs
- strict argument validation for registered tool schemas
- blocking of ShadowLeak-style exfiltration patterns
- response sanitization before tool output is returned
- reproducible benchmark output and control-plane metrics


- cryptographic proof of tool identity
- complete prompt-injection elimination
- sandboxing of tool execution
- post-execution rollback or containment
- universal coverage for every possible MCP tool contract
