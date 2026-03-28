
This repository is published as a public defensive security control.


- source code is published in a public repository
- the project is licensed under MIT
- the public install contract is `npx mcp-transport-firewall` and `npm install -g mcp-transport-firewall`
- the full review environment can be reproduced with `docker compose up --build`
- test suites, demo paths, and benchmark corpus are included in the repository
- issue templates, security reporting guidance, and contribution guidance are public
- the npm tarball is smoke-tested before publication


The runtime is designed as a narrow, model-agnostic transport control:

- insert between an MCP client and a local tool server over stdio
- reuse the same trust gates in an HTTP harness when needed
- keep the trust logic auditable in a small TypeScript codebase

This architecture supports direct reuse, fork-based adaptation, and third-party benchmarking without requiring a hosted control plane.


Public npm publication is gated by:

- semver-tagged releases
- local verification on the release commit
- repeatable benchmark output
- tarball smoke execution of the packaged CLI
- hosted CI publication of evidence artifacts


- threat model: `docs/THREAT_MODEL.md`
- validation guide: `docs/VALIDATION_GUIDE.md`
- benchmark methodology: `docs/EVIDENCE_BENCHMARK.md`
- verification packet: `docs/SECURITY_REVIEW_PACKET.md`
- GitHub Actions benchmark artifact: `stdio-evidence-benchmark`
- semver release workflow: `.github/workflows/release-npm.yml`


- bug reports for reproducible defects
- detection-gap reports for missed unsafe flows or false positives
- feature proposals for new trust gates, schemas, corpora, or operational tooling
- security reports through the repository security policy


- expanded benchmark corpora for additional MCP tool contracts
- broader test coverage for denial classes and cache invariants
- additional operator notes for cross-platform deployment
- continued publication of code, tests, and evidence artifacts in the public repository
