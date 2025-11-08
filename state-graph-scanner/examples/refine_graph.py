#!/usr/bin/env python3
"""
Example of programmatic graph refinement.
"""
import asyncio
import json
from pathlib import Path
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, TextBlock
from refinement import create_refinement_server


async def basic_refinement():
    """Example of basic automated refinement."""

    graph_path = Path(__file__).parent.parent / "seafoam-graph.json"

    if not graph_path.exists():
        print(f"Graph not found: {graph_path}")
        print("Run the scanner first: npm run scan -- /path/to/app")
        return

    # Load refinement server
    print("Loading refinement system...")
    refine_server, refiner = create_refinement_server(graph_path)

    print(f"Original: {len(refiner.states)} states, {len(refiner.transitions)} transitions\n")

    # Configure options
    options = ClaudeAgentOptions(
        system_prompt="You are a graph refinement expert. Be concise and focused on results.",
        mcp_servers={"refiner": refine_server},
        allowed_tools=[
            "mcp__refiner__analyze_duplicates",
            "mcp__refiner__merge_states",
            "mcp__refiner__remove_state"
        ],
        model="sonnet"
    )

    async with ClaudeSDKClient(options=options) as client:
        # Step 1: Analyze
        print("Step 1: Analyzing for duplicates...")
        await client.query("Analyze the graph for duplicate states. Show me the top 5 groups.")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(block.text)

        # Step 2: Merge modal duplicates
        print("\nStep 2: Merging modal duplicates...")
        await client.query(
            "Merge all the modal duplicate groups. "
            "For each group, keep the shortest state ID."
        )

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(block.text)

        # Step 3: Remove low-value states
        print("\nStep 3: Removing low-value states...")
        await client.query(
            "Remove states that are internal implementation details "
            "or don't represent user-perceivable changes."
        )

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(block.text)

    # Get final stats
    refined = refiner.get_refined_graph()
    print(f"\n✓ Refinement complete!")
    print(f"  Original: {refined['metadata']['original_state_count']} states")
    print(f"  Refined: {refined['metadata']['refined_state_count']} states")
    print(f"  Reduction: {refined['metadata']['original_state_count'] - refined['metadata']['refined_state_count']} states "
          f"({(1 - refined['metadata']['refined_state_count']/refined['metadata']['original_state_count'])*100:.0f}%)")

    # Save it
    output_path = Path(__file__).parent.parent / "seafoam-graph-refined.json"
    with open(output_path, 'w') as f:
        json.dump(refined, f, indent=2)
    print(f"\n  Saved to: {output_path}")


async def custom_refinement():
    """Example of custom refinement with specific rules."""

    graph_path = Path(__file__).parent.parent / "seafoam-graph.json"

    if not graph_path.exists():
        print("Graph not found. Run scanner first.")
        return

    refine_server, refiner = create_refinement_server(graph_path)

    # Custom refinement rules
    rules = """
Refinement rules:
1. Merge all modal states with the same base modal name
2. Keep only "open" and "closed" states for modals
3. Remove all internal state variables (those starting with _)
4. Consolidate "ready_to_X" states - we only need one per action type
5. Remove any state with less than 2 transitions (dead ends)
"""

    options = ClaudeAgentOptions(
        system_prompt=f"You are refining a graph. Follow these rules:\n\n{rules}",
        mcp_servers={"refiner": refine_server},
        allowed_tools=[
            "mcp__refiner__analyze_duplicates",
            "mcp__refiner__merge_states",
            "mcp__refiner__remove_state",
            "mcp__refiner__get_graph_summary"
        ]
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Apply the refinement rules to this graph.")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(block.text)

    print(f"\nFinal: {len(refiner.states)} states")


if __name__ == "__main__":
    print("=== Basic Refinement Example ===\n")
    asyncio.run(basic_refinement())

    # Uncomment to try custom refinement
    # print("\n\n=== Custom Refinement Example ===\n")
    # asyncio.run(custom_refinement())
