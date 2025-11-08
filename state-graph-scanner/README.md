# State-Action Graph Scanner

A framework-agnostic utility that extracts state-action graphs from interactive systems (web apps, mobile apps, etc.) to enable AI-powered step-by-step user guidance and navigation.

## Overview

This scanner analyzes source code to discover:
- **States**: Discrete configurations of the system (e.g., "modal open", "data loaded")
- **Actions**: User interactions that trigger state changes (e.g., "click save button")
- **Transitions**: Valid paths between states via actions

The system includes:
- **Scanner**: Static analysis to extract raw graph from code
- **Refiner**: AI-powered deduplication and consolidation
- **Navigator**: Natural language query interface for user guidance

The resulting graph enables:
- Natural language query → action sequence mapping
- Step-by-step guidance ("How do I save an image?")
- Progress checkpointing
- Shortest path finding to user goals

## Philosophy

### What This Is
- A **structural scanner** that extracts state-action graphs from code
- **Framework-agnostic** - works with React, Vue, vanilla JS, or any web technology
- **Searchable by design** - produces graphs with semantic labels for NL queries
- **Guidance-oriented** - focused on helping users navigate toward goals

### What This Is Not
- Not a runtime instrumentation tool (though could be extended with dynamic tracing)
- Not specific to any particular app or framework
- Not opinionated about search implementation (embeddings, fuzzy matching, etc.)

## Core Abstractions

```typescript
type StateActionGraph = {
  states: Map<StateId, State>      // Discrete system configurations
  actions: Map<ActionId, Action>   // User interactions
  transitions: Transition[]        // Valid state→action→state paths
}

type State = {
  id: StateId
  labels: Set<Label>               // Semantic descriptions
  conditions: Condition[]          // What defines this state
}

type Action = {
  id: ActionId
  labels: Set<Label>               // Semantic descriptions
}

type Transition = {
  from: StateId
  via: ActionId
  to: StateId
}
```

## Installation

```bash
cd state-graph-scanner

# Install JavaScript dependencies (for scanner)
npm install
npm run build

# Install Python dependencies (for refinement and navigation)
pip install -r requirements.txt
```

## Quick Start

### Complete Workflow (Scan + Refine)

```bash
# Scan and refine in one command
./scan-and-refine.sh /path/to/app my-app

# Results:
#   my-app-raw.json      - Raw scanned graph (100+ states)
#   my-app-refined.json  - AI-refined graph (15-25 states)
```

### Individual Steps

```bash
# Step 1: Scan application
npm run scan -- /path/to/app --output raw-graph.json

# Step 2: Refine with AI (removes duplicates, consolidates states)
python refine.py raw-graph.json --output refined-graph.json --auto

# Step 3: Use for navigation
python guide.py refined-graph.json
```

### Programmatic

```typescript
import { scan } from './scanner.js';

const result = await scan('/path/to/app');

// result.graph contains the state-action graph
// result.guide contains execution instructions
// result.metadata contains scan metadata
```

## How It Works

### Phase 1: Scanning (TypeScript)
Static code analysis extracts raw structure:
- Event handlers (`addEventListener`, `onClick`, etc.)
- State variables (stores, context, global state)
- UI elements (buttons, forms, modals)
- API endpoints
- Synthesizes states, actions, and transitions
- Adds semantic labels for searchability

**Output**: Raw graph with 100+ states (includes duplicates and internal details)

### Phase 2: Refinement (Python + Claude SDK)
AI-powered graph consolidation:
- **Duplicate detection**: Identifies states representing the same UI element
- **Merging**: Consolidates duplicate states (e.g., multiple modal selectors → one modal state)
- **Pruning**: Removes internal implementation details
- **Relabeling**: Improves clarity of state names

**Output**: Refined graph with 15-25 high-level user-facing states

### Phase 3: Navigation (Python + Claude SDK)
Natural language query interface:
- Pathfinding algorithms (BFS for shortest routes)
- Action search and discovery
- Multi-turn conversational guidance
- Context-aware help

## Example Output

For a simple image generation app, the scanner produces:

```json
{
  "graph": {
    "states": [
      {
        "id": "ready_to_generate",
        "labels": ["ready to generate", "can generate", "composition filled"],
        "conditions": [{"type": "element_enabled", "selector": "#generate-btn"}]
      },
      {
        "id": "generate_completed",
        "labels": ["image generated", "result ready", "generation finished"],
        "conditions": []
      }
    ],
    "actions": [
      {
        "id": "action_click_generate_btn",
        "labels": ["click Generate", "generate image", "how to generate"],
        "metadata": {"trigger": "click #generate-btn"}
      }
    ],
    "transitions": [
      {
        "from": "ready_to_generate",
        "via": "action_click_generate_btn",
        "to": "generate_completed"
      }
    ]
  }
}
```

## Navigation System (Python)

The scanner includes an AI-powered navigation system that uses the scanned graph to provide step-by-step guidance to users.

### Quick Start

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run interactive guide
python guide.py seafoam-graph.json
```

### Interactive Guide

The guide provides a conversational interface for navigating applications:

```
You: How do I save an image?
Guide: To save an image in this application:

1. Click the Generate button
2. Click the Save button
3. Enter a name for your image

You'll end up in: image saved to library
```

### Features

- **Path Finding**: Finds shortest path from current state to goal
- **Action Search**: Search available actions by keyword
- **State Identification**: Identifies current state from user description
- **Context Awareness**: Remembers conversation history

### Programmatic Usage

```python
from claude_agent_sdk import query, ClaudeAgentOptions
from navigation import create_navigation_server

# Load navigation server
nav_server = create_navigation_server('seafoam-graph.json')

# Configure with navigation tools
options = ClaudeAgentOptions(
    mcp_servers={"nav": nav_server},
    allowed_tools=["mcp__nav__find_path", "mcp__nav__search_actions"]
)

# Ask questions
async for message in query(
    prompt="How do I save an image?",
    options=options
):
    print(message)
```

### Available Tools

- `find_path`: Find step-by-step instructions from current state to goal
- `search_actions`: Search for actions by keyword
- `identify_state`: Identify current state from description
- `list_states`: List all available states

### Examples

See `examples/simple_navigation.py` for complete examples.

## Architecture

```
state-graph-scanner/
├── src/                      # TypeScript scanner
│   ├── types.ts              # Core type definitions
│   ├── scanner.ts            # Main orchestrator
│   ├── extractors/           # Code parsers
│   ├── synthesizers/         # State/action identification
│   └── labeler/              # Semantic enrichment
├── navigation/               # Python navigation system
│   ├── pathfinder.py         # Graph search algorithms
│   ├── tools.py              # MCP tool definitions
│   └── server.py             # MCP server setup
├── guide.py                  # Interactive guide CLI
└── examples/                 # Usage examples
```

## Design Principles

1. **Functional thinking**: Types define transformations, not implementations
2. **Framework-agnostic**: No assumptions about React, Vue, or other frameworks
3. **Searchable by construction**: Every state/action has semantic labels
4. **User-oriented**: States represent user-perceivable configurations
5. **Path-independent**: No complex history tracking in the graph itself

## Future Enhancements

### Scanner Improvements
- [ ] Dynamic tracing (instrument apps to record actual state transitions)
- [ ] LLM-based labeling (use language models for richer semantic descriptions)
- [ ] State deduplication (merge similar states)
- [ ] Confidence filtering (remove low-confidence states/transitions)
- [ ] Manual annotation support (allow users to refine the graph)

### Navigation Enhancements
- [x] Path finding algorithms (BFS for shortest paths)
- [x] Query interface (natural language → action sequences)
- [ ] Visual graph explorer (web UI for browsing the graph)
- [ ] Multi-modal state detection (use screenshots + graph)
- [ ] Learning from user interactions (improve paths based on usage)

## Testing

The scanner has been tested on:
- Seafoam (vanilla JS image composition app)

## Contributing

This is an experimental utility. Feedback and contributions welcome!

## License

MIT
