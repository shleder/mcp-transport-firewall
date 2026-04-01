## Distribution Notes

This repo ships as an npm package and the release line is only considered clean when the tag, GitHub Release, and npm version all match.

Current package surface:

- install entry points are `npx -y mcp-transport-firewall` and `npm install -g mcp-transport-firewall`
- the full validation environment can be reproduced with `docker compose up --build`
- tests, demo paths, and benchmark corpus live in this repository
- the npm tarball is smoke-tested before publication

The runtime stays intentionally narrow:

- insert it between an MCP client and a local tool server over stdio
- reuse the same trust gates in the HTTP harness when needed
- keep the trust logic auditable in a small TypeScript codebase

Release work is gated by:

- semver-tagged releases
- local verification on the release commit
- local package metadata assertions before publish
- pre-publish release parity checks for `package.json.version`, semver tag, and expected repo lineage
- repeatable benchmark output
- tarball smoke execution of the packaged CLI
- CI publication of evidence artifacts
- post-publish verification that npm `repository`, `homepage`, `bugs`, and `gitHead` match `shleder/mcp-transport-firewall`
- parity across the git tag, GitHub Release, and published npm version
- synced package docs for install, config, and runtime behavior
- a public repo story that stays narrow: risky local MCP tool calls first, broader control-plane stories second

Useful follow-up docs:

- risk model: `docs/RISK_MODEL.md`
- client config examples: `docs/CLIENT_CONFIG_EXAMPLES.md`
- runtime contract: `docs/RUNTIME_CONTRACT.md`
- verification guide: `docs/VERIFICATION_GUIDE.md`
- workflow intake notes: `docs/GUIDED_SETUP_AND_AUDITS.md`
