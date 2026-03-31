## Assurance Packet

This document maps repo claims to code, tests, and reproducible evidence.

Suggested review order:

1. Read [RISK_MODEL.md](RISK_MODEL.md) for boundary and limits.
2. Read [CLIENT_CONFIG_EXAMPLES.md](CLIENT_CONFIG_EXAMPLES.md) and [RUNTIME_CONTRACT.md](RUNTIME_CONTRACT.md) for setup and runtime behavior.
3. Run `npm run verify:all`.
4. Run `npm run benchmark:stdio -- --json --output evidence.json`.
5. Run `npm run pack:dry-run`.
6. Run `npm run pack:smoke`.
7. Run `docker compose up --build`.
8. Inspect:
   - `http://localhost:9090/metrics`
   - `http://localhost:9090`
   - `tests/`
   - `examples/evidence-corpus.json`
   - `docs/EVIDENCE_BUNDLE.md`

| Claim | Code | Evidence |
|---|---|---|
| Requests are intercepted before downstream tool execution on the primary path | `src/cli.ts`, `src/stdio/proxy.ts` | `tests/cli.test.ts`, `scripts/stdio-demo.mjs` |
| Unsafe traffic fails closed instead of passing through | `src/middleware/*` | denial-code assertions across Jest suites |
| ShadowLeak-style exfiltration is blocked at the request boundary | `src/middleware/ast-egress-filter.ts` | `SHADOWLEAK_DETECTED` cases in tests and benchmark corpus |
| High-trust actions require explicit one-time approval | `src/middleware/preflight-validator.ts` | replay and missing-preflight tests |
| Tool output is sanitized before return | `src/proxy/shadow-leak-sanitizer.ts` | response path in HTTP and stdio runtime |
| Cache behavior is deterministic for allowlisted read-style tools | `src/cache/*` | repeatable allow cases in benchmark corpus |
| Packaged CLI surface still matches the documented entry points | `package.json`, `scripts/pack-smoke.mjs` | `npm run pack:dry-run`, `npm run pack:smoke` |
