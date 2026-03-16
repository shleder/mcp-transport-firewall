"""
MCP Context Optimizer — LangChain Python Wrapper

Provides a production-ready wrapper to transparently inject the `mcp-optimizer` 
CLI utility into LangChain's MCP integration as a transitive dependency.
"""

from typing import List, Optional

def get_optimized_mcp_command(
    target_command: List[str],
    config_path: Optional[str] = None,
    verbose: bool = False
) -> List[str]:
    """
    Transforms a standard MCP server command list into an optimized proxy command.

    Args:
        target_command: The original target MCP command as a list of strings
            (e.g., ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/data"])
        config_path: Optional path to an mcp-optimizer JSON configuration file.
        verbose: Enable verbose logging on the proxy.

    Returns:
        A list of strings representing the proxy execution command.
    """
    if not target_command:
        raise ValueError("target_command cannot be empty")

    cmd = ["mcp-optimizer"]

    if verbose:
        cmd.append("--verbose")

    if config_path:
        cmd.extend(["--config", config_path])

    # Safely quote the inner target command for the mcp-optimizer args parser
    target_str = " ".join(
        f'"{arg}"' if " " in arg or '"' in arg or "'" in arg else arg 
        for arg in target_command
    )
    cmd.extend(["--target", target_str])

    return cmd

# Optional Extension:
# If using langchain-mcp-adapters directly, this class can be used as a drop-in replacement:
#
# from langchain_mcp_adapters.client import MCPClient
# class OptimizedMCPClient(MCPClient):
#     def __init__(self, command: List[str], config_path: Optional[str] = None, verbose: bool = False, **kwargs):
#         optimized_command = get_optimized_mcp_command(command, config_path, verbose)
#         super().__init__(command=optimized_command, **kwargs)
