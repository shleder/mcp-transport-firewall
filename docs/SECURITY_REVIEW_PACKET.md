
This document maps defensive claims to code, tests, and reproducible evidence.


1. Read [THREAT_MODEL.md](THREAT_MODEL.md) for boundary and limits.
2. Run `npm run verify:all`.
3. Run `npm run benchmark:stdio -- --json > evidence.json`.
4. Run `npm run pack:dry-run`.
5. Run `npm run pack:smoke`.
6. Run `docker compose up --build`.
7. Inspect:
   - `http://localhost:9090/metrics`
   - `http://localhost:9090`
   - `tests/`
   - `examples/evidence-corpus.json`


| Claim | Code | Evidence |
|---|---|---|
| Requests are intercepted before downstream tool execution on the primary path | `src/cli.ts`, `src/stdio/proxy.ts` | `tests/cli.test.ts`, `scripts/stdio-demo.mjs` |
| Unsafe traffic fails closed instead of passing through | `src/middleware/*` | denial-code assertions across Jest suites |
| ShadowLeak-style exfiltration is blocked at the request boundary | `src/middleware/ast-egress-filter.ts` | `SHADOWLEAK_DETECTED` cases in tests and benchmark corpus |
| High-trust actions require explicit one-time approval | `src/middleware/preflight-validator.ts` | replay and missing-preflight tests |
| Tool output is sanitized before return | `src/proxy/shadow-leak-sanitizer.ts` | response path in HTTP and stdio runtime |
| Cache behavior is deterministic for allowlisted read-style tools | `src/cache/*` | repeatable allow cases in benchmark corpus |
| Published-package CLI surface remains aligned with the documented install contract | `package.json`, `scripts/pack-smoke.mjs` | `npm run pack:dry-run`, `npm run pack:smoke` |
| Control-plane state is externally inspectable | `src/admin/index.ts`, `src/metrics/prometheus.ts` | `/stats`, `/blocked-requests/stats`, `/metrics` |


The Prometheus-formatted exporter is designed to expose the smallest useful operational picture for independent inspection:

- `mcp_firewall_http_requests_total`
- `mcp_firewall_stdio_requests_total`
- `mcp_firewall_blocked_requests_total`
- `mcp_firewall_blocked_requests_by_code_total{code="..."}`
- `mcp_firewall_registered_routes`
- `mcp_firewall_preflight_pending`
- `mcp_firewall_preflight_consumed`
- `mcp_firewall_cache_hits_total`
- `mcp_firewall_cache_misses_total`
- `mcp_firewall_circuit_breakers_*`

These metrics do not replace log retention or SIEM pipelines. They provide a scrapeable runtime inspection surface for current firewall state.


After running the benchmark and inspecting the metrics, an operator should be able to answer:

- which attack classes are explicitly denied today
- whether those denials are tested and benchmarked
- whether the repository clearly separates supported claims from limits
- whether the project can be reproduced locally without closed dependencies


This verification note does not claim:

- complete prompt-injection elimination
- cryptographic attestation of every actor in the chain
- containment of arbitrary tool side effects after execution starts
- full protection for every possible MCP deployment topology
