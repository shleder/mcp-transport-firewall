# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows semantic versioning.

## [Unreleased]

### Added

- repeatable stdio evidence benchmark with a validation corpus and JSON output packet
- environment-based stdio target resolution for shorter MCP client configurations
- regression coverage that verifies the proxy kills the target after draining the last piped stdio response

### Changed

- expanded the strict schema registry across common read, write, list, search, execute, and fetch tool contracts
- aligned HTTP and stdio paths around the same primary tool-invocation helper and alias-aware cache defaults
- documented the benchmark methodology and supported schema families for operators and maintainers
- switched the persistent L2 cache to SQLite-backed storage and updated Windows test teardown to close the cache explicitly
- limited npm package contents to the runtime entrypoints and user-facing docs required for one-line installs

## [2.1.1] - 2026-03-26

### Fixed

- drain in-flight stdio responses before shutting the proxy down when client stdin closes
- keep piped and here-string CLI usage aligned with the documented demo path

## [2.1.0] - 2026-03-26

### Added

- real stdio firewall runtime and CLI entrypoint for fail-closed MCP interception
- reusable trust-gate helpers shared across stdio and HTTP paths
- reproducible stdio demo script and local demo target
- user-facing docs for threat model, verification, and local operation
- community and governance files for security reporting, support, and contribution flow

### Changed

- repositioned the repository around stdio-first transport enforcement
- updated CI to run the full verification suite
- tightened admin/dashboard and HTTP harness documentation to match actual scope

### Removed

- stale internal release-note artifacts
- outdated integration examples and editor-specific project artifacts that did not support the current product story

## [2.0.0] - 2026-03-19

### Changed

- migrated the firewall from a fail-open shape to a fail-closed security model
- added trust gates for auth, scope, color boundary, preflight, and egress filtering

## [1.1.0] - 2026-03-17

### Changed

- added fail-closed middleware behavior
- improved ShadowLeak-style response sanitization coverage
