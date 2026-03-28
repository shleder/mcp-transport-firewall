
All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows semantic versioning.


- 2.2.2 removes noisy cache-hit stderr output from the runtime path
- 2.2.2 normalizes remaining compatibility and validation wording in public surfaces

- 2.2.0 adds a bundled standalone MCP server so `npx mcp-transport-firewall` is useful without a separately installed downstream target
- 2.2.0 preserves downstream proxy mode through `--target`, `MCP_TARGET_COMMAND`, and `MCP_TARGET`
- 2.2.0 extends package smoke coverage to validate standalone MCP tool discovery and invocation from the packed tarball



- repeatable stdio evidence benchmark with a validation corpus and JSON output packet
- environment-based stdio target resolution for shorter MCP client configurations
- regression coverage that verifies the proxy kills the target after draining the last piped stdio response
- Prometheus-formatted control-plane metrics exporter for blocked requests, cache state, routes, preflight, and circuit breakers
- verification-oriented documentation for threat modeling, validation, and open-source distribution
- npm package smoke test for the published `mcp-transport-firewall` CLI contract
- semver-tagged npm release workflow and dedicated package-smoke workflow definitions


- expanded the strict schema registry across common read, write, list, search, execute, and fetch tool contracts
- aligned HTTP and stdio paths around the same primary tool-invocation helper and alias-aware cache defaults
- documented the benchmark methodology and supported schema families for operators and maintainers
- switched the persistent L2 cache to SQLite-backed storage and updated Windows test teardown to close the cache explicitly
- limited npm package contents to the runtime entrypoints and user-facing docs required for one-line installs
- updated CI to publish the stdio benchmark artifact, workflow summary, and tarball smoke evidence for reproducible inspection



- drain in-flight stdio responses before shutting the proxy down when client stdin closes
- keep piped and here-string CLI usage aligned with the documented demo path



- real stdio firewall runtime and CLI entrypoint for fail-closed MCP interception
- reusable trust-gate helpers shared across stdio and HTTP paths
- reproducible stdio demo script and local demo target
- user-facing docs for threat model, verification, and local operation
- community and governance files for security reporting, support, and contribution flow


- repositioned the repository around stdio-first transport enforcement
- updated CI to run the full verification suite
- tightened admin/dashboard and HTTP harness documentation to match actual scope


- stale internal release-note artifacts
- outdated integration examples and editor-specific project artifacts that did not support the current product story



- migrated the firewall from a fail-open shape to a fail-closed security model
- added trust gates for auth, scope, color boundary, preflight, and egress filtering



- added fail-closed middleware behavior
- improved ShadowLeak-style response sanitization coverage
