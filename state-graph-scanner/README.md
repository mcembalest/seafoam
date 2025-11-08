# State-Action Graph Scanner

A framework-agnostic utility that extracts state-action graphs from interactive systems (web apps, mobile apps, etc.) to enable step-by-step user guidance and navigation.

## Overview

This scanner analyzes source code to discover:
- **States**: Discrete configurations of the system (e.g., "modal open", "data loaded")
- **Actions**: User interactions that trigger state changes (e.g., "click save button")
- **Transitions**: Valid paths between states via actions

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
npm install
npm run build
```

## Usage

### Command Line

```bash
# Scan an application
npm run scan -- /path/to/app

# Specify output file
npm run scan -- /path/to/app --output my-graph.json
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

### 1. Extraction Phase
Scans source code to extract:
- Event handlers (`addEventListener`, `onClick`, etc.)
- State variables (stores, context, global state)
- UI elements (buttons, forms, modals)
- API endpoints

### 2. Synthesis Phase
Identifies states and actions:
- **States**: Inferred from modals, data presence, button enablement
- **Actions**: Extracted from event handlers, buttons, API calls
- **Transitions**: Connected by matching action semantics with state conditions

### 3. Labeling Phase
Enriches graph with semantic labels:
- Adds natural language variations
- Generates question forms ("how do I...")
- Creates searchable descriptions

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

## Path Finding (Future)

The graph enables queries like:

```typescript
// "How do I save an image?"
const guidance = findPath(graph, currentState, "image_saved");

// Returns:
{
  steps: [
    { state: "ready_to_generate", action: "generate_image" },
    { state: "generate_completed", action: "save_image" }
  ],
  descriptions: [
    "1. Click the Generate button",
    "2. Click the Save button"
  ]
}
```

## Architecture

```
state-graph-scanner/
├── src/
│   ├── types.ts              # Core type definitions
│   ├── scanner.ts            # Main orchestrator
│   ├── extractors/
│   │   ├── ast-extractor.ts      # JavaScript/TypeScript parsing
│   │   ├── html-extractor.ts     # HTML parsing
│   │   └── structure-extractor.ts # Coordinator
│   ├── synthesizers/
│   │   ├── state-identifier.ts   # State discovery
│   │   ├── action-extractor.ts   # Action extraction
│   │   └── transition-builder.ts # Graph construction
│   └── labeler/
│       └── semantic-labeler.ts   # Label enrichment
└── cli.ts                    # Command-line interface
```

## Design Principles

1. **Functional thinking**: Types define transformations, not implementations
2. **Framework-agnostic**: No assumptions about React, Vue, or other frameworks
3. **Searchable by construction**: Every state/action has semantic labels
4. **User-oriented**: States represent user-perceivable configurations
5. **Path-independent**: No complex history tracking in the graph itself

## Future Enhancements

- [ ] Dynamic tracing (instrument apps to record actual state transitions)
- [ ] LLM-based labeling (use language models for richer semantic descriptions)
- [ ] Confidence scoring (measure reliability of extracted states/actions)
- [ ] Manual annotation support (allow users to refine the graph)
- [ ] Path finding algorithms (Dijkstra, A* for goal-oriented navigation)
- [ ] Query interface (natural language → action sequences)

## Testing

The scanner has been tested on:
- Seafoam (vanilla JS image composition app)

## Contributing

This is an experimental utility. Feedback and contributions welcome!

## License

MIT
