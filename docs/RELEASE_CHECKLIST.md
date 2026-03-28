Use this checklist before creating a tagged public release.

Pre-release:

- confirm `main` is the intended release source
- confirm public docs still match actual runtime behavior
- update `CHANGELOG.md` and `package.json` version together
- confirm the npm package name and install contract remain `mcp-transport-firewall`

Local verification:

- run `npm run verify:all`
- run `npm run demo:stdio`
- run `npm run benchmark:stdio -- --json > evidence.json`
- run `npm run pack:dry-run`
- run `npm run pack:smoke`
- confirm benchmark totals still show `0` false positives, `0` false negatives, and `0` cache consistency failures

Release surfaces:

- confirm `README.md`, `docs/VALIDATION_GUIDE.md`, and `docs/ARTIFACT_PACK.md` still reflect the current package
- confirm `docs/STDIO_BENCHMARK_SNAPSHOT.json` is refreshed if the benchmark corpus changed
- confirm issue tracker state does not contradict current public claims
- confirm Docker metadata and repository links point to the active repository

Tagged release:

- create and push the semver tag that matches `package.json`
- confirm the release workflow runs on the exact tagged commit
- confirm the benchmark artifact is attached or uploaded by the hosted workflow
- confirm the npm publish step uses the expected public registry contract

Post-release:

- confirm `npm view mcp-transport-firewall version` returns the new version
- confirm `npx --yes mcp-transport-firewall --help` works from the public registry
- confirm the GitHub Release references the benchmark artifact
- confirm `main`, npm, and public docs all describe the same release state
