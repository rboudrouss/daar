import { EPSILON, type state_ID } from "./const.ts";
import { NFA } from "./NFA.ts";

export type DFA = {
  states: state_ID[];
  transitions: { [key: state_ID]: { [key: string]: state_ID } };
  start: state_ID;
  accepts: state_ID[];
};

/**
 * Conversion d'un NFA en un DFA équivalent en utilisant l'algorithme de la clôture ε (epsilon)
 * 
 * @param nfa l'NFA à convertir en DFA
 * @returns le DFA équivalent à l'NFA donné
 */
export function dfaFromNfa(nfa: NFA): DFA {
  let dfaStates: state_ID[][] = [];
  let dfaTransitions: { [key: state_ID]: { [key: string]: state_ID } } = {};
  let dfaAccepts: state_ID[] = [];
  let stateMap: { [key: string]: state_ID } = {};
  let nextDfaId = 0;

  /**
   * @param states les états de l'NFA
   * @returns l'ensemble des états accessibles par des transitions ε (epsilon) à partir de l'ensemble states
   */
  function epsilonClosure(states: state_ID[]): state_ID[] {
    let closure = new Set(states);
    let stack = [...states];
    while (stack.length) {
      let s = stack.pop()!;
      let trans = nfa.transitions[s]?.[EPSILON] || [];
      for (let t of trans) {
        if (!closure.has(t)) {
          closure.add(t);
          stack.push(t);
        }
      }
    }
    return Array.from(closure);
  }

  /**
   * @param states les états de l'NFA
   * @param symbol le symbole de transition
   * @returns tous les états accessibles à partir de states par une transition étiquetée par symbol, suivie de transitions ε (epsilon)
   */
  function getTransitions(states: state_ID[], symbol: string): state_ID[] {
    let result: state_ID[] = [];
    for (let s of states) {
      let trans = nfa.transitions[s]?.[symbol] || [];
      result.push(...trans);
    }
    return epsilonClosure(result);
  }

  /**
   * Fonction récursive pour traiter un ensemble d'états de l'NFA et construire les états et transitions du DFA
   * @param states les états de l'NFA
   * @returns l'ID de l'état du DFA correspondant à cet ensemble d'états de l'NFA
   */
  function processState(states: state_ID[]): state_ID {
    const stateKey = JSON.stringify(states);

    // Return existing state if already processed
    if (stateKey in stateMap) {
      return stateMap[stateKey];
    }

    // Create new state
    const currentId = nextDfaId++;
    stateMap[stateKey] = currentId;
    dfaStates.push(states);
    dfaTransitions[currentId] = {};

    // Find all possible symbols from current states
    let symbols = new Set<string>();
    for (let s of states) {
      for (let sym in nfa.transitions[s] || {}) {
        if (sym !== EPSILON) symbols.add(sym);
      }
    }

    // Recursively process transitions
    for (let sym of symbols) {
      let targetStates = getTransitions(states, sym);
      dfaTransitions[currentId][sym] = processState(targetStates);
    }

    // Check if this is an accepting state
    if (states.some((s) => nfa.accepts.includes(s))) {
      dfaAccepts.push(currentId);
    }

    return currentId;
  }

  // Start the recursive process
  let startSet = epsilonClosure([nfa.start]);
  processState(startSet);

  return {
    states: dfaStates.map((_, i) => i),
    transitions: dfaTransitions,
    start: 0,
    accepts: dfaAccepts,
  };
}

/**
 * Minimisation d'un DFA en utilisant l'algorithme de partitionnement
 * 
 * @param dfa le DFA à minimiser
 * @returns le DFA minimisé
 */
export function minimizeDfa(dfa: DFA): DFA {
  const { states, transitions, start, accepts } = dfa;
  let nonAccepts = states.filter((s) => !accepts.includes(s));
  let partitions = [accepts.slice(), nonAccepts.slice()].filter(
    (p) => p.length
  );
  let symbols = new Set<string>();
  for (let s of states) {
    for (let sym in transitions[s] || {}) symbols.add(sym);
  }
  let changed = true;
  while (changed) {
    changed = false;
    let newPartitions: state_ID[][] = [];
    for (let group of partitions) {
      let splits: { [key: string]: state_ID[] } = {};
      for (let s of group) {
        let key = Array.from(symbols)
          .map((sym) => {
            let t = transitions[s]?.[sym];
            let idx = partitions.findIndex((p) => p.includes(t));
            return idx;
          })
          .join(",");
        if (!splits[key]) splits[key] = [];
        splits[key].push(s);
      }
      newPartitions.push(...Object.values(splits));
    }
    if (newPartitions.length !== partitions.length) changed = true;
    partitions = newPartitions;
  }
  let stateMap: { [key: state_ID]: state_ID } = {};
  partitions.forEach((group, idx) => group.forEach((s) => (stateMap[s] = idx)));
  let minTransitions: { [key: state_ID]: { [key: string]: state_ID } } = {};
  for (let idx = 0; idx < partitions.length; idx++) {
    let rep = partitions[idx][0];
    minTransitions[idx] = {};
    for (let sym of symbols) {
      let t = transitions[rep]?.[sym];
      if (t !== undefined) minTransitions[idx][sym] = stateMap[t];
    }
  }
  let minAccepts = partitions
    .map((g, idx) => (g.some((s) => accepts.includes(s)) ? idx : -1))
    .filter((x) => x !== -1);
  let minStart = stateMap[start];
  return {
    states: partitions.map((_, i) => i),
    transitions: minTransitions,
    start: minStart,
    accepts: minAccepts,
  };
}
