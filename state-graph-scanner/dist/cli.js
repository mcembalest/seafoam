#!/usr/bin/env node
import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { scan } from './scanner.js';
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
State-Action Graph Scanner
==========================

Usage:
  state-graph-scanner <directory> [options]

Arguments:
  <directory>    Root directory of the application to scan

Options:
  --output, -o   Output file path (default: state-action-graph.json)
  --help, -h     Show this help message

Examples:
  state-graph-scanner ./my-app
  state-graph-scanner ./my-app --output graph.json
`);
        process.exit(0);
    }
    const targetDir = resolve(args[0]);
    const outputFile = args.includes('--output') || args.includes('-o')
        ? args[args.indexOf(args.find(a => a === '--output' || a === '-o')) + 1]
        : 'state-action-graph.json';
    try {
        // Run the scanner
        const result = await scan(targetDir);
        // Convert result to JSON-serializable format
        const jsonResult = {
            graph: {
                states: Array.from(result.graph.states.entries()).map(([id, state]) => ({
                    id,
                    labels: Array.from(state.labels),
                    conditions: state.conditions,
                    metadata: state.metadata
                })),
                actions: Array.from(result.graph.actions.entries()).map(([id, action]) => ({
                    id,
                    labels: Array.from(action.labels),
                    metadata: action.metadata
                })),
                transitions: result.graph.transitions
            },
            guide: {
                actionInstructions: Array.from(result.guide.actionInstructions.entries()).map(([id, instructions]) => ({
                    actionId: id,
                    instructions
                }))
            },
            metadata: {
                ...result.metadata,
                scannedAt: result.metadata.scannedAt.toISOString()
            }
        };
        // Write to file
        const outputPath = resolve(outputFile);
        await writeFile(outputPath, JSON.stringify(jsonResult, null, 2));
        console.log(`\n✓ Graph saved to: ${outputPath}`);
        console.log('\nNext steps:');
        console.log('  1. Review the generated graph');
        console.log('  2. Annotate or correct states/actions as needed');
        console.log('  3. Use the graph for user guidance and navigation\n');
    }
    catch (error) {
        console.error('Error scanning application:', error);
        process.exit(1);
    }
}
main();
