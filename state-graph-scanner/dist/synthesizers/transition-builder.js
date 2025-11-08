export function buildTransitions(states, actions) {
    const transitions = [];
    // Build transitions by matching action labels with state labels
    for (const [actionId, action] of actions.entries()) {
        // Find potential source states
        const sourceStates = findSourceStates(action, states);
        // Find potential destination states
        const destStates = findDestinationStates(action, states);
        // Create transitions
        for (const fromState of sourceStates) {
            for (const toState of destStates) {
                // Avoid self-loops unless they make sense
                if (fromState === toState)
                    continue;
                transitions.push({
                    from: fromState,
                    via: actionId,
                    to: toState,
                    metadata: {
                        sourceLocation: action.metadata?.sourceLocation,
                        confidence: calculateConfidence(fromState, actionId, toState, states, actions)
                    }
                });
            }
        }
        // If no clear destination, connect to a generic "after action" state
        if (sourceStates.length > 0 && destStates.length === 0) {
            for (const fromState of sourceStates) {
                // Create an implicit destination state if action modifies state
                const implicitDest = inferDestinationState(fromState, action);
                if (implicitDest && states.has(implicitDest)) {
                    transitions.push({
                        from: fromState,
                        via: actionId,
                        to: implicitDest,
                        metadata: {
                            sourceLocation: action.metadata?.sourceLocation,
                            confidence: 0.5
                        }
                    });
                }
            }
        }
    }
    // Add initial transitions to states that don't require preconditions
    const entryStates = findEntryStates(states);
    for (const entryState of entryStates) {
        // Check if there's already a transition to this state from initial
        const hasInitialTransition = transitions.some(t => t.from === 'initial' && t.to === entryState);
        if (!hasInitialTransition) {
            // Create a synthetic "load" action if needed
            const loadActionId = `action_load_to_${entryState}`;
            if (!actions.has(loadActionId)) {
                actions.set(loadActionId, {
                    id: loadActionId,
                    labels: new Set(['application loaded', 'initialize', 'start']),
                    metadata: { trigger: 'page load' }
                });
            }
            transitions.push({
                from: 'initial',
                via: loadActionId,
                to: entryState,
                metadata: { confidence: 0.8 }
            });
        }
    }
    console.log(`Built ${transitions.length} transitions`);
    return transitions;
}
function findSourceStates(action, states) {
    const sources = [];
    for (const [stateId, state] of states.entries()) {
        // Match based on labels
        const actionLabels = Array.from(action.labels);
        const stateLabels = Array.from(state.labels);
        // Actions like "click Generate" should be available from "ready_to_generate"
        if (actionLabels.some(al => stateLabels.some(sl => sl.includes('ready') && al.toLowerCase().includes(sl.split('ready to ')[1]?.split(' ')[0] || '')))) {
            sources.push(stateId);
        }
        // Actions like "open modal" should be available from "modal_closed"
        if (actionLabels.some(al => al.includes('open')) && stateId.includes('closed')) {
            sources.push(stateId);
        }
        // Actions like "close modal" or "cancel" should be available from "modal_open"
        if (actionLabels.some(al => al.includes('close') || al.includes('cancel')) && stateId.includes('open')) {
            sources.push(stateId);
        }
        // Actions like "save" should be available from states with data present
        if (actionLabels.some(al => al.includes('save')) && stateId.includes('present')) {
            sources.push(stateId);
        }
        // Generic: if state has no restrictions, action might be available
        if (state.conditions.length === 0 && stateId !== 'initial') {
            // Don't add everything as source, be selective
        }
    }
    // If no specific sources found, consider some general states
    if (sources.length === 0) {
        // Actions might be available from initial state
        const actionLabels = Array.from(action.labels);
        if (actionLabels.some(al => al.includes('load') || al.includes('init') || al.includes('start'))) {
            sources.push('initial');
        }
    }
    return sources;
}
function findDestinationStates(action, states) {
    const destinations = [];
    for (const [stateId, state] of states.entries()) {
        const actionLabels = Array.from(action.labels);
        const stateLabels = Array.from(state.labels);
        // Actions like "generate" lead to "completed" states
        if (actionLabels.some(al => al.includes('generate') || al.includes('create')) &&
            stateLabels.some(sl => sl.includes('completed') || sl.includes('ready'))) {
            destinations.push(stateId);
        }
        // Actions like "open modal" lead to "modal_open"
        if (actionLabels.some(al => al.includes('open')) && stateId.includes('open')) {
            destinations.push(stateId);
        }
        // Actions like "close" or "cancel" lead to "modal_closed"
        if (actionLabels.some(al => al.includes('close') || al.includes('cancel')) && stateId.includes('closed')) {
            destinations.push(stateId);
        }
        // Actions like "save" lead to data "present" states
        if (actionLabels.some(al => al.includes('save')) && stateId.includes('present')) {
            destinations.push(stateId);
        }
        // Actions like "delete" lead to data "empty" states
        if (actionLabels.some(al => al.includes('delete')) && stateId.includes('empty')) {
            destinations.push(stateId);
        }
    }
    return destinations;
}
function inferDestinationState(fromState, action) {
    const actionLabels = Array.from(action.labels);
    // Infer based on action semantics
    if (actionLabels.some(al => al.includes('generate') || al.includes('create'))) {
        return fromState.replace('ready', 'completed');
    }
    if (actionLabels.some(al => al.includes('close'))) {
        return fromState.replace('open', 'closed');
    }
    if (actionLabels.some(al => al.includes('open'))) {
        return fromState.replace('closed', 'open');
    }
    return null;
}
function findEntryStates(states) {
    const entries = [];
    for (const [stateId, state] of states.entries()) {
        if (stateId === 'initial')
            continue;
        // States that represent the initial view (modals closed, data empty)
        if (stateId.includes('closed') || stateId.includes('empty')) {
            entries.push(stateId);
        }
    }
    return entries;
}
function calculateConfidence(from, via, to, states, actions) {
    // Simple heuristic-based confidence
    let confidence = 0.5;
    const action = actions.get(via);
    if (!action)
        return confidence;
    const actionLabels = Array.from(action.labels);
    // Higher confidence for clear patterns
    if (actionLabels.some(al => al.includes('generate')) && to.includes('completed')) {
        confidence = 0.9;
    }
    if (actionLabels.some(al => al.includes('open')) && to.includes('open')) {
        confidence = 0.9;
    }
    if (actionLabels.some(al => al.includes('close')) && to.includes('closed')) {
        confidence = 0.9;
    }
    return confidence;
}
