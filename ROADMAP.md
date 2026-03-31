# Roadmap

This project is already usable as a fail-closed MCP transport firewall. The next steps are about keeping the stdio path solid, making release flow boring, and turning early operator use into real trust, feedback, and repeatable setup paths without bloating the core.

Near term:

- keep one sharp story for the primary user: local Codex or Claude Code operators protecting risky MCP calls
- ship a coherent release line where the git tag, GitHub release, and npm latest all match
- collect first guided setup requests and tight operator feedback from real local workflows
- add more operator notes for Windows and Linux client setups
- keep benchmark snapshots and evidence docs aligned with the current package

Mid term:

- broaden the schema registry for more common MCP tool contracts
- improve dashboard visibility for gate decisions, blocked-request trends, and metrics scrape status
- add more denial-code regression cases for indirect prompt-injection traffic
- keep release checklists and provenance notes versioned with the release line
- turn repeated guided setup pain into clearer product defaults and stronger docs

Later:

- keep benchmark snapshots comparable across releases
- add optional integrations for external metrics collectors and log pipelines without changing the fail-closed core
- document more deployment patterns for local tool servers and operator environments
