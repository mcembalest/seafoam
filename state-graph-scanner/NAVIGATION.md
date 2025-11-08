# Navigation System Guide

The state-graph-scanner includes an AI-powered navigation system built on the [Claude Agent SDK](https://docs.claude.com/en/docs/agent-sdk) that uses scanned graphs to provide step-by-step user guidance.

## Prerequisites

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Install Python dependencies
pip install -r requirements.txt
```

## Quick Start

### 1. Scan an Application

```bash
npm run build
node dist/cli.js /path/to/app --output app-graph.json
```

### 2. Run Interactive Guide

```bash
python guide.py app-graph.json
```

### 3. Ask Questions

```
You: How do I save an image?
Guide: To save an image in this application:

1. Click the Generate button
2. Once generation completes, click the Save button
3. Enter a name for your image
4. Click Save to add it to your library

You'll end up in: image saved to library
```

## How It Works

### Architecture

```
┌─────────────────────────────────────┐
│  User Question                       │
│  "How do I save an image?"          │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Claude Agent SDK                    │
│  (with navigation tools)             │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  MCP Tools                           │
│  - find_path()                       │
│  - search_actions()                  │
│  - identify_state()                  │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  GraphNavigator                      │
│  (pathfinding algorithms)            │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  State-Action Graph                  │
│  (scanned from application)          │
└─────────────────────────────────────┘
```

### Navigation Tools

The system provides 4 MCP tools that Claude can use:

#### 1. `find_path`
Finds the shortest sequence of actions from a current state to a goal.

```python
find_path(current_state="initial", goal="save image")
# Returns step-by-step instructions
```

#### 2. `search_actions`
Searches for actions by keyword.

```python
search_actions(query="save")
# Returns: ["click Save button", "save to library", ...]
```

#### 3. `identify_state`
Identifies the current state from a natural language description.

```python
identify_state(description="I see a modal with a save button")
# Returns: "save_modal_open"
```

#### 4. `list_states`
Lists all available states in the application.

```python
list_states()
# Returns categorized list of states
```

## Programmatic Usage

### Simple Query

```python
from claude_agent_sdk import query, ClaudeAgentOptions
from navigation import create_navigation_server

# Load navigation server
nav_server = create_navigation_server('app-graph.json')

# Configure options
options = ClaudeAgentOptions(
    mcp_servers={"nav": nav_server},
    allowed_tools=[
        "mcp__nav__find_path",
        "mcp__nav__search_actions"
    ]
)

# Ask a question
async for message in query(
    prompt="How do I save an image?",
    options=options
):
    print(message)
```

### Multi-Turn Conversation

```python
from claude_agent_sdk import ClaudeSDKClient, AssistantMessage, TextBlock

async with ClaudeSDKClient(options=options) as client:
    # First question
    await client.query("What can I do in this app?")
    async for message in client.receive_response():
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)

    # Follow-up - Claude remembers context
    await client.query("How do I do the first thing you mentioned?")
    async for message in client.receive_response():
        # Process response...
```

### Batch Processing

```bash
# Process multiple queries at once
python guide.py app-graph.json --batch \
  "How do I save?" \
  "What actions are available?" \
  "How do I delete an item?"
```

## Advanced Features

### Custom System Prompt

Customize Claude's behavior:

```python
options = ClaudeAgentOptions(
    system_prompt={
        "type": "preset",
        "preset": "claude_code",
        "append": """
You are a patient teacher. When providing navigation instructions:
- Always explain WHY each step is necessary
- Offer alternatives when available
- Warn about potential issues
"""
    },
    mcp_servers={"nav": nav_server},
    # ...
)
```

### Using Different Models

```python
# Fast responses with Haiku
options = ClaudeAgentOptions(
    model="haiku",
    # ...
)

# Better reasoning with Opus
options = ClaudeAgentOptions(
    model="opus",
    # ...
)
```

### Direct Pathfinder Usage

Use the pathfinder without Claude for programmatic navigation:

```python
from navigation.pathfinder import GraphNavigator
import json

# Load graph
with open('app-graph.json') as f:
    graph_data = json.load(f)

nav = GraphNavigator(graph_data)

# Find path
path = nav.find_path('initial', 'save image', max_steps=10)
if path:
    for action_id, next_state in path:
        action_desc = nav.get_action_description(action_id)
        print(f"→ {action_desc}")

# Search actions
results = nav.search_actions('save', limit=5)
for result in results:
    print(result['labels'][0])

# Identify state
state = nav.identify_state('modal is open')
if state:
    print(f"You're in: {state['id']}")
```

## Troubleshooting

### "Module 'claude_agent_sdk' not found"

Make sure you've installed the SDK:
```bash
pip install claude-agent-sdk
```

### "Graph file not found"

Run the scanner first to generate the graph:
```bash
node dist/cli.js /path/to/app --output app-graph.json
```

### "Could not find path"

This can happen if:
- The goal state doesn't exist in the graph
- There's no valid path from current state to goal
- States are poorly labeled (scanner needs improvement)

Try:
- Search for available actions: `search_actions("your keyword")`
- List all states: `list_states()`
- Be more specific about your goal

### Too many states/transitions

The scanner currently generates many states. To improve:
- Filter the graph by confidence scores
- Manually edit the JSON to remove duplicate states
- Focus queries on high-level goals

## Examples

See `examples/simple_navigation.py` for complete working examples.

## Next Steps

- [ ] Add visual graph explorer
- [ ] Integrate screenshot analysis for state detection
- [ ] Learn from user interactions to improve paths
- [ ] Add support for conditional paths (if/else navigation)
- [ ] Create web UI for non-technical users
