- `demo-target.js`: reproducible downstream JSON-RPC target used for the README demo and regression coverage
- `evidence-corpus.json`: benchmark corpus for regression and false-positive measurement

The delayed target used to reproduce the shutdown-race regression lives in `tests/fixtures/slow-stdio-target.js`, not in this directory.

Related docs:

- client setups: [docs/CLIENT_CONFIG_EXAMPLES.md](../docs/CLIENT_CONFIG_EXAMPLES.md)
- runtime behavior: [docs/RUNTIME_CONTRACT.md](../docs/RUNTIME_CONTRACT.md)
- shortest local proof path: [docs/PROXY_SETUP.md](../docs/PROXY_SETUP.md)
- repeatable benchmark output: [docs/STDIO_BENCHMARK_GUIDE.md](../docs/STDIO_BENCHMARK_GUIDE.md)

Maintained package paths:

1. primary path: protected downstream MCP server mode via `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON`
2. demo path: protected local read/search workflow via `examples/demo-target.js`
3. secondary standalone path: bundled MCP mode via `npx -y mcp-transport-firewall`

Repo-local demo path:

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

Read/search-shaped protected workflow using the packaged CLI:

```powershell
$env:PROXY_AUTH_TOKEN = "12345678901234567890123456789012"
$env:MCP_TARGET_COMMAND = "node"
$env:MCP_TARGET_ARGS_JSON = "[\"C:/absolute/path/to/examples/demo-target.js\"]"
npx --yes mcp-transport-firewall
```

This uses a reproducible demo target for proof and regression coverage. It is not a full filesystem MCP server.

Use the GitHub fallback only when you intentionally want repository HEAD instead of the npm package:

```bash
npx -y github:shleder/mcp-transport-firewall --help
```

Secondary HTTP harness artifacts:

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
