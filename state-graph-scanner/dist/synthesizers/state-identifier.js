export function identifyStates(structure) {
    const states = new Map();
    // Always have an initial state
    states.set('initial', {
        id: 'initial',
        labels: new Set(['initial', 'starting state', 'application loaded']),
        conditions: []
    });
    // Identify states based on modals
    structure.uiElements
        .filter(e => e.type === 'modal')
        .forEach(modal => {
        const modalId = modal.selector.replace(/[#.\[\]"':]/g, '_');
        // State: modal closed
        const closedStateId = `${modalId}_closed`;
        if (!states.has(closedStateId)) {
            states.set(closedStateId, {
                id: closedStateId,
                labels: new Set([
                    `${modal.text || modalId} closed`,
                    'modal closed',
                    `no ${modal.text || modalId}`
                ]),
                conditions: [
                    { type: 'element_visible', selector: modal.selector }
                ]
            });
        }
        // State: modal open
        const openStateId = `${modalId}_open`;
        if (!states.has(openStateId)) {
            states.set(openStateId, {
                id: openStateId,
                labels: new Set([
                    `${modal.text || modalId} open`,
                    'modal open',
                    `editing ${modal.text || modalId}`,
                    `viewing ${modal.text || modalId}`
                ]),
                conditions: [
                    { type: 'modal_open', modalId: modal.selector }
                ]
            });
        }
    });
    // Identify states based on data presence
    structure.stateVariables.forEach(variable => {
        // State: data empty
        const emptyStateId = `${variable.name}_empty`;
        if (!states.has(emptyStateId)) {
            states.set(emptyStateId, {
                id: emptyStateId,
                labels: new Set([
                    `${variable.name} empty`,
                    `no ${variable.name}`,
                    `${variable.name} not set`
                ]),
                conditions: [
                    { type: 'variable', name: variable.name, operator: 'empty', value: null }
                ],
                metadata: {
                    sourceLocations: [variable.location]
                }
            });
        }
        // State: data present
        const presentStateId = `${variable.name}_present`;
        if (!states.has(presentStateId)) {
            states.set(presentStateId, {
                id: presentStateId,
                labels: new Set([
                    `${variable.name} exists`,
                    `has ${variable.name}`,
                    `${variable.name} loaded`
                ]),
                conditions: [
                    { type: 'variable', name: variable.name, operator: 'exists', value: null }
                ],
                metadata: {
                    sourceLocations: [variable.location]
                }
            });
        }
    });
    // Identify states based on button enabled/disabled patterns
    structure.uiElements
        .filter(e => e.type === 'button' && e.text)
        .forEach(button => {
        const buttonId = button.selector.replace(/[#.\[\]"':]/g, '_');
        const actionName = (button.text || '').toLowerCase();
        // Infer states from button semantics
        if (actionName.includes('save') || actionName.includes('submit')) {
            // State: ready to save/submit
            const readyStateId = `ready_to_${actionName.replace(/\s+/g, '_')}`;
            if (!states.has(readyStateId)) {
                states.set(readyStateId, {
                    id: readyStateId,
                    labels: new Set([
                        `ready to ${actionName}`,
                        `can ${actionName}`,
                        `${actionName} enabled`
                    ]),
                    conditions: [
                        { type: 'element_enabled', selector: button.selector }
                    ]
                });
            }
        }
        if (actionName.includes('generate') || actionName.includes('create')) {
            // State: ready to generate/create
            const readyStateId = `ready_to_${actionName.replace(/\s+/g, '_')}`;
            if (!states.has(readyStateId)) {
                states.set(readyStateId, {
                    id: readyStateId,
                    labels: new Set([
                        `ready to ${actionName}`,
                        `can ${actionName}`,
                        `${actionName} available`
                    ]),
                    conditions: [
                        { type: 'element_enabled', selector: button.selector }
                    ]
                });
            }
            // State: result created
            const completedStateId = `${actionName.replace(/\s+/g, '_')}_completed`;
            if (!states.has(completedStateId)) {
                states.set(completedStateId, {
                    id: completedStateId,
                    labels: new Set([
                        `${actionName} completed`,
                        `result ready`,
                        `${actionName} finished`
                    ]),
                    conditions: []
                });
            }
        }
    });
    console.log(`Identified ${states.size} states`);
    return states;
}
