import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
// Handle default export for ES modules
const traverse = traverseModule.default || traverseModule;
export function extractFromJavaScript(code, filePath) {
    const eventHandlers = [];
    const stateVariables = [];
    const apiEndpoints = [];
    try {
        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            errorRecovery: true
        });
        traverse(ast, {
            // Find addEventListener calls
            CallExpression(path) {
                extractEventListeners(path, filePath, eventHandlers);
                extractFetchCalls(path, filePath, apiEndpoints);
            },
            // Find state object definitions
            VariableDeclarator(path) {
                extractStateVariables(path, filePath, stateVariables);
            },
            // Find object properties that might be state
            ObjectExpression(path) {
                extractStateFromObjects(path, filePath, stateVariables);
            }
        });
    }
    catch (error) {
        // Silently skip files that can't be parsed
        // HTML extraction will still provide good coverage
    }
    return { eventHandlers, stateVariables, apiEndpoints };
}
function extractEventListeners(path, filePath, handlers) {
    const callee = path.node.callee;
    // querySelector(...).addEventListener(...)
    if (t.isMemberExpression(callee) &&
        t.isIdentifier(callee.property) &&
        callee.property.name === 'addEventListener') {
        const args = path.node.arguments;
        if (args.length >= 2) {
            const eventType = t.isStringLiteral(args[0]) ? args[0].value : 'unknown';
            // Try to extract selector from the object being called
            let selector = 'unknown';
            if (t.isCallExpression(callee.object)) {
                const querySelector = callee.object;
                if (t.isMemberExpression(querySelector.callee) &&
                    querySelector.arguments.length > 0 &&
                    t.isStringLiteral(querySelector.arguments[0])) {
                    selector = querySelector.arguments[0].value;
                }
            }
            handlers.push({
                selector,
                event: eventType,
                handlerLocation: `${filePath}:${path.node.loc?.start.line || 0}`,
                handlerCode: '',
                mutatesState: [],
                callsAPI: []
            });
        }
    }
}
function extractFetchCalls(path, filePath, endpoints) {
    const callee = path.node.callee;
    if (t.isIdentifier(callee) && callee.name === 'fetch') {
        const args = path.node.arguments;
        if (args.length > 0) {
            let url = 'unknown';
            let method = 'GET';
            // Extract URL
            if (t.isStringLiteral(args[0])) {
                url = args[0].value;
            }
            else if (t.isTemplateLiteral(args[0])) {
                url = args[0].quasis.map(q => q.value.raw).join('*');
            }
            // Extract method from options
            if (args.length > 1 && t.isObjectExpression(args[1])) {
                const methodProp = args[1].properties.find(p => t.isObjectProperty(p) &&
                    t.isIdentifier(p.key) &&
                    p.key.name === 'method');
                if (methodProp && t.isObjectProperty(methodProp) && t.isStringLiteral(methodProp.value)) {
                    method = methodProp.value.value;
                }
            }
            endpoints.push({
                method,
                path: url,
                triggeredBy: [],
                location: `${filePath}:${path.node.loc?.start.line || 0}`
            });
        }
    }
}
function extractStateVariables(path, filePath, variables) {
    if (t.isIdentifier(path.node.id) && path.node.init) {
        const name = path.node.id.name;
        // Look for state-like patterns
        if (name.toLowerCase().includes('state') ||
            name.toLowerCase().includes('config') ||
            name.toLowerCase().includes('data')) {
            variables.push({
                name,
                path: name,
                type: path.node.init.type,
                initialValue: extractLiteralValue(path.node.init),
                mutatedBy: [],
                location: `${filePath}:${path.node.loc?.start.line || 0}`
            });
        }
    }
}
function extractStateFromObjects(path, filePath, variables) {
    // Look for state objects defined inline
    path.node.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            const key = prop.key.name;
            variables.push({
                name: key,
                path: key,
                type: prop.value.type,
                initialValue: extractLiteralValue(prop.value),
                mutatedBy: [],
                location: `${filePath}:${path.node.loc?.start.line || 0}`
            });
        }
    });
}
function extractLiteralValue(node) {
    if (t.isStringLiteral(node))
        return node.value;
    if (t.isNumericLiteral(node))
        return node.value;
    if (t.isBooleanLiteral(node))
        return node.value;
    if (t.isNullLiteral(node))
        return null;
    if (t.isArrayExpression(node))
        return [];
    if (t.isObjectExpression(node))
        return {};
    return undefined;
}
