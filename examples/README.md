

- `demo-target.js`: local JSON-RPC tool server used by the stdio firewall demo and tests
- `evidence-corpus.json`: benchmark corpus for regression and false-positive measurement

The delayed target used to reproduce the shutdown-race regression lives in `tests/fixtures/slow-stdio-target.js`, not in this directory.

For the canonical published-package examples, see [docs/CLIENT_CONFIGS.md](../docs/CLIENT_CONFIGS.md).
For the stable runtime contract, see [docs/INTEGRATION_CONTRACT.md](../docs/INTEGRATION_CONTRACT.md).
For the complete Windows and Linux walkthrough, see [docs/WALKTHROUGH.md](../docs/WALKTHROUGH.md).
For the repeatable benchmark output, see [docs/EVIDENCE_BENCHMARK.md](../docs/EVIDENCE_BENCHMARK.md) and run `npm run benchmark:stdio`.

Maintained package paths:

1. standalone bundled MCP mode via `npx -y mcp-transport-firewall`
2. protected downstream MCP server mode via `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON`
3. protected read-only file and search workflow via `examples/demo-target.js`

Quick demo path:

```bash
npm run build
npm run demo:stdio
```

Manual interactive path:

```bash
npm run start:cli -- -- node examples/demo-target.js
```

Published-package MCP client configuration path:

```json
{
  "mcpServers": {
    "protected-demo-target": {
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

Then write JSON-RPC lines to stdin. If `PROXY_AUTH_TOKEN` is configured, include `_meta.authorization` inside the request body.

Read-only file and search workflow using the packaged CLI:

```powershell
$env:PROXY_AUTH_TOKEN = "12345678901234567890123456789012"
$env:MCP_TARGET_COMMAND = "node"
$env:MCP_TARGET_ARGS_JSON = "[\"C:/absolute/path/to/examples/demo-target.js\"]"
npx --yes mcp-transport-firewall
```

Source-install fallback when you want to execute the repository HEAD instead of the published npm package:

```bash
npx -y github:shleder/mcp-transport-firewall --help
```


- `register-route.json`: admin payload for registering a downstream HTTP tool route
- `tool-call.json`: MCP `tools/call` payload for the HTTP `/mcp` harness

Register a route:

```powershell
curl.exe -X POST http://localhost:9090/routes `
  -H "Authorization: Bearer $env:ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  --data @examples/register-route.json
```

Send a tool call:

```powershell
curl.exe -X POST http://localhost:3000/mcp `
  -H "Authorization: Bearer $nhiHeader" `
  -H "Content-Type: application/json" `
  --data @examples/tool-call.json
```
