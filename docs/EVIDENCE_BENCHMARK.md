
This repository includes a repeatable stdio benchmark for operators and maintainers. The goal is not to prove perfect detection. The goal is to produce a reproducible packet with measurable `false positives`, `false negatives`, and cache behavior at the transport boundary.


- allow corpus requests that should pass through the stdio firewall unchanged
- blocked corpus requests that should fail closed with a specific denial code
- repeatable cache behavior for allowlisted tools that are expected to stay deterministic
- a JSON summary that can be compared across commits or releases


```bash
npm run benchmark:stdio
```

The command builds the project, launches the stdio firewall, replays the benchmark corpus from [examples/evidence-corpus.json](../examples/evidence-corpus.json), and prints a summary plus a JSON report.

For a machine-readable artifact:

```bash
npm run benchmark:stdio -- --json > evidence.json
```


The benchmark corpus currently covers:

- cacheable `search_files`
- cacheable `read_file`
- ShadowLeak-style `fetch_url` exfiltration
- sensitive-path `read_file`
- shell-injection `execute_command`
- missing-authorization `search_files`
- strict schema rejection for invalid `fetch_url`


- `allow` cases represent traffic that should pass through the stdio firewall with valid NHI authorization and a deterministic local target.
- `false positive` means an `allow` case returned an error instead of reaching the target.
- `cache consistency failure` means a repeated allow case returned a different result than the first response for the same payload.
- `block` cases represent traffic that should fail closed before downstream execution. A `false negative` means the case either returned a result or returned the wrong denial code.
- The corpus is intentionally small and validation-oriented. It is meant to be diffable across commits, not presented as exhaustive coverage of every MCP deployment.


The benchmark passes when all of the following are true:

- all allow corpus requests return a result
- all repeated allow requests match the first response
- all blocked corpus requests return the expected denial code
- `cache consistency failures` is `0`
- `false positives` is `0`
- `false negatives` is `0`


Use the benchmark output as an evidence packet. The JSON summary includes the corpus source, timestamps, verdict, per-case results, and blocked-code counts. That gives maintainers a stable artifact they can diff without reading the implementation first.

The hosted CI workflow is configured to upload this packet as a build artifact named `stdio-evidence-benchmark` and to summarize the key totals in the workflow summary for external review.
