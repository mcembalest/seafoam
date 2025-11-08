#!/usr/bin/env python3
"""
Generate an interactive visualization of a state-action graph.

Usage:
    python visualize.py graph.json
    python visualize.py graph.json --output viz/
"""
import json
import sys
import webbrowser
from pathlib import Path
from shutil import copy2


def generate_visualization(graph_path: str, output_dir: str = "viz"):
    """
    Generate interactive visualization.

    Args:
        graph_path: Path to graph JSON file
        output_dir: Directory to output visualization files
    """
    # Load graph
    print(f"Loading graph from {graph_path}...")
    with open(graph_path, 'r') as f:
        graph_data = json.load(f)

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Generate graph-data.js
    print("Generating visualization data...")
    js_content = f"const graphData = {json.dumps(graph_data, indent=2)};"

    graph_data_path = output_path / "graph-data.js"
    with open(graph_data_path, 'w') as f:
        f.write(js_content)

    # Copy viewer.html
    print("Copying viewer...")
    viewer_source = Path(__file__).parent / "visualization" / "viewer.html"
    viewer_dest = output_path / "index.html"
    copy2(viewer_source, viewer_dest)

    # Get stats
    num_states = len(graph_data['graph']['states'])
    num_actions = len(graph_data['graph']['actions'])
    num_transitions = len(graph_data['graph']['transitions'])

    print(f"\n✓ Visualization generated!")
    print(f"\nGraph stats:")
    print(f"  States: {num_states}")
    print(f"  Actions: {num_actions}")
    print(f"  Transitions: {num_transitions}")
    print(f"\nOutput directory: {output_path.absolute()}")
    print(f"Open in browser: file://{viewer_dest.absolute()}")

    return viewer_dest


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate interactive visualization of state-action graph"
    )
    parser.add_argument(
        "graph",
        help="Path to state-action-graph.json file"
    )
    parser.add_argument(
        "--output", "-o",
        default="viz",
        help="Output directory (default: viz)"
    )
    parser.add_argument(
        "--open", "-b",
        action="store_true",
        help="Open in browser automatically"
    )

    args = parser.parse_args()

    # Check if graph exists
    graph_path = Path(args.graph)
    if not graph_path.exists():
        print(f"Error: Graph file not found: {graph_path}", file=sys.stderr)
        print("\nRun the scanner first:", file=sys.stderr)
        print("  npm run scan -- /path/to/app --output graph.json", file=sys.stderr)
        sys.exit(1)

    # Generate visualization
    viewer_path = generate_visualization(str(graph_path), args.output)

    # Open in browser
    if args.open:
        print("\nOpening in browser...")
        webbrowser.open(f"file://{viewer_path.absolute()}")


if __name__ == "__main__":
    main()
