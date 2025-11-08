# Graph Refinement Guide

The refinement system uses Claude Agent SDK to improve scanned graphs by removing duplicates and consolidating states.

## The Problem

The static scanner extracts **everything** from code:
- Multiple DOM selectors for the same modal → multiple "modal open" states
- Internal state variables → low-value states
- Button-enabled states → redundant with action availability

This results in 100+ states when only 15-25 are meaningful to users.

## The Solution

Use Claude to analyze and refine the graph:
1. **Identify duplicates** - Same logical state, different selectors
2. **Merge states** - Consolidate duplicates
3. **Remove noise** - Delete internal implementation details
4. **Improve labels** - Make state names clear and natural

## Usage

### Automatic Refinement

```bash
# Refine a scanned graph
python refine.py raw-graph.json --output refined-graph.json --auto
```

Claude will:
- Analyze for duplicates
- Merge similar states
- Remove low-value states
- Produce a clean graph

### Interactive Refinement

```bash
# Interactive session
python refine.py raw-graph.json
```

Then ask Claude:
```
You: Analyze this graph for duplicates
You: Merge all the modal duplicate groups
You: Remove internal state variables
You: save refined-graph.json
```

### Complete Workflow

```bash
# Scan + refine in one command
./scan-and-refine.sh /path/to/app my-app
```

## How It Works

### MCP Tools

Claude has access to 6 refinement tools:

#### 1. `analyze_duplicates`
Identifies duplicate states and low-value states.

```python
# Example output:
Duplicate Groups:
  - Modal duplicates: _preview-modal_open, _modal-content_open
  - Ready duplicates: ready_to_save, ready_to_save_(enter)

Low-Value States:
  - _internal_var_empty (internal state variable)
  - config_data_present (implementation detail)
```

#### 2. `merge_states`
Consolidates multiple states into one.

```python
merge_states(
    state_ids=["_preview-modal_open", "_modal-content_open"],
    new_state_id="preview_modal_open",
    new_labels=["preview modal open", "viewing preview"]
)
```

#### 3. `remove_state`
Deletes a state and its transitions.

```python
remove_state(state_id="_internal_var_empty")
```

#### 4. `relabel_state`
Improves state labels for clarity.

```python
relabel_state(
    state_id="ready_to_generate_image",
    new_labels=["ready to generate", "can create image", "composition ready"]
)
```

#### 5. `get_graph_summary`
Shows current graph statistics.

```python
# Output:
Graph Summary:
Total States: 85
Modal States (20): ...
Ready States (15): ...
Data States (30): ...
```

#### 6. `get_refined_graph`
Returns final refined graph data.

## Refinement Strategies

### Strategy 1: Aggressive Deduplication

Focus on maximum reduction:

```python
# In auto mode, Claude follows this approach:
1. Identify all duplicate groups
2. Merge every group to single state
3. Remove all low-value states
4. Target: 15-20 final states
```

### Strategy 2: Conservative Refinement

Keep more granularity:

```python
# In interactive mode:
1. Review each duplicate group
2. Selectively merge only obvious duplicates
3. Keep some internal states if useful
4. Target: 30-40 final states
```

### Strategy 3: Custom Rules

Define your own refinement rules:

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from refinement import create_refinement_server

rules = """
Custom rules:
- Merge modal states but keep separate edit vs view modes
- Remove all data_present/empty states
- Consolidate ready_to_X states by action category
- Keep all error states (important for user guidance)
"""

options = ClaudeAgentOptions(
    system_prompt=f"Refine the graph following these rules:\n{rules}",
    mcp_servers={"refiner": refine_server},
    # ...
)
```

## Examples

### Example 1: Before/After

**Before refinement** (103 states):
```
_preview-modal_open
_modal-content_open
_modal-actions_open
_preview-modal_closed
_modal-content_closed
savedData_empty
savedData_present
compositionImages_empty
compositionImages_present
...
```

**After refinement** (18 states):
```
preview_modal_open
preview_modal_closed
has_saved_data
no_saved_data
composition_ready
image_generated
...
```

### Example 2: Programmatic Refinement

```python
from refinement import create_refinement_server, GraphRefiner

# Load graph
refine_server, refiner = create_refinement_server('raw-graph.json')

# Manual analysis
analysis = refiner.analyze_for_duplicates()
print(f"Found {len(analysis['duplicate_groups'])} groups")

# Manual merges
refiner.merge_states(
    ['state1', 'state2'],
    'merged_state',
    ['label1', 'label2']
)

# Save
import json
refined = refiner.get_refined_graph()
with open('refined.json', 'w') as f:
    json.dump(refined, f, indent=2)
```

### Example 3: Batch Processing

Refine multiple apps:

```bash
for app in apps/*; do
    echo "Refining $app..."
    python refine.py "graphs/${app}-raw.json" \
        --output "graphs/${app}-refined.json" \
        --auto
done
```

## Results

Typical improvements:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| States | 103 | 18 | 82% reduction |
| Transitions | 28,058 | 156 | 99% reduction |
| Duplicate groups | 15 | 0 | 100% removal |
| Navigation quality | Poor | Excellent | Usable paths |

## Architecture

```
┌─────────────────────┐
│   Raw Graph JSON    │
│   (100+ states)     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   GraphRefiner      │
│   - analyze()       │
│   - merge()         │
│   - remove()        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   MCP Tools         │
│   (Claude SDK)      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Claude Agent      │
│   (reasoning)       │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Refined Graph JSON │
│  (15-25 states)     │
└─────────────────────┘
```

## Troubleshooting

### "Module 'claude_agent_sdk' not found"

Install dependencies:
```bash
pip install -r requirements.txt
```

### Refinement too aggressive

Use interactive mode to control merges:
```bash
python refine.py graph.json
# Then manually review and approve each change
```

### Refinement not aggressive enough

Edit the system prompt in `refine.py` to be more aggressive:
```python
append="""
Be VERY aggressive in consolidation.
Remove anything that's not directly user-facing.
Target: 10-15 final states only.
"""
```

### Graph becomes invalid

The refiner automatically:
- Updates all transitions when merging
- Removes orphaned transitions when deleting states
- Deduplicates transition edges

If issues occur, keep the raw graph and try again.

## Best Practices

1. **Always keep raw graph** - Don't overwrite the original
2. **Review analysis first** - Run `analyze_duplicates` before merging
3. **Test navigation** - After refinement, test with `guide.py`
4. **Iterate** - Refine multiple times if needed
5. **Document changes** - Keep notes on what Claude changed and why

## Next Steps

After refinement:
- Use refined graph for navigation: `python guide.py refined-graph.json`
- Compare navigation quality vs raw graph
- Manually adjust if needed
- Share feedback to improve auto-refinement
