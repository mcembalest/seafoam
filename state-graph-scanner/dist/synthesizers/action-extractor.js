export function extractActions(structure) {
    const actions = new Map();
    // Extract actions from event handlers
    structure.eventHandlers.forEach((handler, idx) => {
        const actionId = `action_${handler.event}_${handler.selector.replace(/[#.\[\]"':]/g, '_')}_${idx}`;
        // Find the UI element this handler is attached to
        const uiElement = structure.uiElements.find(e => e.selector === handler.selector);
        const elementText = uiElement?.text || handler.selector;
        const labels = new Set();
        // Generate labels based on event type and element
        if (handler.event === 'click') {
            labels.add(`click ${elementText}`);
            labels.add(`activate ${elementText}`);
            // Add semantic labels based on element text
            if (uiElement) {
                const text = elementText.toLowerCase();
                if (text.includes('save'))
                    labels.add('save');
                if (text.includes('generate'))
                    labels.add('generate');
                if (text.includes('create'))
                    labels.add('create');
                if (text.includes('delete'))
                    labels.add('delete');
                if (text.includes('edit'))
                    labels.add('edit');
                if (text.includes('upload'))
                    labels.add('upload');
                if (text.includes('submit'))
                    labels.add('submit');
                if (text.includes('cancel'))
                    labels.add('cancel');
                if (text.includes('close'))
                    labels.add('close');
                if (text.includes('open'))
                    labels.add('open');
            }
        }
        else if (handler.event === 'submit') {
            labels.add('submit form');
            labels.add(`submit ${elementText}`);
        }
        else if (handler.event === 'change') {
            labels.add(`change ${elementText}`);
            labels.add(`update ${elementText}`);
        }
        else if (handler.event === 'input') {
            labels.add(`input to ${elementText}`);
            labels.add(`type in ${elementText}`);
        }
        // Add API-related labels
        if (handler.callsAPI && handler.callsAPI.length > 0) {
            labels.add('api call');
            handler.callsAPI.forEach(api => labels.add(`call ${api}`));
        }
        // Add modal-related labels
        if (handler.opensModal) {
            labels.add('open modal');
            labels.add(`open ${handler.opensModal}`);
        }
        actions.set(actionId, {
            id: actionId,
            labels,
            metadata: {
                trigger: `${handler.event} ${handler.selector}`,
                sourceLocation: handler.handlerLocation
            }
        });
    });
    // Extract actions from buttons (may not have explicit handlers yet)
    structure.uiElements
        .filter(e => e.type === 'button')
        .forEach(button => {
        const actionId = `action_click_${button.selector.replace(/[#.\[\]"':]/g, '_')}`;
        // Skip if we already have this action from event handlers
        if (actions.has(actionId))
            return;
        const labels = new Set();
        const text = button.text?.toLowerCase() || '';
        labels.add(`click ${button.text || button.selector}`);
        if (text.includes('save'))
            labels.add('save');
        if (text.includes('generate'))
            labels.add('generate');
        if (text.includes('create'))
            labels.add('create');
        if (text.includes('delete'))
            labels.add('delete');
        if (text.includes('edit'))
            labels.add('edit');
        if (text.includes('upload'))
            labels.add('upload');
        if (text.includes('submit'))
            labels.add('submit');
        if (text.includes('cancel'))
            labels.add('cancel');
        if (text.includes('close'))
            labels.add('close');
        actions.set(actionId, {
            id: actionId,
            labels,
            metadata: {
                trigger: `click ${button.selector}`
            }
        });
    });
    // Extract actions from API endpoints
    structure.apiEndpoints.forEach((endpoint, idx) => {
        const actionId = `action_api_${endpoint.method}_${endpoint.path.replace(/[\/:\*]/g, '_')}_${idx}`;
        const labels = new Set();
        labels.add(`${endpoint.method} ${endpoint.path}`);
        labels.add('api request');
        // Infer semantic meaning from endpoint path
        const path = endpoint.path.toLowerCase();
        if (path.includes('save'))
            labels.add('save data');
        if (path.includes('delete'))
            labels.add('delete data');
        if (path.includes('update'))
            labels.add('update data');
        if (path.includes('create'))
            labels.add('create data');
        if (path.includes('get') || endpoint.method === 'GET')
            labels.add('fetch data');
        if (path.includes('compose') || path.includes('generate'))
            labels.add('generate content');
        actions.set(actionId, {
            id: actionId,
            labels,
            metadata: {
                trigger: `${endpoint.method} ${endpoint.path}`,
                sourceLocation: endpoint.location
            }
        });
    });
    // Extract actions from form submissions
    structure.uiElements
        .filter(e => e.type === 'form')
        .forEach(form => {
        const actionId = `action_submit_${form.selector.replace(/[#.\[\]"':]/g, '_')}`;
        actions.set(actionId, {
            id: actionId,
            labels: new Set([
                'submit form',
                `submit ${form.text || form.selector}`,
                'save data'
            ]),
            metadata: {
                trigger: `submit ${form.selector}`
            }
        });
    });
    console.log(`Extracted ${actions.size} actions`);
    return actions;
}
