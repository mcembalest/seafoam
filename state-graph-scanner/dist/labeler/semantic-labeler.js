/**
 * Enriches the state-action graph with additional semantic labels
 * This is a simple heuristic-based approach. In production, this could use
 * an LLM to generate more natural language descriptions.
 */
export function enrichLabels(graph) {
    console.log('Enriching labels...');
    // Enrich state labels
    for (const [stateId, state] of graph.states.entries()) {
        enrichStateLabels(state);
    }
    // Enrich action labels
    for (const [actionId, action] of graph.actions.entries()) {
        enrichActionLabels(action);
    }
    return graph;
}
function enrichStateLabels(state) {
    const existingLabels = Array.from(state.labels);
    // Add variations of existing labels
    const newLabels = new Set(existingLabels);
    for (const label of existingLabels) {
        // Add question forms
        if (label.includes('ready')) {
            newLabels.add(label.replace('ready to', 'can I'));
            newLabels.add(label.replace('ready to', 'able to'));
        }
        // Add negative forms
        if (label.includes('empty') || label.includes('closed') || label.includes('not')) {
            newLabels.add('no ' + label.split(' ').slice(0, 2).join(' '));
        }
        // Add present/has variations
        if (label.includes('exists') || label.includes('present')) {
            const noun = label.split(' ')[0];
            newLabels.add(`have ${noun}`);
            newLabels.add(`${noun} available`);
        }
        // Add completion variations
        if (label.includes('completed') || label.includes('finished')) {
            const action = label.split(' ')[0];
            newLabels.add(`${action} done`);
            newLabels.add(`${action} successful`);
            newLabels.add(`finished ${action}`);
        }
    }
    state.labels = newLabels;
}
function enrichActionLabels(action) {
    const existingLabels = Array.from(action.labels);
    const newLabels = new Set(existingLabels);
    for (const label of existingLabels) {
        // Add imperative variations
        if (label.startsWith('click')) {
            const target = label.substring(6);
            newLabels.add(`press ${target}`);
            newLabels.add(`activate ${target}`);
        }
        // Add question forms
        if (label.includes('save')) {
            newLabels.add('how to save');
            newLabels.add('how do I save');
        }
        if (label.includes('generate')) {
            newLabels.add('how to generate');
            newLabels.add('how do I generate');
            newLabels.add('how to create');
        }
        if (label.includes('delete')) {
            newLabels.add('how to delete');
            newLabels.add('how do I remove');
        }
        if (label.includes('edit')) {
            newLabels.add('how to edit');
            newLabels.add('how do I modify');
            newLabels.add('how to change');
        }
        // Add gerund forms
        const verb = label.split(' ')[0];
        if (['save', 'delete', 'edit', 'create', 'generate', 'upload'].includes(verb)) {
            newLabels.add(verb + 'ing');
        }
    }
    action.labels = newLabels;
}
/**
 * Generates natural language descriptions for action sequences
 */
export function generatePathDescription(path, graph) {
    const descriptions = [];
    for (let i = 0; i < path.length; i++) {
        const { stateId, actionId } = path[i];
        const action = graph.actions.get(actionId);
        if (action) {
            // Get the most natural label
            const labels = Array.from(action.labels);
            const naturalLabel = labels.find(l => l.startsWith('click') || l.startsWith('how')) ||
                labels[0];
            // Convert to instruction
            let instruction = naturalLabel;
            if (naturalLabel.startsWith('click')) {
                instruction = naturalLabel.charAt(0).toUpperCase() + naturalLabel.slice(1);
            }
            else if (naturalLabel.includes('how to')) {
                instruction = naturalLabel.replace('how to', '').trim();
                instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1);
            }
            else {
                instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1);
            }
            descriptions.push(`${i + 1}. ${instruction}`);
        }
    }
    return descriptions;
}
