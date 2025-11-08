#!/usr/bin/env python3
"""
Interactive graph refinement tool using Claude Agent SDK.

This script helps refine state-action graphs by using Claude to identify
and merge duplicate states, remove low-value states, and improve labels.
"""
import asyncio
import json
import sys
from pathlib import Path
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage
)
from refinement import create_refinement_server


async def auto_refine(graph_path: str, output_path: str):
    """
    Automatically refine a graph using Claude.

    Args:
        graph_path: Path to input graph
        output_path: Path to save refined graph
    """
    print(f"Loading graph from {graph_path}...")
    refine_server, refiner = create_refinement_server(graph_path)

    print(f"Original graph: {len(refiner.states)} states, {len(refiner.transitions)} transitions\n")

    # Configure Claude with refinement tools
    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": """
You are a graph refinement expert. Your job is to clean up state-action graphs
to make them more useful and concise.

Process:
1. First, use analyze_duplicates to identify issues
2. Review the duplicate groups and low-value states
3. Use merge_states to consolidate duplicate states
4. Use remove_state to remove internal/low-value states
5. Use relabel_state to improve unclear labels
6. Use get_refined_graph to get the final result

Goals:
- Reduce from 100+ states to 15-25 high-level user-facing states
- Remove duplicate states (same modal with different selectors)
- Remove internal implementation details
- Keep only states users would perceive
- Ensure labels are clear and natural

Be aggressive in consolidation - we want a clean, minimal graph.
"""
        },
        mcp_servers={"refiner": refine_server},
        allowed_tools=[
            "mcp__refiner__analyze_duplicates",
            "mcp__refiner__merge_states",
            "mcp__refiner__remove_state",
            "mcp__refiner__relabel_state",
            "mcp__refiner__get_graph_summary",
            "mcp__refiner__get_refined_graph"
        ],
        model="sonnet"  # Use Sonnet for better reasoning
    )

    print("Starting automatic refinement with Claude...\n")
    print("="*70)

    async with ClaudeSDKClient(options=options) as client:
        # Ask Claude to refine the graph
        await client.query(
            "Please analyze and refine this state-action graph. "
            "It currently has too many states. Consolidate duplicates, "
            "remove low-value states, and make it more useful. "
            "Aim for 15-25 high-level states."
        )

        # Track what Claude does
        tool_uses = []

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"\n{block.text}\n")
                    elif isinstance(block, ToolUseBlock):
                        tool_uses.append(block.name)
                        print(f"[Using tool: {block.name}]")

            elif isinstance(message, ResultMessage):
                if message.is_error:
                    print(f"\n❌ Error: {message.result}\n")
                else:
                    print(f"\n✓ Refinement complete!")

    print("="*70)
    print(f"\nTools used by Claude: {', '.join(set(tool_uses))}")

    # Get refined graph
    refined_graph = refiner.get_refined_graph()

    # Save it
    with open(output_path, 'w') as f:
        json.dump(refined_graph, f, indent=2)

    print(f"\n✓ Refined graph saved to: {output_path}")
    print(f"\nStats:")
    print(f"  Original:  {refined_graph['metadata']['original_state_count']} states, "
          f"{refined_graph['metadata']['original_transition_count']} transitions")
    print(f"  Refined:   {refined_graph['metadata']['refined_state_count']} states, "
          f"{refined_graph['metadata']['refined_transition_count']} transitions")
    print(f"  Reduction: {refined_graph['metadata']['original_state_count'] - refined_graph['metadata']['refined_state_count']} states removed "
          f"({(1 - refined_graph['metadata']['refined_state_count']/refined_graph['metadata']['original_state_count'])*100:.0f}% reduction)")


async def interactive_refine(graph_path: str):
    """
    Interactive refinement session.

    Args:
        graph_path: Path to graph file
    """
    print(f"Loading graph from {graph_path}...")
    refine_server, refiner = create_refinement_server(graph_path)

    print(f"Loaded: {len(refiner.states)} states, {len(refiner.transitions)} transitions\n")

    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": """
You are helping the user refine a state-action graph. Answer their questions
and help them use the refinement tools to improve the graph.

Available tools:
- analyze_duplicates: Find duplicate and low-value states
- merge_states: Consolidate multiple states into one
- remove_state: Delete a state
- relabel_state: Improve state labels
- get_graph_summary: See current graph stats
- get_refined_graph: Get final refined graph
"""
        },
        mcp_servers={"refiner": refine_server},
        allowed_tools=[
            "mcp__refiner__analyze_duplicates",
            "mcp__refiner__merge_states",
            "mcp__refiner__remove_state",
            "mcp__refiner__relabel_state",
            "mcp__refiner__get_graph_summary",
            "mcp__refiner__get_refined_graph"
        ]
    )

    print("="*70)
    print("Interactive Graph Refinement")
    print("="*70)
    print("\nCommands:")
    print("  - Ask Claude to analyze, merge, or improve the graph")
    print("  - 'save <filename>' to save current graph")
    print("  - 'exit' or 'quit' to end session")
    print()

    async with ClaudeSDKClient(options=options) as client:
        while True:
            try:
                user_input = input("You: ").strip()

                if not user_input:
                    continue

                if user_input.lower() in ['exit', 'quit']:
                    break

                # Handle save command
                if user_input.lower().startswith('save '):
                    filename = user_input.split(' ', 1)[1]
                    refined = refiner.get_refined_graph()
                    with open(filename, 'w') as f:
                        json.dump(refined, f, indent=2)
                    print(f"✓ Saved to {filename}\n")
                    continue

                # Send to Claude
                await client.query(user_input)

                print("\nClaude:", end="")
                async for message in client.receive_response():
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                print(f" {block.text}")
                            elif isinstance(block, ToolUseBlock):
                                print(f"\n[Using: {block.name}]", end="")
                    elif isinstance(message, ResultMessage):
                        if message.is_error:
                            print(f"\n❌ Error: {message.result}")
                print()

            except KeyboardInterrupt:
                print("\n\nSession ended.\n")
                break
            except Exception as e:
                print(f"\nError: {e}\n")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Refine state-action graphs using AI"
    )
    parser.add_argument(
        "graph",
        help="Path to state-action-graph.json file"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output path for refined graph (auto mode only)",
        default="refined-graph.json"
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Automatic refinement mode (vs interactive)"
    )

    args = parser.parse_args()

    # Check if graph exists
    graph_path = Path(args.graph)
    if not graph_path.exists():
        print(f"Error: Graph file not found: {graph_path}", file=sys.stderr)
        sys.exit(1)

    # Run in appropriate mode
    if args.auto:
        asyncio.run(auto_refine(str(graph_path), args.output))
    else:
        asyncio.run(interactive_refine(str(graph_path)))


if __name__ == "__main__":
    main()
