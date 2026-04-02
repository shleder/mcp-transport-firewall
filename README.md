# Toolwall

Toolwall is a fail-closed boundary for one local filesystem/search MCP workflow over `stdio`.

The display name on this repo surface is `Toolwall`. The current npm package, repo slug, and CLI entrypoint stay `mcp-transport-firewall`.

`mcp-transport-firewall` sits between a coding-agent client and a local downstream MCP server. It inspects `tools/call` over `stdio`, lets read/search-shaped requests continue, and blocks risky exfiltration, path, and shell-style patterns before they reach the target.

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

## One Deeper Verification Path

If you want deeper proof than the short demo path:

```bash
npm run assert:package-metadata
npm test
npm run pack:dry-run
npm run pack:smoke
```

Use [docs/VERIFICATION_GUIDE.md](docs/VERIFICATION_GUIDE.md) for the full verification map and [docs/EVIDENCE_BUNDLE.md](docs/EVIDENCE_BUNDLE.md) for the smallest tracked artifact set.

## Limits And Non-Goals

- not a kernel, VM, or container sandbox
- not a broad MCP platform or hosted control plane
- not post-execution containment after a tool has already started
- not universal coverage for every MCP transport or custom tool contract

See [docs/LIMITS_AND_NON_GOALS.md](docs/LIMITS_AND_NON_GOALS.md) for the explicit boundaries.

## Additional Modes

### Embedded Fallback Path

If you want the packaged diagnostic tools without wiring a separate downstream target, the package still supports the embedded fallback path:

```bash
npx -y mcp-transport-firewall
```

The normal CLI entrypoint still starts the stdio boundary. When no downstream target is configured, it falls back to the bundled `--embedded-target` path and exposes `firewall_status` and `firewall_usage`. It is supported, but it is not the primary onboarding story for this repository.

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

## Trust Gates

| Gate | Enforcement | Code |
|---|---|---|
| `nhi-auth-validator` | fail-closed shared-secret authorization envelope and scope extraction | `src/middleware/nhi-auth-validator.ts` |
| `scope-validator` | reject tool calls outside declared scopes | `src/middleware/scope-validator.ts` |
| `color-boundary` | block mixed trust domains and session color flips | `src/middleware/color-boundary.ts` |
| `ast-egress-filter` | deny exfiltration, sensitive-path, shell-injection, and semantic-risk markers | `src/middleware/ast-egress-filter.ts` |
| `preflight-validator` | require one-time preflight IDs for explicit `blue` and default high-trust tools | `src/middleware/preflight-validator.ts` |
| `schema-validator` | enforce strict contracts for registered tool schemas | `src/middleware/schema-validator.ts` |

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
3. use the embedded fallback path only when you explicitly want the bundled status tools instead of another downstream target

## Docs

- client setups: [docs/CLIENT_CONFIG_EXAMPLES.md](docs/CLIENT_CONFIG_EXAMPLES.md)
- proxy setup: [docs/PROXY_SETUP.md](docs/PROXY_SETUP.md)
- verification guide: [docs/VERIFICATION_GUIDE.md](docs/VERIFICATION_GUIDE.md)
- evidence bundle: [docs/EVIDENCE_BUNDLE.md](docs/EVIDENCE_BUNDLE.md)
- limits and non-goals: [docs/LIMITS_AND_NON_GOALS.md](docs/LIMITS_AND_NON_GOALS.md)
- runtime contract: [docs/RUNTIME_CONTRACT.md](docs/RUNTIME_CONTRACT.md)
- risk model: [docs/RISK_MODEL.md](docs/RISK_MODEL.md)
- demo transcript: [docs/DEMO_RUN_TRANSCRIPT.md](docs/DEMO_RUN_TRANSCRIPT.md)
- benchmark guide: [docs/STDIO_BENCHMARK_GUIDE.md](docs/STDIO_BENCHMARK_GUIDE.md)
- benchmark snapshot: [docs/STDIO_BENCHMARK_SNAPSHOT.json](docs/STDIO_BENCHMARK_SNAPSHOT.json)
