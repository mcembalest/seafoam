/**
 * Core type definitions for state-action graph scanner
 * Framework-agnostic representation of interactive systems
 */

// ============================================================================
// Core Graph Types
// ============================================================================

export type StateId = string;
export type ActionId = string;
export type Label = string;

export interface State {
  id: StateId;
  labels: Set<Label>;
  conditions: Condition[];
  metadata?: {
    sourceLocations?: string[];
    confidence?: number;
  };
}

export interface Action {
  id: ActionId;
  labels: Set<Label>;
  metadata?: {
    trigger?: string;
    sourceLocation?: string;
    confidence?: number;
  };
}

export interface Transition {
  from: StateId;
  via: ActionId;
  to: StateId;
  metadata?: {
    sourceLocation?: string;
    confidence?: number;
  };
}

export interface StateActionGraph {
  states: Map<StateId, State>;
  actions: Map<ActionId, Action>;
  transitions: Transition[];
}

// ============================================================================
// Condition Types
// ============================================================================

export type Condition =
  | { type: 'variable', name: string, operator: ComparisonOp, value: any }
  | { type: 'element_visible', selector: string }
  | { type: 'element_enabled', selector: string }
  | { type: 'modal_open', modalId: string }
  | { type: 'data_present', path: string }
  | { type: 'compound', operator: 'AND' | 'OR', conditions: Condition[] };

export type ComparisonOp = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'exists' | 'empty';

// ============================================================================
// Execution Guide Types
// ============================================================================

export interface ExecutionGuide {
  actionInstructions: Map<ActionId, Instruction[]>;
}

export type Instruction =
  | { type: 'click', selector: string, description: string }
  | { type: 'type', selector: string, value: string, description: string }
  | { type: 'select', selector: string, option: string, description: string }
  | { type: 'drag', from: string, to: string, description: string }
  | { type: 'wait', condition: string, description: string }
  | { type: 'conditional', condition: Condition, then: Instruction[], else: Instruction[] };

// ============================================================================
// Scan Result
// ============================================================================

export interface ScanResult {
  graph: StateActionGraph;
  guide: ExecutionGuide;
  metadata: ScanMetadata;
}

export interface ScanMetadata {
  scannedAt: Date;
  sourceFiles: string[];
  systemType: string;
  confidence: {
    overall: number;
    states: number;
    actions: number;
    transitions: number;
  };
}

// ============================================================================
// Extracted Structure (intermediate representation)
// ============================================================================

export interface ExtractedStructure {
  eventHandlers: EventHandler[];
  stateVariables: StateVariable[];
  uiElements: UIElement[];
  apiEndpoints: APIEndpoint[];
  routes?: Route[];
}

export interface EventHandler {
  selector: string;
  event: string;
  handlerLocation: string;
  handlerCode: string;
  callsAPI?: string[];
  mutatesState?: string[];
  opensModal?: string;
  navigatesTo?: string;
}

export interface StateVariable {
  name: string;
  path: string;
  type: string;
  initialValue: any;
  mutatedBy: string[];
  location: string;
}

export interface UIElement {
  selector: string;
  type: 'button' | 'input' | 'select' | 'modal' | 'form' | 'link' | 'other';
  text?: string;
  attributes: Record<string, string>;
  enabledConditions?: string[];
  visibleConditions?: string[];
}

export interface APIEndpoint {
  method: string;
  path: string;
  triggeredBy: string[];
  params?: string[];
  location: string;
}

export interface Route {
  path: string;
  component?: string;
  location: string;
}

// ============================================================================
// Path Finding Types
// ============================================================================

export interface ActionPath {
  steps: Array<{ state: StateId; action: ActionId }>;
  length: number;
  descriptions: string[];
}

export interface Guidance {
  currentState: StateId;
  goal: StateId;
  nextActions: ActionId[];
  fullPaths: ActionPath[];
  recommendation?: ActionPath;
}
