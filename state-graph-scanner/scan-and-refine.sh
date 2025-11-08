#!/bin/bash
# Complete workflow: scan and refine in one command

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <app-path> [output-name]"
    echo "Example: $0 /path/to/app my-app"
    exit 1
fi

APP_PATH=$1
OUTPUT_NAME=${2:-"graph"}

echo "========================================="
echo "State-Action Graph Scanner + Refinement"
echo "========================================="
echo ""

# Step 1: Scan
echo "[1/3] Scanning application..."
node dist/cli.js "$APP_PATH" --output "${OUTPUT_NAME}-raw.json"

if [ $? -ne 0 ]; then
    echo "❌ Scanning failed"
    exit 1
fi

echo ""
echo "✓ Raw graph saved to ${OUTPUT_NAME}-raw.json"
echo ""

# Step 2: Refine
echo "[2/3] Refining graph with AI..."
python refine.py "${OUTPUT_NAME}-raw.json" --output "${OUTPUT_NAME}-refined.json" --auto

if [ $? -ne 0 ]; then
    echo "❌ Refinement failed"
    exit 1
fi

echo ""
echo "✓ Refined graph saved to ${OUTPUT_NAME}-refined.json"
echo ""

# Step 3: Show comparison
echo "[3/3] Comparison:"
echo ""

RAW_STATES=$(grep -o '"id":' "${OUTPUT_NAME}-raw.json" | wc -l)
REFINED_STATES=$(grep -o '"id":' "${OUTPUT_NAME}-refined.json" | wc -l)

echo "  Raw graph:      $RAW_STATES states"
echo "  Refined graph:  $REFINED_STATES states"
echo "  Improvement:    $((RAW_STATES - REFINED_STATES)) states removed"
echo ""

echo "========================================="
echo "✓ Complete! Use refined graph for navigation:"
echo "  python guide.py ${OUTPUT_NAME}-refined.json"
echo "========================================="
