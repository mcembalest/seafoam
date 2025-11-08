import { StateActionGraph } from '../types.js';
/**
 * Enriches the state-action graph with additional semantic labels
 * This is a simple heuristic-based approach. In production, this could use
 * an LLM to generate more natural language descriptions.
 */
export declare function enrichLabels(graph: StateActionGraph): StateActionGraph;
/**
 * Generates natural language descriptions for action sequences
 */
export declare function generatePathDescription(path: Array<{
    stateId: string;
    actionId: string;
}>, graph: StateActionGraph): string[];
