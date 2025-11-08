import { ScanResult } from './types.js';
/**
 * Main scanner function - scans an interactive system and produces a state-action graph
 *
 * @param rootDir - Root directory of the application to scan
 * @returns ScanResult containing the state-action graph, execution guide, and metadata
 */
export declare function scan(rootDir: string): Promise<ScanResult>;
