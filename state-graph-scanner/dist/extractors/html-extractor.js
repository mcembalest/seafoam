import * as cheerio from 'cheerio';
export function extractFromHTML(html, filePath) {
    const uiElements = [];
    try {
        const $ = cheerio.load(html);
        // Extract buttons
        $('button').each((_, elem) => {
            const $elem = $(elem);
            uiElements.push({
                selector: buildSelector($elem),
                type: 'button',
                text: $elem.text().trim(),
                attributes: extractAttributes($elem),
                enabledConditions: [],
                visibleConditions: []
            });
        });
        // Extract inputs
        $('input, textarea').each((_, elem) => {
            const $elem = $(elem);
            uiElements.push({
                selector: buildSelector($elem),
                type: 'input',
                text: $elem.attr('placeholder') || $elem.attr('name') || '',
                attributes: extractAttributes($elem),
                enabledConditions: [],
                visibleConditions: []
            });
        });
        // Extract selects
        $('select').each((_, elem) => {
            const $elem = $(elem);
            uiElements.push({
                selector: buildSelector($elem),
                type: 'select',
                text: $elem.attr('name') || '',
                attributes: extractAttributes($elem),
                enabledConditions: [],
                visibleConditions: []
            });
        });
        // Extract forms
        $('form').each((_, elem) => {
            const $elem = $(elem);
            uiElements.push({
                selector: buildSelector($elem),
                type: 'form',
                text: $elem.attr('id') || '',
                attributes: extractAttributes($elem),
                enabledConditions: [],
                visibleConditions: []
            });
        });
        // Extract modals (common patterns)
        $('[class*="modal"], [id*="modal"], [role="dialog"]').each((_, elem) => {
            const $elem = $(elem);
            uiElements.push({
                selector: buildSelector($elem),
                type: 'modal',
                text: $elem.find('h1, h2, h3').first().text().trim() || $elem.attr('id') || '',
                attributes: extractAttributes($elem),
                enabledConditions: [],
                visibleConditions: []
            });
        });
        // Extract links
        $('a').each((_, elem) => {
            const $elem = $(elem);
            const href = $elem.attr('href');
            if (href && !href.startsWith('#')) {
                uiElements.push({
                    selector: buildSelector($elem),
                    type: 'link',
                    text: $elem.text().trim(),
                    attributes: extractAttributes($elem),
                    enabledConditions: [],
                    visibleConditions: []
                });
            }
        });
        // Extract other interactive elements
        $('[onclick], [data-action], [role="button"]').each((_, elem) => {
            const $elem = $(elem);
            const selector = buildSelector($elem);
            // Avoid duplicates
            if (!uiElements.find(e => e.selector === selector)) {
                uiElements.push({
                    selector,
                    type: 'other',
                    text: $elem.text().trim(),
                    attributes: extractAttributes($elem),
                    enabledConditions: [],
                    visibleConditions: []
                });
            }
        });
    }
    catch (error) {
        console.warn(`Failed to parse HTML ${filePath}:`, error);
    }
    return { uiElements };
}
function buildSelector($elem) {
    // Prefer ID
    const id = $elem.attr('id');
    if (id)
        return `#${id}`;
    // Then class
    const classes = $elem.attr('class');
    if (classes) {
        const classList = classes.split(/\s+/).filter(c => c.length > 0);
        if (classList.length > 0) {
            return `.${classList[0]}`;
        }
    }
    // Fall back to name
    const name = $elem.attr('name');
    if (name)
        return `[name="${name}"]`;
    // Fall back to tag + text content
    const tagName = $elem.prop('tagName')?.toLowerCase() || 'unknown';
    const text = $elem.text().trim().substring(0, 20);
    return text ? `${tagName}:contains("${text}")` : tagName;
}
function extractAttributes($elem) {
    const attrs = {};
    const rawAttrs = $elem.attr();
    if (rawAttrs) {
        Object.keys(rawAttrs).forEach(key => {
            attrs[key] = rawAttrs[key] || '';
        });
    }
    return attrs;
}
