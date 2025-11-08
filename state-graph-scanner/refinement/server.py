"""
MCP server configuration for graph refinement tools.
"""
import json
from pathlib import Path
from typing import Any, Dict
from claude_agent_sdk import create_sdk_mcp_server
from .graph_refiner import GraphRefiner
from .tools import create_refinement_tools


def create_refinement_server(graph_path: str | Path) -> tuple[Dict[str, Any], GraphRefiner]:
    """
    Create an MCP server with refinement tools for a scanned graph.

    Args:
        graph_path: Path to the state-action-graph.json file

    Returns:
        Tuple of (MCP server configuration, GraphRefiner instance)
    """
    # Load the graph
    with open(graph_path, 'r') as f:
        graph_data = json.load(f)

    # Store original counts
    if 'original_state_count' not in graph_data['graph']:
        graph_data['graph']['original_state_count'] = len(graph_data['graph']['states'])
    if 'original_transition_count' not in graph_data['graph']:
        graph_data['graph']['original_transition_count'] = len(graph_data['graph']['transitions'])

    # Create refiner
    refiner = GraphRefiner(graph_data)

    # Create tools
    tools = create_refinement_tools(refiner)

    # Create and return server
    server = create_sdk_mcp_server(
        name="graph_refiner",
        version="1.0.0",
        tools=tools
    )

    return server, refiner
