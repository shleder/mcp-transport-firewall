## Proxy Setup

Use this page when you want the firewall in front of a local read/search-shaped downstream MCP server.
The primary fit is a local MCP client protecting a risky local MCP workflow.

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

If you need a self-contained MCP server without a downstream target, standalone bundled mode is still available through `npx -y mcp-transport-firewall`.

If you want help getting from the demo path to a real protected workflow, use [Setup notes](GUIDED_SETUP_AND_AUDITS.md).
