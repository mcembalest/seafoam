#!/usr/bin/env python3
"""
Simple example of using the navigation system programmatically.
"""
import asyncio
from pathlib import Path
from claude_agent_sdk import query, ClaudeAgentOptions
from navigation import create_navigation_server


async def simple_query_example():
    """Example using the simple query() function."""

    # Load the navigation server
    graph_path = Path(__file__).parent.parent / "seafoam-graph.json"
    nav_server = create_navigation_server(graph_path)

    # Configure options
    options = ClaudeAgentOptions(
        mcp_servers={"nav": nav_server},
        allowed_tools=[
            "mcp__nav__find_path",
            "mcp__nav__search_actions"
        ]
    )

    # Ask a question
    print("Question: How do I save an image?\n")
    print("Answer:")

    async for message in query(
        prompt="How do I save an image in this application?",
        options=options
    ):
        # Simple printing - you could process messages more carefully
        print(message)


async def multi_turn_example():
    """Example using ClaudeSDKClient for multi-turn conversation."""
    from claude_agent_sdk import ClaudeSDKClient, AssistantMessage, TextBlock

    graph_path = Path(__file__).parent.parent / "seafoam-graph.json"
    nav_server = create_navigation_server(graph_path)

    options = ClaudeAgentOptions(
        system_prompt="You are a helpful application guide. Be concise.",
        mcp_servers={"nav": nav_server},
        allowed_tools=[
            "mcp__nav__find_path",
            "mcp__nav__search_actions",
            "mcp__nav__identify_state"
        ]
    )

    async with ClaudeSDKClient(options=options) as client:
        # First question
        print("Q1: What actions are available for saving?\n")
        await client.query("What actions are available for saving?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"A1: {block.text}\n")

        # Follow-up question - Claude remembers context
        print("Q2: How do I use the first one?\n")
        await client.query("How do I use the first one?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"A2: {block.text}\n")


if __name__ == "__main__":
    print("=== Simple Query Example ===\n")
    asyncio.run(simple_query_example())

    print("\n\n=== Multi-Turn Conversation Example ===\n")
    asyncio.run(multi_turn_example())
