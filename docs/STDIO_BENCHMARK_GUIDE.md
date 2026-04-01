## Stdio Benchmark Guide

This repository includes a repeatable stdio benchmark for users and maintainers.
It measures `false positives`, `false negatives`, and cache behavior at the transport boundary.

The benchmark covers:

- allow corpus requests that should pass through the stdio firewall unchanged
- blocked corpus requests that should fail closed with a specific denial code
- repeatable cache behavior for allowlisted tools
- a JSON summary that can be compared across commits or releases

Run it with:

```bash
npm run build
npm run benchmark:stdio
```

The benchmark replays [examples/evidence-corpus.json](../examples/evidence-corpus.json) against the stdio firewall and prints a summary plus a JSON report.

For a machine-readable artifact:

```bash
npm run benchmark:stdio -- --json --output evidence.json
```

The current corpus covers:

- cacheable `search_files`
- cacheable `search`
- cacheable `read_file`
- cacheable `open_file`
- cacheable `list_directory`
- ShadowLeak-style `fetch_url` exfiltration
- sensitive-path `read_file`
- sensitive-path `write_file`
- shell-injection `execute_command`
- epistemic-contradiction denial on `search_files`
- missing-authorization `search_files`
- missing-scope denial on `execute_command`
- strict schema rejection for invalid `fetch_url`
- strict schema rejection for smuggled `write_file` arguments
- mixed-trust cross-tool hijack denial in a bundled `tools` payload
- missing and unregistered preflight IDs for `blue` actions

Definitions:

- `allow` cases should pass through the stdio firewall with valid NHI authorization and a deterministic local target
- `false positive` means an `allow` case returned an error instead of reaching the target
- `cache consistency failure` means a repeated allow case returned a different result than the first response
- `block` cases should fail closed before downstream execution
- `false negative` means a block case returned a result or the wrong denial code

The benchmark passes when:

- all allow corpus requests return a result
- all repeated allow requests match the first response
- all blocked corpus requests return the expected denial code
- `cache consistency failures` is `0`
- `false positives` is `0`
- `false negatives` is `0`

The JSON summary includes the corpus source, timestamps, verdict, per-case results, and blocked-code counts.
CI uploads this artifact as `stdio-evidence-benchmark` and summarizes the key totals in the workflow summary.
