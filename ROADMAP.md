
This project is usable today as a fail-closed MCP transport firewall. The roadmap is organized around strengthening its value as an open defensive baseline for agent toolchains.


- expand the benchmark corpus for more MCP contract families
- add more denial-code regression cases for indirect prompt-injection style traffic
- restore GitHub-hosted Actions execution so public CI can publish benchmark artifacts and gate npm releases
- publish the first semver-tagged npm release for the `mcp-transport-firewall` package name once hosted CI is restored


- broaden the schema registry for additional widely used MCP tool contracts
- improve dashboard visibility for gate decisions, blocked-request trends, and metrics scrape status
- add more cross-platform operator notes for Windows and Linux client configurations
- add release checklists and signed provenance review notes for public npm tags


- publish versioned benchmark snapshots for longitudinal comparison across releases
- add optional integrations for external metrics collectors and log pipelines without changing the fail-closed core
- document reference deployment patterns for open-source agent frameworks and local tool servers
