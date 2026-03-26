# Reviewer Guide

This repository is easiest to evaluate as a reproducible fail-closed control, not as a product demo.

## Fast Path

1. Install dependencies.

```bash
npm install
npm --prefix ui install
```

2. Run the full verification set.

```bash
npm run verify:all
```

3. Run the stdio attack demo.

```bash
npm run demo:stdio
```

Expected results:

- the first `search_files` request is allowed
- the second identical request returns the cached result
- the ShadowLeak-style request returns `SHADOWLEAK_DETECTED`
- the unauthenticated request returns `AUTH_FAILURE`

## What To Inspect

| Topic | Code | Evidence |
|---|---|---|
| stdio interception path | `src/cli.ts`, `src/stdio/proxy.ts` | `tests/cli.test.ts`, `scripts/stdio-demo.mjs` |
| fail-closed auth | `src/middleware/nhi-auth-validator.ts` | `tests/nhi-auth.test.ts`, `tests/cli.test.ts` |
| scope enforcement | `src/middleware/scope-validator.ts` | `tests/scope-validator.test.ts` |
| cross-tool boundary control | `src/middleware/color-boundary.ts` | `tests/color-boundary.test.ts` |
| preflight gate for blue actions | `src/middleware/preflight-validator.ts` | `tests/preflight-validator.test.ts` |
| strict tool schemas | `src/middleware/schema-validator.ts`, `src/mcp-tool-schemas.ts` | `tests/schema-validator.test.ts` |
| egress blocking | `src/middleware/ast-egress-filter.ts` | `tests/ast-egress-filter.test.ts`, `tests/cli.test.ts` |
| HTTP harness and route fail-closed behavior | `src/index.ts`, `src/proxy/router.ts` | `tests/app.test.ts`, `tests/router.test.ts` |

## Docker Surface

`docker compose up --build` packages the HTTP review harness plus the admin dashboard.

Use Docker when you want:

- a packaged admin UI on port `9090`
- an HTTP `/mcp` harness on port `3000`
- persistent cache storage through the compose volume

Use `npm run demo:stdio` when you want:

- transport-boundary evidence for the stdio runtime
- a local target process that can be inspected directly
- an attack path that fails before the target executes

## Claims This Repo Supports Today

- fail-closed blocking on missing or invalid auth
- fail-closed blocking on scope mismatch
- fail-closed blocking on mixed red/blue trust domains
- fail-closed blocking on missing or replayed preflight IDs
- strict argument validation for registered tool schemas
- blocking of ShadowLeak-style URL exfiltration patterns
- response sanitization and deterministic cache behavior for allowlisted tools

## Claims This Repo Does Not Make

- cryptographic identity attestation
- kernel or container sandboxing
- complete semantic detection of every prompt-injection variant
- formal verification of tool safety
