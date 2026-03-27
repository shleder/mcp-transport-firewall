

1. Keep the stdio firewall runnable. `src/cli.ts` and `src/stdio/proxy.ts` are the primary product path.
2. Keep the HTTP review harness runnable. `src/index.ts` must continue to reuse the same trust gates.
3. Keep TypeScript strict and avoid `any` unless the boundary is truly untyped input.
4. Add or update tests when changing trust gates, routing, cache behavior, or admin APIs.
5. If a README or docs claim changes, add evidence in tests, the benchmark corpus, or in `scripts/stdio-demo.mjs`.


Run this before opening a PR:

```bash
npm run verify:all
npm run demo:stdio
npm run benchmark:stdio -- --json > evidence.json
npm run pack:dry-run
npm run pack:smoke
```


- The stdio runtime is the primary firewall surface.
- The HTTP `/mcp` endpoint is a review harness and compatibility layer, not the primary transport boundary.
- The admin server is the control plane for routes, cache, preflight state, rate limits, circuit breakers, dashboard hosting, and metrics export.
- Security-sensitive reports should follow `SECURITY.md`.
- Public repository changes should keep `CHANGELOG.md`, issue templates, and release surfaces current.
- Packaging changes should preserve the public `mcp-transport-firewall` npm contract.
