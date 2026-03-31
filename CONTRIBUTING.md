# Change Guide

1. Keep the stdio firewall runnable. `src/cli.ts` and `src/stdio/proxy.ts` are the main path.
2. Keep the HTTP review harness runnable. `src/index.ts` should keep using the same trust gates.
3. Keep TypeScript strict and avoid `any` unless the boundary is truly untyped input.
4. Add or update tests when trust gates, routing, cache behavior, or admin APIs change.
5. If README or docs claims move, back them with tests, the benchmark corpus, or `scripts/stdio-demo.mjs`.

Run this before opening a PR:

```bash
npm run verify:all
npm run demo:stdio
npm run benchmark:stdio -- --json --output evidence.json
npm run pack:dry-run
npm run pack:smoke
```

Keep these surfaces aligned in the same branch when needed:

- `CHANGELOG.md`
- README and linked docs
- release workflow notes
- package metadata and pack smoke expectations

The stdio runtime is the primary firewall surface.
The HTTP `/mcp` endpoint is a review harness, not the main boundary.
The admin server carries routes, cache, preflight state, rate limits, circuit breakers, dashboard hosting, and metrics export.
Sensitive findings still go through `SECURITY.md`.
