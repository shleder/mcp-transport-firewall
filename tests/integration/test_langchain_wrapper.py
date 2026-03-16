import sys
import os
import pytest

# Ensure examples is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from examples.langchain_mcp_optimizer import get_optimized_mcp_command

def test_optimized_command_basic():
    target = ["node", "server.js"]
    cmd = get_optimized_mcp_command(target)
    
    assert cmd[0] == "mcp-optimizer"
    assert cmd[-2] == "--target"
    assert cmd[-1] == "node server.js"

def test_optimized_command_with_options():
    target = ["npx", "-y", "some-module"]
    cmd = get_optimized_mcp_command(target, config_path="/tmp/config.json", verbose=True)
    
    assert cmd[0] == "mcp-optimizer"
    assert "--verbose" in cmd
    assert "--config" in cmd
    assert "/tmp/config.json" in cmd
    assert cmd[-2] == "--target"
    assert cmd[-1] == "npx -y some-module"

def test_optimized_command_with_spaces():
    target = ["python", "app.py", "--dir", "/my folder/data"]
    cmd = get_optimized_mcp_command(target)
    
    assert cmd[-2] == "--target"
    assert '"/my folder/data"' in cmd[-1]

def test_empty_command():
    with pytest.raises(ValueError, match="target_command cannot be empty"):
        get_optimized_mcp_command([])
