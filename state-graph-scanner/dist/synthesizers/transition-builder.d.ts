import { State, Action, Transition, StateId, ActionId } from '../types.js';
export declare function buildTransitions(states: Map<StateId, State>, actions: Map<ActionId, Action>): Transition[];
