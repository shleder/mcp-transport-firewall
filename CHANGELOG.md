# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows semantic versioning.

## [Unreleased]

### Added

- repeatable stdio evidence benchmark with a reviewer corpus and JSON output packet

### Changed

- expanded the strict schema registry across common read, write, list, search, execute, and fetch tool contracts
- aligned HTTP and stdio paths around the same primary tool-invocation helper and alias-aware cache defaults
- documented the benchmark methodology and supported schema families for external reviewers

## [2.1.1] - 2026-03-26

### Fixed

- drain in-flight stdio responses before shutting the proxy down when client stdin closes
- keep piped and here-string CLI usage aligned with the documented reviewer demo path

## [2.1.0] - 2026-03-26

### Added

- real stdio firewall runtime and CLI entrypoint for fail-closed MCP interception
- reusable trust-gate helpers shared across stdio and HTTP paths
- reproducible stdio demo script and local demo target
- reviewer-facing docs for threat model, verification, and agent instructions
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
