"""
MCP tools for navigating state-action graphs.
"""
from typing import Any, Dict
from claude_agent_sdk import tool
from .pathfinder import GraphNavigator


def create_navigation_tools(navigator: GraphNavigator):
    """
    Create MCP tools for graph navigation.

    Args:
        navigator: GraphNavigator instance with loaded graph

    Returns:
        List of tool functions
    """

    @tool(
        "find_path",
        "Find step-by-step instructions to achieve a goal in the application. "
        "Given a current state and a goal description, returns the shortest sequence of actions to reach that goal.",
        {"current_state": str, "goal": str}
    )
    async def find_path(args: Dict[str, Any]) -> Dict[str, Any]:
        """Find path from current state to goal."""
        current = args["current_state"]
        goal = args["goal"]

        # Find the path
        path = navigator.find_path(current, goal)

        if not path:
            # Try to find states matching the goal
            matching_states = [
                s for s in navigator.states.values()
                if goal.lower() in s['id'].lower() or
                   any(goal.lower() in l.lower() for l in s.get('labels', []))
            ]

            if matching_states:
                state_names = [s['id'] for s in matching_states[:3]]
                return {
                    "content": [{
                        "type": "text",
                        "text": f"Could not find a path from '{current}' to '{goal}'.\n\n"
                               f"Did you mean one of these states?\n" +
                               "\n".join(f"- {name}" for name in state_names)
                    }]
                }
            else:
                return {
                    "content": [{
                        "type": "text",
                        "text": f"Could not find a path from '{current}' to '{goal}'.\n\n"
                               "The goal state doesn't seem to exist in the application. "
                               "Try searching for available actions instead."
                    }]
                }

        # Build instructions
        instructions = []
        for i, (action_id, next_state) in enumerate(path):
            step = navigator.get_action_description(action_id)
            instructions.append(f"{i + 1}. {step}")

        final_state = path[-1][1] if path else current
        final_desc = navigator.get_state_description(final_state)

        result = f"To reach '{goal}' from '{current}':\n\n"
        result += "\n".join(instructions)
        result += f"\n\nYou'll end up in: {final_desc}"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "search_actions",
        "Search for actions in the application by keyword or description. "
        "Useful for discovering what the user can do.",
        {"query": str}
    )
    async def search_actions(args: Dict[str, Any]) -> Dict[str, Any]:
        """Search for actions by keyword."""
        query = args["query"]

        matches = navigator.search_actions(query, limit=10)

        if not matches:
            return {
                "content": [{
                    "type": "text",
                    "text": f"No actions found matching '{query}'.\n\n"
                           "Try a different search term like 'save', 'generate', 'edit', etc."
                }]
            }

        result = f"Found {len(matches)} actions matching '{query}':\n\n"
        for match in matches[:5]:
            labels = match['labels']
            trigger = match['metadata'].get('trigger', 'unknown')

            result += f"• {labels[0]}\n"
            if len(labels) > 1:
                result += f"  Also known as: {', '.join(labels[1:])}\n"
            result += f"  How: {trigger}\n\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "identify_state",
        "Identify what state the user is currently in based on their description of what they see. "
        "Helps establish context for navigation.",
        {"description": str}
    )
    async def identify_state(args: Dict[str, Any]) -> Dict[str, Any]:
        """Identify current state from description."""
        description = args["description"]

        state = navigator.identify_state(description)

        if not state:
            return {
                "content": [{
                    "type": "text",
                    "text": "Could not identify your current state from that description.\n\n"
                           "Can you describe what you see in more detail? For example:\n"
                           "- Are any modals or dialogs open?\n"
                           "- What buttons are visible?\n"
                           "- What content is displayed on the screen?"
                }]
            }

        state_id = state['id']
        labels = state.get('labels', [])

        # Get available actions from this state
        available = navigator.get_available_actions(state_id)

        result = f"Based on your description, you appear to be in:\n\n"
        result += f"**{state_id}**\n"
        result += f"Description: {', '.join(labels[:3])}\n\n"

        if available:
            result += "From here, you can:\n"
            for action in available[:5]:
                result += f"• {action['labels'][0]}\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "list_states",
        "List all available states in the application. "
        "Useful for understanding the overall structure.",
        {}
    )
    async def list_states(args: Dict[str, Any]) -> Dict[str, Any]:
        """List all states in the graph."""
        states = list(navigator.states.values())

        # Group states by category
        modal_states = [s for s in states if 'modal' in s['id'].lower()]
        data_states = [s for s in states if any(k in s['id'].lower() for k in ['empty', 'present', 'loaded'])]
        ready_states = [s for s in states if 'ready' in s['id'].lower()]
        other_states = [s for s in states if s not in modal_states + data_states + ready_states]

        result = f"Application has {len(states)} states:\n\n"

        if modal_states:
            result += "**Modal States:**\n"
            for s in modal_states[:5]:
                result += f"- {s['id']}\n"
            if len(modal_states) > 5:
                result += f"  ... and {len(modal_states) - 5} more\n"
            result += "\n"

        if ready_states:
            result += "**Ready States (actions available):**\n"
            for s in ready_states[:5]:
                result += f"- {s['id']}\n"
            if len(ready_states) > 5:
                result += f"  ... and {len(ready_states) - 5} more\n"
            result += "\n"

        if data_states:
            result += "**Data States:**\n"
            for s in data_states[:5]:
                result += f"- {s['id']}\n"
            if len(data_states) > 5:
                result += f"  ... and {len(data_states) - 5} more\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    return [find_path, search_actions, identify_state, list_states]
