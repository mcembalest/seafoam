"""
Core graph refinement logic for deduplicating and improving state-action graphs.
"""
import json
from typing import Dict, List, Set, Any, Optional
from collections import defaultdict


class GraphRefiner:
    """Refines state-action graphs by deduplicating and consolidating."""

    def __init__(self, graph_data: Dict[str, Any]):
        """
        Initialize refiner with graph data.

        Args:
            graph_data: Parsed state-action graph JSON
        """
        self.graph_data = graph_data
        self.states = {s['id']: s for s in graph_data['graph']['states']}
        self.actions = {a['id']: a for a in graph_data['graph']['actions']}
        self.transitions = graph_data['graph']['transitions']

    def analyze_for_duplicates(self) -> Dict[str, Any]:
        """
        Analyze the graph to identify potential duplicates.

        Returns:
            Dictionary with duplicate analysis
        """
        analysis = {
            'duplicate_groups': [],
            'low_value_states': [],
            'stats': {
                'total_states': len(self.states),
                'total_actions': len(self.actions),
                'total_transitions': len(self.transitions)
            }
        }

        # Group states by semantic similarity
        # Group 1: Modal states (different selectors, same modal)
        modal_groups = self._group_modal_states()
        analysis['duplicate_groups'].extend(modal_groups)

        # Group 2: Data presence states (multiple variables for same concept)
        data_groups = self._group_data_states()
        analysis['duplicate_groups'].extend(data_groups)

        # Group 3: Ready/action states
        ready_groups = self._group_ready_states()
        analysis['duplicate_groups'].extend(ready_groups)

        # Identify low-value states (internal implementation details)
        analysis['low_value_states'] = self._identify_low_value_states()

        return analysis

    def _group_modal_states(self) -> List[Dict[str, Any]]:
        """Group modal states by the modal they represent."""
        modal_states = defaultdict(list)

        for state_id, state in self.states.items():
            # Check if this is a modal state
            if 'modal' in state_id.lower():
                # Extract the modal name
                # e.g., "_preview-modal_open" and "_modal-content_open" both for preview modal
                parts = state_id.split('_')
                modal_name = None

                for part in parts:
                    if 'modal' in part.lower():
                        modal_name = part
                        break

                if modal_name:
                    # Determine open/closed
                    status = 'open' if 'open' in state_id else 'closed'
                    key = f"{modal_name}_{status}"
                    modal_states[key].append(state_id)

        # Return groups with multiple states
        groups = []
        for key, state_ids in modal_states.items():
            if len(state_ids) > 1:
                groups.append({
                    'type': 'modal_duplicates',
                    'key': key,
                    'states': state_ids,
                    'suggested_merge': state_ids[0],  # Keep first one
                    'reason': f'Multiple selectors for same modal: {key}'
                })

        return groups

    def _group_data_states(self) -> List[Dict[str, Any]]:
        """Group states representing data presence/absence."""
        data_states = defaultdict(lambda: {'empty': [], 'present': []})

        for state_id, state in self.states.items():
            if 'empty' in state_id or 'present' in state_id:
                # Extract variable name
                base = state_id.replace('_empty', '').replace('_present', '')
                status = 'empty' if 'empty' in state_id else 'present'
                data_states[base][status].append(state_id)

        # Look for duplicates
        groups = []
        for base, status_dict in data_states.items():
            if len(status_dict['empty']) > 1 or len(status_dict['present']) > 1:
                groups.append({
                    'type': 'data_duplicates',
                    'key': base,
                    'states': status_dict['empty'] + status_dict['present'],
                    'suggested_merge': {
                        'empty': status_dict['empty'][0] if status_dict['empty'] else None,
                        'present': status_dict['present'][0] if status_dict['present'] else None
                    },
                    'reason': f'Multiple states for same data variable: {base}'
                })

        return groups

    def _group_ready_states(self) -> List[Dict[str, Any]]:
        """Group 'ready to X' states."""
        ready_states = defaultdict(list)

        for state_id, state in self.states.items():
            if 'ready' in state_id.lower():
                # Extract the action
                labels = state.get('labels', [])
                for label in labels:
                    if 'ready to' in label.lower():
                        action = label.lower().replace('ready to ', '').split()[0]
                        ready_states[action].append(state_id)
                        break

        groups = []
        for action, state_ids in ready_states.items():
            if len(state_ids) > 1:
                groups.append({
                    'type': 'ready_duplicates',
                    'key': action,
                    'states': state_ids,
                    'suggested_merge': state_ids[0],
                    'reason': f'Multiple "ready to {action}" states'
                })

        return groups

    def _identify_low_value_states(self) -> List[Dict[str, Any]]:
        """Identify states that are likely internal details."""
        low_value = []

        for state_id, state in self.states.items():
            labels = state.get('labels', [])

            # States with very generic or technical labels
            if any(label.startswith('_') for label in labels):
                low_value.append({
                    'state_id': state_id,
                    'reason': 'Technical/internal identifier'
                })

            # States with no clear user-facing meaning
            if all(any(tech in label.lower() for tech in ['var', 'data', 'config'])
                   for label in labels):
                low_value.append({
                    'state_id': state_id,
                    'reason': 'Internal state variable, not user-facing'
                })

        return low_value

    def merge_states(self, state_ids: List[str], new_state_id: str,
                     new_labels: Optional[List[str]] = None) -> None:
        """
        Merge multiple states into one.

        Args:
            state_ids: States to merge
            new_state_id: ID for the merged state
            new_labels: Optional labels for merged state
        """
        if not state_ids:
            return

        # Keep first state as base
        base_state = self.states[state_ids[0]].copy()
        base_state['id'] = new_state_id

        # Merge labels from all states
        all_labels = set()
        for sid in state_ids:
            if sid in self.states:
                all_labels.update(self.states[sid].get('labels', []))

        if new_labels:
            base_state['labels'] = new_labels
        else:
            base_state['labels'] = list(all_labels)[:10]  # Keep top 10

        # Remove old states
        for sid in state_ids:
            if sid in self.states:
                del self.states[sid]

        # Add merged state
        self.states[new_state_id] = base_state

        # Update all transitions
        self._update_transitions_for_merge(state_ids, new_state_id)

    def remove_state(self, state_id: str) -> None:
        """Remove a state and all its transitions."""
        if state_id in self.states:
            del self.states[state_id]

        # Remove transitions
        self.transitions = [
            t for t in self.transitions
            if t['from'] != state_id and t['to'] != state_id
        ]

    def relabel_state(self, state_id: str, new_labels: List[str]) -> None:
        """Update labels for a state."""
        if state_id in self.states:
            self.states[state_id]['labels'] = new_labels

    def _update_transitions_for_merge(self, old_ids: List[str], new_id: str) -> None:
        """Update transitions to point to merged state."""
        for transition in self.transitions:
            if transition['from'] in old_ids:
                transition['from'] = new_id
            if transition['to'] in old_ids:
                transition['to'] = new_id

        # Deduplicate transitions
        seen = set()
        unique_transitions = []
        for t in self.transitions:
            key = (t['from'], t['via'], t['to'])
            if key not in seen:
                seen.add(key)
                unique_transitions.append(t)

        self.transitions = unique_transitions

    def get_refined_graph(self) -> Dict[str, Any]:
        """
        Get the refined graph data.

        Returns:
            Updated graph data structure
        """
        return {
            'graph': {
                'states': list(self.states.values()),
                'actions': list(self.actions.values()),
                'transitions': self.transitions
            },
            'metadata': {
                'refined': True,
                'original_state_count': self.graph_data['graph'].get('original_state_count',
                                                                      len(self.graph_data['graph']['states'])),
                'refined_state_count': len(self.states),
                'original_transition_count': self.graph_data['graph'].get('original_transition_count',
                                                                            len(self.graph_data['graph']['transitions'])),
                'refined_transition_count': len(self.transitions)
            }
        }

    def generate_summary_for_llm(self) -> str:
        """
        Generate a concise summary for LLM analysis.

        Returns:
            String summary of the graph
        """
        # Group states by category
        modal_states = [s for s in self.states.values() if 'modal' in s['id'].lower()]
        data_states = [s for s in self.states.values()
                       if 'empty' in s['id'].lower() or 'present' in s['id'].lower()]
        ready_states = [s for s in self.states.values() if 'ready' in s['id'].lower()]
        other_states = [s for s in self.states.values()
                        if s not in modal_states + data_states + ready_states]

        summary = f"Graph Summary:\n"
        summary += f"Total States: {len(self.states)}\n"
        summary += f"Total Actions: {len(self.actions)}\n"
        summary += f"Total Transitions: {len(self.transitions)}\n\n"

        if modal_states:
            summary += f"Modal States ({len(modal_states)}):\n"
            for s in modal_states[:10]:
                labels = ', '.join(list(s['labels'])[:2])
                summary += f"  - {s['id']}: {labels}\n"
            if len(modal_states) > 10:
                summary += f"  ... and {len(modal_states) - 10} more\n"
            summary += "\n"

        if ready_states:
            summary += f"Ready States ({len(ready_states)}):\n"
            for s in ready_states[:10]:
                labels = ', '.join(list(s['labels'])[:2])
                summary += f"  - {s['id']}: {labels}\n"
            if len(ready_states) > 10:
                summary += f"  ... and {len(ready_states) - 10} more\n"
            summary += "\n"

        if data_states:
            summary += f"Data States ({len(data_states)}):\n"
            for s in data_states[:10]:
                labels = ', '.join(list(s['labels'])[:2])
                summary += f"  - {s['id']}: {labels}\n"
            if len(data_states) > 10:
                summary += f"  ... and {len(data_states) - 10} more\n"
            summary += "\n"

        if other_states:
            summary += f"Other States ({len(other_states)}):\n"
            for s in other_states[:5]:
                labels = ', '.join(list(s['labels'])[:2])
                summary += f"  - {s['id']}: {labels}\n"
            if len(other_states) > 5:
                summary += f"  ... and {len(other_states) - 5} more\n"

        return summary
