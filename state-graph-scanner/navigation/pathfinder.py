"""
Core pathfinding algorithms for navigating state-action graphs.
"""
from collections import deque
from typing import List, Dict, Any, Optional, Tuple


class GraphNavigator:
    """Navigate a state-action graph to find paths between states."""

    def __init__(self, graph_data: Dict[str, Any]):
        """
        Initialize navigator with graph data.

        Args:
            graph_data: Parsed state-action graph JSON
        """
        self.graph_data = graph_data
        self.states = {s['id']: s for s in graph_data['graph']['states']}
        self.actions = {a['id']: a for a in graph_data['graph']['actions']}
        self.transitions = graph_data['graph']['transitions']

        # Build adjacency list for efficient searching
        self.adjacency: Dict[str, List[Tuple[str, str]]] = {}
        for transition in self.transitions:
            from_state = transition['from']
            to_state = transition['to']
            action_id = transition['via']

            if from_state not in self.adjacency:
                self.adjacency[from_state] = []
            self.adjacency[from_state].append((action_id, to_state))

    def find_path(
        self,
        start_state: str,
        goal_query: str,
        max_steps: int = 10
    ) -> Optional[List[Tuple[str, str]]]:
        """
        Find shortest path from start state to a goal using BFS.

        Args:
            start_state: Starting state ID
            goal_query: Goal description (matched against state labels)
            max_steps: Maximum path length

        Returns:
            List of (action_id, next_state) tuples, or None if no path found
        """
        goal_query_lower = goal_query.lower()

        # BFS to find shortest path
        queue = deque([(start_state, [])])
        visited = {start_state}

        while queue:
            current_state, path = queue.popleft()

            # Check if we've reached the goal
            if self._state_matches_goal(current_state, goal_query_lower):
                return path

            # Don't explore paths longer than max_steps
            if len(path) >= max_steps:
                continue

            # Explore neighbors
            for action_id, next_state in self.adjacency.get(current_state, []):
                if next_state not in visited:
                    visited.add(next_state)
                    queue.append((next_state, path + [(action_id, next_state)]))

        return None

    def _state_matches_goal(self, state_id: str, goal_query: str) -> bool:
        """Check if a state matches the goal query."""
        state = self.states.get(state_id)
        if not state:
            return False

        # Check state ID
        if goal_query in state_id.lower():
            return True

        # Check state labels
        labels = state.get('labels', [])
        return any(goal_query in label.lower() for label in labels)

    def search_actions(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for actions matching a query.

        Args:
            query: Search query
            limit: Maximum number of results

        Returns:
            List of matching action dictionaries
        """
        query_lower = query.lower()
        matches = []

        for action in self.actions.values():
            labels = action.get('labels', [])

            # Check if query matches any label
            if any(query_lower in label.lower() for label in labels):
                matches.append({
                    'id': action['id'],
                    'labels': labels[:3],  # Top 3 labels
                    'metadata': action.get('metadata', {})
                })

        # Sort by label relevance (exact matches first)
        matches.sort(
            key=lambda x: min(
                label.lower().find(query_lower)
                for label in x['labels']
                if query_lower in label.lower()
            )
        )

        return matches[:limit]

    def identify_state(self, description: str) -> Optional[Dict[str, Any]]:
        """
        Identify a state from a natural language description.

        Args:
            description: User's description of current state

        Returns:
            Best matching state dictionary, or None
        """
        description_lower = description.lower()
        words = description_lower.split()

        matches = []
        for state in self.states.values():
            labels = state.get('labels', [])

            # Score based on word overlap
            score = sum(
                1 for label in labels
                for word in words
                if word in label.lower()
            )

            if score > 0:
                matches.append((score, state))

        if not matches:
            return None

        # Return best match
        matches.sort(reverse=True, key=lambda x: x[0])
        return matches[0][1]

    def get_action_description(self, action_id: str) -> str:
        """Get human-readable description of an action."""
        action = self.actions.get(action_id)
        if not action:
            return action_id

        labels = action.get('labels', [])
        if not labels:
            return action_id

        # Prefer imperative forms
        imperative_labels = [l for l in labels if l.lower().startswith(('click', 'type', 'select', 'drag'))]
        if imperative_labels:
            return imperative_labels[0].capitalize()

        return labels[0].capitalize()

    def get_state_description(self, state_id: str) -> str:
        """Get human-readable description of a state."""
        state = self.states.get(state_id)
        if not state:
            return state_id

        labels = state.get('labels', [])
        if not labels:
            return state_id

        # Return first label
        return labels[0]

    def get_available_actions(self, state_id: str) -> List[Dict[str, Any]]:
        """
        Get all available actions from a given state.

        Args:
            state_id: State to get actions for

        Returns:
            List of action dictionaries with labels and metadata
        """
        available = []

        for action_id, next_state in self.adjacency.get(state_id, []):
            action = self.actions.get(action_id)
            if action:
                available.append({
                    'id': action_id,
                    'labels': action.get('labels', [])[:3],
                    'next_state': next_state,
                    'metadata': action.get('metadata', {})
                })

        return available
