# MCP Context Optimizer — Integration Examples

## Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "your-server-name": {
      "command": "node",
      "args": ["/path/to/mcp-optimizer/dist/index.js", "original-server-command"],
      "env": {
        "ADMIN_TOKEN": "your-secret-token"
      }
    }
  }
}
```

The proxy sits between Claude Desktop and your MCP server transparently.

## Docker (one command)

```bash
docker run -it --rm \
  -e MCP_TARGET_COMMAND="npx" \
  -e MCP_TARGET_ARGS="-y @modelcontextprotocol/server-filesystem /data" \
  -e ADMIN_ENABLED=true \
  -e ADMIN_PORT=9090 \
  -p 9090:9090 \
  ghcr.io/maksboreichuk88-commits/mcp-server:latest \
  node dist/index.js npx -y @modelcontextprotocol/server-filesystem /data
```

Then open **http://localhost:9090** for the live dashboard.

## LangChain / Python (see `langchain_integration.py`)

The proxy exposes a standard stdio MCP interface, so any MCP-compatible client works without modification.

## Cache Configuration

```json
{
  "cache": {
    "ttlSeconds": 600,
    "alwaysCacheTools": ["read_file", "list_directory", "search_files", "get_schema"],
    "neverCacheTools": ["write_file", "create_file", "delete_file", "execute_command", "insert_row"]
  }
}
```
