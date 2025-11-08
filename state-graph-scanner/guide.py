#!/usr/bin/env python3
"""
Interactive guide for navigating applications using state-action graphs.

This script provides an AI-powered assistant that uses the scanned state-action
graph to help users navigate through an application step-by-step.
"""
import asyncio
import sys
from pathlib import Path
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    ResultMessage
)
from navigation import create_navigation_server


def print_assistant_message(message: AssistantMessage):
    """Pretty print an assistant message."""
    for block in message.content:
        if isinstance(block, TextBlock):
            print(f"\n{block.text}\n")
        elif isinstance(block, ThinkingBlock):
            # Optionally show thinking
            pass
        elif isinstance(block, ToolUseBlock):
            # Show tool usage
            print(f"[Using tool: {block.name}]")


async def interactive_guide(graph_path: str):
    """
    Run an interactive guide session.

    Args:
        graph_path: Path to the state-action-graph.json file
    """
    # Create navigation server
    print("Loading navigation graph...")
    nav_server = create_navigation_server(graph_path)

    # Configure options
    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": """
You are a helpful user guide for an application. You have access to navigation
tools that know the complete state-action graph of the application.

When users ask how to do something:
1. Use identify_state if you need to know where they currently are
2. Use search_actions to find relevant actions
3. Use find_path to get step-by-step instructions from their current state to their goal
4. Present the steps clearly with numbered instructions

Be concise and actionable. Focus on helping users accomplish their goals efficiently.

If the user seems lost, use list_states to help them understand the application structure.
"""
        },
        mcp_servers={"navigator": nav_server},
        allowed_tools=[
            "mcp__navigator__find_path",
            "mcp__navigator__search_actions",
            "mcp__navigator__identify_state",
            "mcp__navigator__list_states"
        ],
        model="sonnet"  # Use Sonnet for better reasoning
    )

    print("\n" + "="*70)
    print("Application Guide - AI-Powered Navigation Assistant")
    print("="*70)
    print("\nI can help you navigate the application step-by-step!")
    print("Ask me things like:")
    print("  - 'How do I save an image?'")
    print("  - 'What can I do from here?'")
    print("  - 'Show me all available actions'")
    print("\nType 'exit' or 'quit' to end the session.\n")

    async with ClaudeSDKClient(options=options) as client:
        while True:
            try:
                # Get user input
                user_input = input("You: ").strip()

                if not user_input:
                    continue

                if user_input.lower() in ['exit', 'quit', 'bye']:
                    print("\nGoodbye! Happy navigating!\n")
                    break

                # Send query to Claude
                await client.query(user_input)

                # Receive and display response
                print("\nGuide:", end="")
                async for message in client.receive_response():
                    if isinstance(message, AssistantMessage):
                        print_assistant_message(message)
                    elif isinstance(message, ResultMessage):
                        if message.is_error:
                            print(f"\n[Error: {message.result}]\n")

            except KeyboardInterrupt:
                print("\n\nSession interrupted. Goodbye!\n")
                break
            except Exception as e:
                print(f"\nError: {e}\n")
                continue


async def batch_query(graph_path: str, queries: list[str]):
    """
    Process multiple queries in batch mode.

    Args:
        graph_path: Path to the state-action-graph.json file
        queries: List of queries to process
    """
    nav_server = create_navigation_server(graph_path)

    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": "You are a concise application guide. Provide direct, actionable answers."
        },
        mcp_servers={"navigator": nav_server},
        allowed_tools=[
            "mcp__navigator__find_path",
            "mcp__navigator__search_actions",
            "mcp__navigator__identify_state"
        ],
        model="haiku"  # Use Haiku for faster batch processing
    )

    async with ClaudeSDKClient(options=options) as client:
        for i, query in enumerate(queries, 1):
            print(f"\n{'='*70}")
            print(f"Query {i}/{len(queries)}: {query}")
            print('='*70)

            await client.query(query)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    print_assistant_message(message)


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="AI-powered navigation guide for scanned applications"
    )
    parser.add_argument(
        "graph",
        nargs="?",
        default="seafoam-graph.json",
        help="Path to state-action-graph.json file (default: seafoam-graph.json)"
    )
    parser.add_argument(
        "--batch",
        nargs="+",
        help="Process queries in batch mode instead of interactive"
    )

    args = parser.parse_args()

    # Check if graph exists
    graph_path = Path(args.graph)
    if not graph_path.exists():
        print(f"Error: Graph file not found: {graph_path}", file=sys.stderr)
        print("\nRun the scanner first:", file=sys.stderr)
        print("  npm run scan -- /path/to/app --output graph.json", file=sys.stderr)
        sys.exit(1)

    # Run interactive or batch mode
    if args.batch:
        asyncio.run(batch_query(str(graph_path), args.batch))
    else:
        asyncio.run(interactive_guide(str(graph_path)))


if __name__ == "__main__":
    main()
