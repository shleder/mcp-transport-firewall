
Canonical Client Configurations

This document defines the package-first client configuration shapes that are kept in sync with the published npm package.

All examples assume the public install contract:

```bash
npx -y mcp-transport-firewall
npm install -g mcp-transport-firewall
```

Supported package integration paths:

1. standalone bundled MCP server
2. protected downstream MCP server
3. protected read-only file and search workflow
4. direct terminal and CLI flow

Standalone bundled MCP server

Use this path when you want a self-contained MCP server with the bundled `firewall_status` and `firewall_usage` tools.

Generic MCP JSON configuration:

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

Desktop-style configuration:

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

What this path does:

- starts the bundled standalone MCP server
- requires no downstream target command
- exposes runtime status and launch guidance tools immediately

Protected downstream MCP server

Use this path when you already have an MCP server and want the firewall to sit in front of it.

Generic MCP JSON configuration:

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

Authentication note:

If `PROXY_AUTH_TOKEN` is configured, client requests must carry `_meta.authorization` in the request body. See `scripts/stdio-demo.mjs` for a concrete Bearer envelope example.

Protected read-only file and search workflow

Use this path when you want a narrow read and search flow backed by the demo target or a similar read-only MCP server.

PowerShell launch example:

```powershell
$env:PROXY_AUTH_TOKEN = "12345678901234567890123456789012"
$env:MCP_TARGET_COMMAND = "node"
$env:MCP_TARGET_ARGS_JSON = "[\"C:/absolute/path/to/examples/demo-target.js\"]"
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

This path is the smallest reproducible flow for:

- `search_files`
- `search`
- `read_file`
- `open_file`
- `list_directory`

Direct terminal and CLI flow

Use these commands when you want to test the package directly without a client config file.

Help:

```bash
npx --yes mcp-transport-firewall --help
```

Standalone bundled MCP server:

```bash
npx --yes mcp-transport-firewall
```

Protected downstream target via `--`:

```bash
npx --yes mcp-transport-firewall -- node examples/demo-target.js
```

Repository-head fallback:

```bash
npx -y github:shleder/mcp-transport-firewall --help
```

Use the GitHub fallback only when you deliberately want the repository HEAD instead of the published npm package.
