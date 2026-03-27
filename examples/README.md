# Examples

## Stdio Demo

- `demo-target.js`: local JSON-RPC tool server used by the stdio firewall demo and tests
- `evidence-corpus.json`: benchmark corpus for regression and false-positive measurement

The delayed target used to reproduce the shutdown-race regression lives in `tests/fixtures/slow-stdio-target.js`, not in this directory.

For the complete Windows and Linux walkthrough, see [docs/EVALUATOR_WALKTHROUGH.md](../docs/EVALUATOR_WALKTHROUGH.md).
For the repeatable benchmark output, see [docs/EVIDENCE_BENCHMARK.md](../docs/EVIDENCE_BENCHMARK.md) and run `npm run benchmark:stdio`.

Quick demo path:

```bash
npm run build
npm run demo:stdio
```

Manual interactive path:

```bash
npm run start:cli -- -- node examples/demo-target.js
```

MCP client configuration path:

```json
{
  "mcpServers": {
    "protected-demo-target": {
      "command": "npx",
      "args": ["-y", "github:maksboreichuk88-commits/MCP-server"],
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

## HTTP Companion Service

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
