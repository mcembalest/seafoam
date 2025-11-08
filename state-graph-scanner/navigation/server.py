"""
MCP server configuration for navigation tools.
"""
import json
from pathlib import Path
from typing import Any, Dict
from claude_agent_sdk import create_sdk_mcp_server
from .pathfinder import GraphNavigator
from .tools import create_navigation_tools


def create_navigation_server(graph_path: str | Path) -> Dict[str, Any]:
    """
    Create an MCP server with navigation tools for a scanned graph.

    Args:
        graph_path: Path to the state-action-graph.json file

    Returns:
        MCP server configuration object
    """
    # Load the graph
    with open(graph_path, 'r') as f:
        graph_data = json.load(f)

    # Create navigator
    navigator = GraphNavigator(graph_data)

    # Create tools
    tools = create_navigation_tools(navigator)

    # Create and return server
    return create_sdk_mcp_server(
        name="app_navigator",
        version="1.0.0",
        tools=tools
    )
