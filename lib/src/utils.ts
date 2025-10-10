// Notez qu'on peut pas utiliser des charactères (string of length 1) car cela pourrait entrer en conflit avec des regex contenant ces caractères

// expression dans l'automate pour la valeur de transition '.'
export const DOT = "ANYCHAR";

// expression dans l'automate pour la valeur de transition ε (epsilon).
export const EPSILON = "EPSILON";

// Type pour les IDs d'états dans les automates
export type state_ID = number;

/**
 * Type representing a Non-deterministic Finite Automaton (NFA)
 * An NFA can have multiple transitions for the same input symbol from a given state,
 * and can also have epsilon (ε) transitions that don't consume any input.
 *
 * @property {} states - Array of all states in the NFA
 * @property {} transitions - Transition function mapping states and input symbols to arrays of possible next states
 * @property {} start - The initial state of the NFA
 * @property {} accepts - Array of accepting (final) states
 */
export type NFA = {
  states: state_ID[];
  transitions: { [key: state_ID]: { [key: string]: state_ID[] } };
  start: state_ID;
  accepts: state_ID[];
};

/**
 * Type representing a Deterministic Finite Automaton (DFA)
 *
 * @typedef {Object} DFA
 * @property {state_ID[]} states - Array of all states in the DFA
 * @property {{ [key: state_ID]: { [key: string]: state_ID } }} transitions - Transition function mapping states and input symbols to next states
 * @property {state_ID} start - The initial state of the DFA
 * @property {state_ID[]} accepts - Array of accepting (final) states
 */
export type DFA = {
  states: state_ID[];
  transitions: { [key: state_ID]: { [key: string]: state_ID } };
  start: state_ID;
  accepts: state_ID[];
};

/**
 * Calcule la fermeture epsilon d'un ensemble d'états
 * La fermeture epsilon d'un état est l'ensemble de tous les états accessibles
 * depuis cet état en suivant uniquement des transitions epsilon
 *
 * @param nfa le NFA
 * @param states l'ensemble d'états initial
 * @returns l'ensemble d'états accessibles via des transitions epsilon
 */
export function epsilonClosure(nfa: NFA, states: state_ID[]): state_ID[] {
  const closure = new Set<state_ID>(states);
  const stack = [...states];

  while (stack.length > 0) {
    const state = stack.pop()!;
    const epsilonTransitions = nfa.transitions[state]?.[EPSILON] || [];

    for (const nextState of epsilonTransitions) {
      if (!closure.has(nextState)) {
        closure.add(nextState);
        stack.push(nextState);
      }
    }
  }

  return Array.from(closure);
}
