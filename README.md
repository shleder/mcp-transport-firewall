# MCP Transport Firewall

<p align="center">
  <img src="docs/assets/readme-hero.svg" alt="MCP Transport Firewall wordmark" width="900" />
</p>

<p align="center">
  <strong>Fail-closed proxy for risky local MCP file/search tool calls.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcp-transport-firewall"><img alt="npm version" src="https://img.shields.io/npm/v/mcp-transport-firewall?style=for-the-badge&label=npm" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-0f172a?style=for-the-badge" /></a>
</p>

`mcp-transport-firewall` sits between a coding-agent client and a local downstream MCP server. It inspects `tools/call` over `stdio`, lets read/search-shaped requests continue, and blocks risky exfiltration, path, and shell-style patterns before they reach the target.

The primary story in this repository is one protected local filesystem/search-style workflow over `stdio`.

## One Install Path

Protected downstream proxy mode is the primary integration path.

```json
{
  "mcpServers": {
    "protected-local-tooling": {
      "command": "npx",
      "args": ["-y", "mcp-transport-firewall"],
      "env": {
        "PROXY_AUTH_TOKEN": "replace-with-32-byte-secret",
        "MCP_TARGET_COMMAND": "node",
        "MCP_TARGET_ARGS_JSON": "[\"C:/absolute/path/to/your-mcp-server.js\"]"
      }
    }
  }
}
```

Use `PROXY_AUTH_TOKEN` for fail-closed auth, and `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON` as the default downstream target input. See [docs/CLIENT_CONFIG_EXAMPLES.md](docs/CLIENT_CONFIG_EXAMPLES.md) for the canonical client setup and the proof-only demo target variant.

## One Proof Path

The shortest repo-local proof path is:

```bash
npm install
npm run build
npm run demo:stdio
```

Expected output:

```text
stdio demo passed
allow: tool=search_files callCount=1
cache: second response matched first response for tool=search_files
block: ShadowLeak request denied with code=SHADOWLEAK_DETECTED
block: missing auth denied with code=AUTH_FAILURE
```

See [docs/DEMO_RUN_TRANSCRIPT.md](docs/DEMO_RUN_TRANSCRIPT.md) for the tracked transcript and [docs/PROXY_SETUP.md](docs/PROXY_SETUP.md) for the exact proof flow.

## Best For

- individual Codex and Claude Code users who already run local MCP servers
- local MCP-enabled coding workflows that should not run high-risk calls blindly
- file, read, list, and search-oriented downstream MCP servers
- teams that want a fail-closed transport control before downstream execution

## What This Proves

- the first `search_files` request reaches the downstream target
- the repeated allow request is served from cache
- the risky `fetch_url` exfiltration sample is denied before downstream execution
- the missing-auth sample is denied at the transport boundary

## What This Is Not

- not a kernel, VM, or container sandbox
- not full MCP security for every transport or deployment topology
- not post-execution containment after a tool has already started
- not a guarantee against every prompt-injection or semantic evasion variant

See [docs/LIMITS_AND_NON_GOALS.md](docs/LIMITS_AND_NON_GOALS.md) for the explicit boundaries.

## What It Blocks

- missing or invalid auth envelopes when shared-secret auth is enabled
- scope escalation across tool boundaries
- mixed-trust boundary violations and missing preflight for explicit or default high-trust actions
- schema-smuggled arguments on registered tool contracts
- ShadowLeak-style exfiltration strings, sensitive paths, and shell-injection markers

The primary inspected surface is JSON-RPC `tools/call` over `stdio`. Blocked requests fail closed and are not forwarded to the downstream target.

## Full Verification Path

If you want deeper proof than the short demo path:

```bash
npm run assert:package-metadata
npm test
npm run pack:dry-run
npm run pack:smoke
```

Use [docs/VERIFICATION_GUIDE.md](docs/VERIFICATION_GUIDE.md) for the full evidence and verification map.

## Additional Modes

### Standalone Bundled MCP Server

If you want a self-contained MCP server with bundled diagnostic tools and no downstream target, the package still supports standalone mode:

```bash
npx -y mcp-transport-firewall
```

This exposes `firewall_status` and `firewall_usage`. It is supported, but it is not the primary onboarding story for this repository.

### HTTP Compatibility Harness

The repository also includes an HTTP companion harness, admin API, dashboard, and metrics exporter. Those surfaces are useful for compatibility testing, observability, and packaging validation, but they are secondary to the primary stdio boundary.

```bash
docker compose up --build
```

Control-plane endpoints:

- [http://localhost:3000/health](http://localhost:3000/health)
- [http://localhost:9090/health](http://localhost:9090/health)
- [http://localhost:9090/metrics](http://localhost:9090/metrics)
- [http://localhost:9090](http://localhost:9090)

## Deeper Workflow Docs

If you want a deeper operator walkthrough after the install/proof path:

- workflow hardening guide: [docs/WORKFLOW_HARDENING.md](docs/WORKFLOW_HARDENING.md)
- guided setup notes: [docs/GUIDED_SETUP_AND_AUDITS.md](docs/GUIDED_SETUP_AND_AUDITS.md)

## Trust Gates

| Gate | Enforcement | Code |
|---|---|---|
| `nhi-auth-validator` | fail-closed shared-secret authorization envelope and scope extraction | `src/middleware/nhi-auth-validator.ts` |
| `scope-validator` | reject tool calls outside declared scopes | `src/middleware/scope-validator.ts` |
| `color-boundary` | block mixed trust domains and session color flips | `src/middleware/color-boundary.ts` |
| `preflight-validator` | require one-time preflight IDs for explicit `blue` and default high-trust tools | `src/middleware/preflight-validator.ts` |
| `schema-validator` | enforce strict contracts for registered tool schemas | `src/middleware/schema-validator.ts` |
| `ast-egress-filter` | deny exfiltration, sensitive-path, shell-injection, and epistemic-risk markers | `src/middleware/ast-egress-filter.ts` |

## Package Contract

Supported CLI entry points are:

```bash
npx -y mcp-transport-firewall
npx -y mcp-transport-firewall --help
npm install -g mcp-transport-firewall
```

The recommended order is:

1. prove the boundary locally with `npm run demo:stdio`
2. integrate protected downstream proxy mode in your MCP client
3. use standalone bundled mode only when you explicitly want embedded status tools instead of a downstream target

## Docs

- client setups: [docs/CLIENT_CONFIG_EXAMPLES.md](docs/CLIENT_CONFIG_EXAMPLES.md)
- proxy setup: [docs/PROXY_SETUP.md](docs/PROXY_SETUP.md)
- runtime contract: [docs/RUNTIME_CONTRACT.md](docs/RUNTIME_CONTRACT.md)
- limits and non-goals: [docs/LIMITS_AND_NON_GOALS.md](docs/LIMITS_AND_NON_GOALS.md)
- risk model: [docs/RISK_MODEL.md](docs/RISK_MODEL.md)
- verification guide: [docs/VERIFICATION_GUIDE.md](docs/VERIFICATION_GUIDE.md)
- evidence bundle: [docs/EVIDENCE_BUNDLE.md](docs/EVIDENCE_BUNDLE.md)
- ship checklist: [docs/SHIP_CHECKLIST.md](docs/SHIP_CHECKLIST.md)
- workflow hardening guide: [docs/WORKFLOW_HARDENING.md](docs/WORKFLOW_HARDENING.md)
- guided setup and audits: [docs/GUIDED_SETUP_AND_AUDITS.md](docs/GUIDED_SETUP_AND_AUDITS.md)

Reference docs:

- benchmark guide: [docs/STDIO_BENCHMARK_GUIDE.md](docs/STDIO_BENCHMARK_GUIDE.md)
- benchmark snapshot: [docs/STDIO_BENCHMARK_SNAPSHOT.json](docs/STDIO_BENCHMARK_SNAPSHOT.json)
- demo transcript: [docs/DEMO_RUN_TRANSCRIPT.md](docs/DEMO_RUN_TRANSCRIPT.md)
- architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- risk summary: [docs/RISK_SUMMARY.md](docs/RISK_SUMMARY.md)
- assurance packet: [docs/ASSURANCE_PACKET.md](docs/ASSURANCE_PACKET.md)
- distribution notes: [docs/DISTRIBUTION_NOTES.md](docs/DISTRIBUTION_NOTES.md)
