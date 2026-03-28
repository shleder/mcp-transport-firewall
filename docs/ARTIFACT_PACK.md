This page collects the smallest public artifact set needed to inspect the repository without reading every source file first.

Current local evidence snapshot from the latest validation pass:

- `npm run demo:stdio` passed
- `npm run benchmark:stdio -- --json` passed
- benchmark totals: `17` cases, `22` requests, `0` false positives, `0` false negatives, `0` cache consistency failures

Artifact index:

| Artifact | Location | Reproduction |
|---|---|---|
| benchmark JSON snapshot | `docs/STDIO_BENCHMARK_SNAPSHOT.json` | `npm run benchmark:stdio -- --json > evidence.json` |
| stdio demo transcript | `docs/STDIO_DEMO_TRANSCRIPT.md` | `npm run demo:stdio` |
| architecture diagram | `docs/ARCHITECTURE.md` | tracked file |
| threat-model summary | `docs/THREAT_MODEL_SUMMARY.md` | tracked file |
| limits and non-goals summary | `docs/LIMITS_AND_NON_GOALS.md` | tracked file |

Validation path:

1. Run `npm run verify:all`.
2. Run `npm run benchmark:stdio -- --json > evidence.json`.
3. Run `npm run demo:stdio`.
4. Run `npm run pack:dry-run`.
5. Run `npm run pack:smoke`.
6. Compare the generated output with the tracked summaries in this directory.

Expected inspection outcomes:

- read-style allow cases are stable across repeats
- blocked cases fail with explicit denial codes
- mixed-trust and preflight failures are visible in the corpus
- the package surface still matches the documented npm contract
- the repository separates enforcement claims from limits
