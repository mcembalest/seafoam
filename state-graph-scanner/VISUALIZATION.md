# Graph Visualization Guide

The visualization system provides an interactive web-based explorer for state-action graphs.

## Features

- **Interactive Network Graph**: Zoom, pan, and explore the graph visually
- **Color-Coded States**: Different colors for modals, ready states, data states, etc.
- **Search & Filter**: Find specific states or filter by category
- **Node Details**: Click any state or transition to view detailed information
- **Physics Simulation**: Automatic graph layout with force-directed positioning
- **Export-Ready**: Generate standalone HTML that can be shared

## Quick Start

```bash
# Generate visualization
python visualize.py my-graph.json

# Output will be in viz/ directory
# Open viz/index.html in a browser
```

### Open Automatically

```bash
# Generate and open in browser
python visualize.py my-graph.json --open
```

### Custom Output Directory

```bash
# Specify output location
python visualize.py my-graph.json --output my-viz/
```

## Usage

### 1. Generate Visualization

After scanning or refining a graph:

```bash
# From raw graph
python visualize.py seafoam-raw.json --output viz-raw

# From refined graph (recommended)
python visualize.py seafoam-refined.json --output viz-refined --open
```

### 2. Explore the Graph

The visualization opens in your browser with:

**Left Sidebar:**
- **Stats**: Total states, actions, transitions
- **Search**: Find states/actions by name or label
- **Filters**: Show/hide different state categories
- **Details**: Information about selected nodes

**Graph View:**
- **Zoom**: Mouse wheel or pinch
- **Pan**: Click and drag on empty space
- **Select**: Click on states (nodes) or transitions (edges)
- **Physics**: Toggle automatic layout animation

**Controls (bottom right):**
- **Fit View**: Zoom to show entire graph
- **Reset Zoom**: Return to 1:1 scale
- **Toggle Physics**: Enable/disable automatic positioning

### 3. Understanding the Visualization

**State Colors:**
- 🟣 **Purple**: Initial state
- 🔵 **Blue**: Modal states (dialogs, popups)
- 🟢 **Green**: Ready states (actions available)
- 🟠 **Orange**: Data states (presence/absence of data)
- ⚫ **Gray**: Other states

**Transitions:**
- **Arrows** show the direction of state changes
- **Hover** over edges to see action details
- **Click** on edges to see full transition info

## Examples

### Example 1: Visual Graph Comparison

Compare raw vs refined graphs:

```bash
# Generate both visualizations
python visualize.py raw-graph.json --output viz-raw
python visualize.py refined-graph.json --output viz-refined

# Open both in browser tabs to compare
```

You'll see:
- **Raw**: 100+ states, complex interconnections
- **Refined**: 15-25 states, clear structure

### Example 2: Finding Navigation Paths

1. Generate visualization of refined graph
2. Click on the initial state
3. Look at outgoing transitions (green arrows)
4. Follow the path to your goal state
5. Note the actions needed at each step

### Example 3: Identifying Bottlenecks

States with many incoming or outgoing transitions are key navigation points:

1. Open visualization
2. Look for states with lots of arrows
3. Click to see details
4. These are "hub" states in your application

## Advanced Features

### Sharing Visualizations

The generated visualization is a standalone HTML file:

```bash
# Generate
python visualize.py graph.json --output public-viz

# The entire viz is in public-viz/
# Share the directory or host it on a web server
```

### Customizing Colors

Edit `visualization/viewer.html` to customize the appearance:

```javascript
// Around line 300 in the HTML
if (state.id === 'initial') {
    node.color = {background: '#YOUR_COLOR', border: '#BORDER_COLOR'};
}
```

### Exporting Images

Use browser screenshot tools or:

1. Open visualization
2. Click "Fit View"
3. Use browser developer tools to capture canvas
4. Or use print-to-PDF

### Filtering Complex Graphs

For graphs with 50+ states:

1. Use **filters** to show only relevant categories
2. Use **search** to find specific paths
3. Toggle **physics** off for static view
4. Focus on specific regions by clicking "Fit View" after filtering

## Troubleshooting

### Graph is too cluttered

- **Solution 1**: Refine the graph first
  ```bash
  python refine.py raw.json --output refined.json --auto
  python visualize.py refined.json
  ```

- **Solution 2**: Use filters to hide categories
  - Uncheck "Data States" or "Other States" in sidebar

### Graph layout is messy

- Click **"Fit View"** to auto-arrange
- Click **"Toggle Physics"** to run layout algorithm
- Wait a few seconds for stabilization
- Manually drag nodes to desired positions

### Can't find a specific state

- Use the **search box** in the sidebar
- Type part of the state name or label
- Matching states will be highlighted and focused

### Visualization won't open

Check that you have both files in the output directory:
```
viz/
├── index.html     # The viewer
└── graph-data.js  # Your graph data
```

If `graph-data.js` is missing, re-run:
```bash
python visualize.py your-graph.json --output viz
```

### Browser shows blank page

- Check browser console for errors (F12 → Console)
- Ensure you're opening `index.html` (not `viewer.html`)
- Try a different browser (Chrome, Firefox, Safari)

## Best Practices

### 1. Visualize Refined Graphs

Always refine before visualizing for best results:

```bash
# Complete workflow
npm run scan -- /path/to/app --output raw.json
python refine.py raw.json --output refined.json --auto
python visualize.py refined.json --open
```

### 2. Use Meaningful Names

When refining, use clear state names:
- ✅ `image_editor_open`
- ❌ `_modal_content_edit_mode_active`

### 3. Document Your Graph

Add a README in the viz directory:

```bash
cat > viz/README.md << EOF
# Application State Graph

Generated: $(date)
Source: my-app v1.0

## Key States
- initial: Starting point
- image_generated: After user creates image
- image_saved: After saving to library
EOF
```

### 4. Version Control

Keep visualizations in version control to track changes:

```bash
# Generate visualization
python visualize.py graph.json --output viz-v1.0

# Commit to git
git add viz-v1.0/
git commit -m "Add state graph visualization v1.0"
```

## Integration with Navigation

The visualization complements the navigation system:

1. **Visualize** to understand the overall structure
2. **Navigate** to get step-by-step guidance

```bash
# Explore visually
python visualize.py refined.json --open

# Then get AI guidance
python guide.py refined.json
You: How do I get from initial to image_saved?
```

## Performance

The visualization handles graphs of different sizes:

| Graph Size | Performance | Recommendation |
|------------|-------------|----------------|
| < 25 states | Excellent | Use as-is |
| 25-50 states | Good | Consider filtering |
| 50-100 states | Moderate | Refine first |
| 100+ states | Poor | Must refine |

For large graphs, **always refine first** for best experience.

## Next Steps

- Explore the visualization interactively
- Use it to validate your refinement
- Share with team members
- Integrate into documentation

## See Also

- [REFINEMENT.md](REFINEMENT.md) - How to refine graphs for better visualization
- [NAVIGATION.md](NAVIGATION.md) - Using the AI navigation system
- [README.md](README.md) - Complete scanner documentation
