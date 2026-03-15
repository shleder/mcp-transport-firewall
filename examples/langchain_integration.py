"""
MCP Context Optimizer — LangChain Integration Example

The MCP Optimizer proxy is transparent to LangChain since it speaks
the same stdio MCP protocol as the underlying server.
Just replace your target server command with the optimizer binary.

Requirements:
    pip install langchain-mcp-adapters
"""
import subprocess
from langchain_mcp_adapters.client import MCPClient

# Original server (without optimizer):
# command = ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/data"]

# With MCP Context Optimizer (drop-in replacement):
command = [
    "node",
    "/path/to/mcp-optimizer/dist/index.js",
    # Config file with cache settings
    "--config", "/path/to/mcp-optimizer/mcp-optimizer.json",
    # Arguments to the target MCP server
    "npx", "-y", "@modelcontextprotocol/server-filesystem", "/data"
]

async def main():
    async with MCPClient(command=command) as client:
        tools = await client.list_tools()
        print(f"Available tools: {[t.name for t in tools]}")

        # First call — goes to target server (cache MISS)
        result1 = await client.call_tool("read_file", {"path": "/data/README.md"})
        print(f"First call (cache miss): {result1}")

        # Second call — served from cache (cache HIT, ~0ms latency)
        result2 = await client.call_tool("read_file", {"path": "/data/README.md"})
        print(f"Second call (cache hit, instant): {result2}")

        # The proxy dashboard is available at http://localhost:9090
        # to monitor hit ratio and saved tokens in real time.

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
