## Client Config Examples

Use this page when wiring `mcp-transport-firewall` into a local MCP setup.
The default path is the protected downstream proxy.
The primary fit is an individual Codex or Claude Code user protecting a risky local MCP workflow.

Supported entry points:

```bash
npx -y mcp-transport-firewall
npm install -g mcp-transport-firewall
```

Recommended order:

1. protected downstream MCP server
2. protected local read/search demo
3. standalone bundled MCP server
4. direct terminal and CLI flow

## Protected downstream MCP server

Use this when you already have an MCP server and want the firewall in front of it.

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

Target input notes:

- prefer `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON`
- use `MCP_TARGET_ARGS` only when JSON array args are not available
- use `MCP_TARGET` only as a full-command fallback
- set `MCP_TARGET_TIMEOUT_MS` when you need a downstream timeout other than the default `30000`

If `PROXY_AUTH_TOKEN` is configured, client requests must carry `_meta.authorization` in the request body. See `scripts/stdio-demo.mjs` for a concrete Bearer envelope example.

## Protected local read/search demo

Use this when you want the smallest reproducible protected workflow backed by a local read-only MCP server you control.

```powershell
$env:PROXY_AUTH_TOKEN = "12345678901234567890123456789012"
$env:MCP_TARGET_COMMAND = "node"
$env:MCP_TARGET_ARGS_JSON = "[\"C:/absolute/path/to/your-mcp-server.js\"]"
npx --yes mcp-transport-firewall
```

Example request shape:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_files",
    "arguments": {
      "query": "TODO"
    },
    "_meta": {
      "authorization": "Bearer BASE64_JSON_TOKEN"
    }
  }
}
```

This is a demo path for proof and regression testing, not a full filesystem MCP server.

## Standalone bundled MCP server

Use this when you want a self-contained MCP server with `firewall_status` and `firewall_usage`.

```json
{
  "mcpServers": {
    "transport-firewall": {
      "command": "npx",
      "args": ["-y", "mcp-transport-firewall"]
    }
  }
}
```

This path:

- starts the bundled standalone MCP server
- needs no downstream target command
- exposes runtime status and launch guidance tools immediately

## Direct terminal and CLI flow

```bash
npx --yes mcp-transport-firewall --help
npx --yes mcp-transport-firewall
npx --yes mcp-transport-firewall -- node C:/absolute/path/to/your-mcp-server.js
```

If you want help adapting one of these examples to a real local MCP stack, use [workflow intake notes](GUIDED_SETUP_AND_AUDITS.md).
