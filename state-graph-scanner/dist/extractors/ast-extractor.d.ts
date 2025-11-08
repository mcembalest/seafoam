import { EventHandler, StateVariable, APIEndpoint } from '../types.js';
export declare function extractFromJavaScript(code: string, filePath: string): {
    eventHandlers: EventHandler[];
    stateVariables: StateVariable[];
    apiEndpoints: APIEndpoint[];
};
