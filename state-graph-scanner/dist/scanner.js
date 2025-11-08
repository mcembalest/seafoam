import { extractStructure } from './extractors/structure-extractor.js';
import { identifyStates } from './synthesizers/state-identifier.js';
import { extractActions } from './synthesizers/action-extractor.js';
import { buildTransitions } from './synthesizers/transition-builder.js';
import { enrichLabels } from './labeler/semantic-labeler.js';
/**
 * Main scanner function - scans an interactive system and produces a state-action graph
 *
 * @param rootDir - Root directory of the application to scan
 * @returns ScanResult containing the state-action graph, execution guide, and metadata
 */
export async function scan(rootDir) {
    console.log('=== State-Action Graph Scanner ===');
    console.log(`Scanning: ${rootDir}\n`);
    // Phase 1: Extract raw structure from source code
    console.log('[1/5] Extracting structure from source code...');
    const structure = await extractStructure(rootDir);
    // Phase 2: Identify discrete states
    console.log('\n[2/5] Identifying states...');
    const states = identifyStates(structure);
    // Phase 3: Extract actions
    console.log('\n[3/5] Extracting actions...');
    const actions = extractActions(structure);
    // Phase 4: Build transitions between states via actions
    console.log('\n[4/5] Building transitions...');
    const transitions = buildTransitions(states, actions);
    // Phase 5: Enrich with semantic labels
    console.log('\n[5/5] Enriching labels...');
    const graph = {
        states,
        actions,
        transitions
    };
    const enrichedGraph = enrichLabels(graph);
    // Build execution guide (placeholder for now)
    const guide = {
        actionInstructions: new Map()
    };
    // Populate basic instructions for each action
    for (const [actionId, action] of enrichedGraph.actions.entries()) {
        const trigger = action.metadata?.trigger;
        if (trigger) {
            const instructions = [];
            if (trigger.startsWith('click')) {
                const selector = trigger.substring(6);
                instructions.push({
                    type: 'click',
                    selector,
                    description: `Click ${selector}`
                });
            }
            else if (trigger.startsWith('submit')) {
                const selector = trigger.substring(7);
                instructions.push({
                    type: 'click',
                    selector,
                    description: `Submit ${selector}`
                });
            }
            guide.actionInstructions.set(actionId, instructions);
        }
    }
    // Calculate confidence scores
    const stateConfidence = calculateStateConfidence(enrichedGraph);
    const actionConfidence = calculateActionConfidence(enrichedGraph);
    const transitionConfidence = calculateTransitionConfidence(enrichedGraph);
    const result = {
        graph: enrichedGraph,
        guide,
        metadata: {
            scannedAt: new Date(),
            sourceFiles: [...structure.eventHandlers.map(h => h.handlerLocation)],
            systemType: 'web-application',
            confidence: {
                overall: (stateConfidence + actionConfidence + transitionConfidence) / 3,
                states: stateConfidence,
                actions: actionConfidence,
                transitions: transitionConfidence
            }
        }
    };
    console.log('\n=== Scan Complete ===');
    console.log(`States: ${enrichedGraph.states.size}`);
    console.log(`Actions: ${enrichedGraph.actions.size}`);
    console.log(`Transitions: ${enrichedGraph.transitions.length}`);
    console.log(`Overall Confidence: ${(result.metadata.confidence.overall * 100).toFixed(1)}%\n`);
    return result;
}
function calculateStateConfidence(graph) {
    // States with more conditions and metadata are more confident
    let totalConfidence = 0;
    for (const state of graph.states.values()) {
        let confidence = 0.5;
        if (state.conditions.length > 0)
            confidence += 0.2;
        if (state.metadata?.sourceLocations && state.metadata.sourceLocations.length > 0)
            confidence += 0.2;
        if (state.labels.size > 2)
            confidence += 0.1;
        totalConfidence += Math.min(confidence, 1.0);
    }
    return graph.states.size > 0 ? totalConfidence / graph.states.size : 0;
}
function calculateActionConfidence(graph) {
    // Actions with source locations and triggers are more confident
    let totalConfidence = 0;
    for (const action of graph.actions.values()) {
        let confidence = 0.5;
        if (action.metadata?.sourceLocation)
            confidence += 0.3;
        if (action.metadata?.trigger)
            confidence += 0.2;
        totalConfidence += Math.min(confidence, 1.0);
    }
    return graph.actions.size > 0 ? totalConfidence / graph.actions.size : 0;
}
function calculateTransitionConfidence(graph) {
    // Use metadata confidence if available
    let totalConfidence = 0;
    for (const transition of graph.transitions) {
        totalConfidence += transition.metadata?.confidence || 0.5;
    }
    return graph.transitions.length > 0 ? totalConfidence / graph.transitions.length : 0;
}
