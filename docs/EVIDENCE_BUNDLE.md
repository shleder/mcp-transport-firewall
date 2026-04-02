## Evidence Bundle

This page collects the smallest artifact set needed to inspect the repo without reading every source file first.

If you only want the shortest public proof surface, start here:

1. [README.md](../README.md) for the install path and the repo-local proof path
2. [docs/DEMO_RUN_TRANSCRIPT.md](DEMO_RUN_TRANSCRIPT.md) for the exact observed demo output
3. [docs/VERIFICATION_GUIDE.md](VERIFICATION_GUIDE.md) for the deeper verification map

Current local evidence snapshot from the latest validation pass:

- `npm run demo:stdio` passed
- `npm run benchmark:stdio` passed
- benchmark totals: `19` cases, `24` requests, `0` false positives, `0` false negatives, `0` cache consistency failures

Artifact index:

| Artifact | Location | Reproduction |
|---|---|---|
| benchmark JSON snapshot | `docs/STDIO_BENCHMARK_SNAPSHOT.json` | `npm run benchmark:stdio -- --json --output evidence.json` |
| stdio demo transcript | `docs/DEMO_RUN_TRANSCRIPT.md` | `npm run demo:stdio` |
| package install contract | `scripts/assert-package-metadata.mjs` + `tests/release-guardrails.test.ts` | `npm run assert:package-metadata` + `npm test` |
| packaged proxy proof | `tests/package-proxy-smoke.test.ts` | `npm run pack:smoke` |
| architecture diagram | `docs/ARCHITECTURE.md` | tracked file |
| client config guide | `docs/CLIENT_CONFIG_EXAMPLES.md` | tracked file |
| runtime contract | `docs/RUNTIME_CONTRACT.md` | tracked file |
| risk summary | `docs/RISK_SUMMARY.md` | tracked file |
| limits and non-goals | `docs/LIMITS_AND_NON_GOALS.md` | tracked file |

Validation path:

1. Run `npm run verify:all`.
2. Run `npm run benchmark:stdio -- --json --output evidence.json`.
3. Run `npm run demo:stdio`.
4. Run `npm run pack:dry-run`.
5. Run `npm run pack:smoke`.
6. Compare the generated output with the tracked summaries in this directory.

Expected inspection outcomes:

- read-style allow cases are stable across repeats
- blocked cases fail with explicit denial codes
- ShadowLeak evidence includes both single-character and repeated short-chunk URL exfiltration
- mixed-trust and both default-high-trust plus `blue` preflight failures are visible in the corpus
- the package surface still matches the documented CLI entry points
- the packaged install contract is pinned in code and tests
- the client config guide matches the current package behavior
- the runtime contract matches the current denial semantics
- enforcement claims stay separate from limits
