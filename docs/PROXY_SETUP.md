## Proxy Setup

Use this page when you want the firewall in front of one local filesystem/search MCP workflow.
The primary fit is a single user proving repo investigation or config review before rolling the pattern out any wider.

Primary proof path:

```bash
npm install
npm --prefix ui install
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

What this proves:

- the first `search_files` request reaches the downstream target
- the second identical `search_files` request is served from cache
- the `fetch_url` exfiltration sample is denied before downstream execution
- the missing-auth sample is denied at the transport boundary

## 3-To-5 Minute Rollout

1. run `npm run demo:stdio` and confirm the allow, cache, and deny lines above
2. point `MCP_TARGET_COMMAND` and `MCP_TARGET_ARGS_JSON` at one local filesystem/search MCP server
3. ask the agent for one safe search or read action in the real workflow
4. confirm one risky request still fails closed before downstream execution

If that four-step path is not clear yet, do not widen the scope to team rollout or secondary modes.

After the proof:

```bash
npm run verify:all
npm run benchmark:stdio -- --json --output evidence.json
npm run pack:dry-run
npm run pack:smoke
```

Manual stdio launch:

```bash
npm run build
npm run start:cli -- -- node examples/demo-target.js
```

Secondary HTTP harness, dashboard, and metrics exporter:

```bash
docker compose up --build
curl http://localhost:9090/metrics
```

The Docker path is useful for observability and packaging validation. The stdio path stays the main proof of transport-boundary enforcement.

Supported CLI entry points:

```bash
npx -y mcp-transport-firewall
npx -y mcp-transport-firewall --help
npm install -g mcp-transport-firewall
```

Recommended client configuration:

```json
{
  "mcpServers": {
    "protected-filesystem-search": {
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

This is the main package story. The Docker path and standalone bundled server are still supported, but they are secondary to the protected filesystem/search workflow.

If you need a self-contained MCP server without a downstream target, standalone bundled mode is still available through `npx -y mcp-transport-firewall`.

If you want help getting from the demo path to a real protected workflow, use [Guided setup and audits](GUIDED_SETUP_AND_AUDITS.md).
