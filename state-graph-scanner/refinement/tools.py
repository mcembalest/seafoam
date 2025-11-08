"""
MCP tools for graph refinement operations.
"""
from typing import Any, Dict, List
from claude_agent_sdk import tool
from .graph_refiner import GraphRefiner


def create_refinement_tools(refiner: GraphRefiner):
    """
    Create MCP tools for graph refinement.

    Args:
        refiner: GraphRefiner instance

    Returns:
        List of tool functions
    """

    @tool(
        "analyze_duplicates",
        "Analyze the graph to identify duplicate states and low-value states that should be merged or removed.",
        {}
    )
    async def analyze_duplicates(args: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze graph for duplicates and issues."""
        analysis = refiner.analyze_for_duplicates()

        result = "# Graph Analysis\n\n"
        result += f"**Total States:** {analysis['stats']['total_states']}\n"
        result += f"**Total Actions:** {analysis['stats']['total_actions']}\n"
        result += f"**Total Transitions:** {analysis['stats']['total_transitions']}\n\n"

        if analysis['duplicate_groups']:
            result += f"## Duplicate Groups ({len(analysis['duplicate_groups'])})\n\n"
            for i, group in enumerate(analysis['duplicate_groups'][:10], 1):
                result += f"### Group {i}: {group['type']}\n"
                result += f"**Reason:** {group['reason']}\n"
                result += f"**States:** {', '.join(group['states'])}\n"
                if 'suggested_merge' in group:
                    result += f"**Suggested merge to:** {group['suggested_merge']}\n"
                result += "\n"

            if len(analysis['duplicate_groups']) > 10:
                result += f"... and {len(analysis['duplicate_groups']) - 10} more groups\n\n"

        if analysis['low_value_states']:
            result += f"## Low-Value States ({len(analysis['low_value_states'])})\n\n"
            for i, state_info in enumerate(analysis['low_value_states'][:10], 1):
                result += f"{i}. **{state_info['state_id']}** - {state_info['reason']}\n"

            if len(analysis['low_value_states']) > 10:
                result += f"... and {len(analysis['low_value_states']) - 10} more\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "merge_states",
        "Merge multiple states into a single consolidated state. This updates all transitions automatically.",
        {
            "state_ids": list,
            "new_state_id": str,
            "new_labels": list
        }
    )
    async def merge_states(args: Dict[str, Any]) -> Dict[str, Any]:
        """Merge multiple states."""
        state_ids = args["state_ids"]
        new_state_id = args["new_state_id"]
        new_labels = args.get("new_labels", None)

        # Perform merge
        refiner.merge_states(state_ids, new_state_id, new_labels)

        result = f"✓ Merged {len(state_ids)} states into '{new_state_id}'\n\n"
        result += f"**Merged states:**\n"
        for sid in state_ids:
            result += f"  - {sid}\n"
        result += f"\n**New state:** {new_state_id}\n"
        if new_labels:
            result += f"**Labels:** {', '.join(new_labels[:5])}\n"

        # Get updated stats
        current_stats = {
            'states': len(refiner.states),
            'transitions': len(refiner.transitions)
        }

        result += f"\n**Updated graph:**\n"
        result += f"  - States: {current_stats['states']}\n"
        result += f"  - Transitions: {current_stats['transitions']}\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "remove_state",
        "Remove a state and all its associated transitions. Use this for low-value internal states.",
        {"state_id": str}
    )
    async def remove_state(args: Dict[str, Any]) -> Dict[str, Any]:
        """Remove a state from the graph."""
        state_id = args["state_id"]

        # Check if state exists
        if state_id not in refiner.states:
            return {
                "content": [{
                    "type": "text",
                    "text": f"❌ State '{state_id}' not found in graph."
                }]
            }

        # Remove it
        refiner.remove_state(state_id)

        result = f"✓ Removed state '{state_id}'\n\n"
        result += f"**Updated graph:**\n"
        result += f"  - States: {len(refiner.states)}\n"
        result += f"  - Transitions: {len(refiner.transitions)}\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "relabel_state",
        "Update the labels for a state to make them more clear and user-friendly.",
        {"state_id": str, "new_labels": list}
    )
    async def relabel_state(args: Dict[str, Any]) -> Dict[str, Any]:
        """Update state labels."""
        state_id = args["state_id"]
        new_labels = args["new_labels"]

        if state_id not in refiner.states:
            return {
                "content": [{
                    "type": "text",
                    "text": f"❌ State '{state_id}' not found in graph."
                }]
            }

        old_labels = refiner.states[state_id].get('labels', [])
        refiner.relabel_state(state_id, new_labels)

        result = f"✓ Updated labels for '{state_id}'\n\n"
        result += f"**Old labels:** {', '.join(old_labels[:5])}\n"
        result += f"**New labels:** {', '.join(new_labels[:5])}\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    @tool(
        "get_graph_summary",
        "Get a summary of the current graph state with statistics and categorized states.",
        {}
    )
    async def get_graph_summary(args: Dict[str, Any]) -> Dict[str, Any]:
        """Get current graph summary."""
        summary = refiner.generate_summary_for_llm()

        return {
            "content": [{
                "type": "text",
                "text": summary
            }]
        }

    @tool(
        "get_refined_graph",
        "Get the final refined graph data to save. This returns the complete graph in JSON format.",
        {}
    )
    async def get_refined_graph(args: Dict[str, Any]) -> Dict[str, Any]:
        """Get the refined graph."""
        import json
        refined = refiner.get_refined_graph()

        result = "# Refined Graph\n\n"
        result += f"**Original states:** {refined['metadata']['original_state_count']}\n"
        result += f"**Refined states:** {refined['metadata']['refined_state_count']}\n"
        result += f"**Reduction:** {refined['metadata']['original_state_count'] - refined['metadata']['refined_state_count']} states removed\n\n"
        result += f"**Original transitions:** {refined['metadata']['original_transition_count']}\n"
        result += f"**Refined transitions:** {refined['metadata']['refined_transition_count']}\n"
        result += f"**Reduction:** {refined['metadata']['original_transition_count'] - refined['metadata']['refined_transition_count']} transitions removed\n\n"

        result += "The refined graph is ready to be saved.\n"

        return {
            "content": [{
                "type": "text",
                "text": result
            }]
        }

    return [
        analyze_duplicates,
        merge_states,
        remove_state,
        relabel_state,
        get_graph_summary,
        get_refined_graph
    ]
