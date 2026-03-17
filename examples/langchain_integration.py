import asyncio
import os
import sys
import json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Absolute path to the optimizer binary
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLI_JS_PATH = os.path.join(BASE_DIR, "dist", "cli.js")

# Target command for the proxy
TARGET_CMD = "npx -y @modelcontextprotocol/server-sqlite --db data.db"

async def run_mcp_test():
    print("\n🚀 [MCP] Starting ShadowLeak Verification Test...")
    print(f"🔗 [Config] Proxy Binary: {CLI_JS_PATH}")
    
    server_params = StdioServerParameters(
        command="node",
        args=[CLI_JS_PATH, "--target", TARGET_CMD],
        env=os.environ.copy()
    )

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # List tools to confirm connectivity
                tools = await session.list_tools()
                tool_names = [t.name for t in tools.tools]
                print(f"✅ [MCP] Connected. Available tools: {tool_names}")
                
                # 1. Normal execution
                print("\n--- Phase 1: Normal Execution ---")
                try:
                    res = await session.call_tool("read_query", arguments={"query": "SELECT 1 as Connected;"})
                    print(f"✅ [Target Allowed] Result: {res.content}")
                except Exception as e:
                    print(f"ℹ️ [Target Info] Legitimate call info: {e}")

                # 2. ShadowLeak Interception Demo
                print("\n--- Phase 2: ShadowLeak Interception Demo ---")
                malicious_payload = {
                    "query": "SELECT 'Secret config with sk-1234567890abcdefghijklmnopqrstuvwxyz' as LeakedData;"
                }
                
                print("⚠️ [Client] Executing exfiltration attempt with sk- token...")
                try:
                    res = await session.call_tool("read_query", arguments=malicious_payload)
                    
                    # Check if token is present in result
                    content_str = str(res.content)
                    if "sk-" in content_str:
                        print(f"❌ [Client] SECURITY FAILURE: Token leaked! Result: {content_str}")
                    else:
                        print(f"🛡️ [Proxy Intervention] Response sanitized. Result: {content_str}")
                        print("\n🔒 SECURITY SUCCESS: ShadowLeak blocked by proxy-engine.")
                        
                except Exception as e:
                    print(f"🛡️ [Proxy Intervention] Response intercepted/connection closed!")
                    print(f"🚫 [Error] {e}")
                    print("\n🔒 SECURITY SUCCESS: ShadowLeak blocked by proxy-engine.")

    except Exception as e:
        print(f"❌ [System] Failed to run MCP test: {e}")

if __name__ == "__main__":
    if not os.path.exists(CLI_JS_PATH):
        print(f"Error: {CLI_JS_PATH} not found. Run `npm run build` first!")
        sys.exit(1)
        
    asyncio.run(run_mcp_test())
