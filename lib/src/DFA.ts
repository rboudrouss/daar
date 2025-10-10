import {
  EPSILON,
  type NFA,
  type DFA,
  type state_ID,
  epsilonClosure,
  DOT,
} from "./utils";

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
   * @param symbol le symbole de transition
   * @returns tous les états accessibles à partir de states par une transition étiquetée par symbol, suivie de transitions ε (epsilon)
   *
   * Note: Si le symbole n'est pas DOT, cette fonction considère également les transitions DOT
   * car DOT peut matcher n'importe quel caractère, y compris le symbole spécifique.
   */
  function getTransitions(states: state_ID[], symbol: string): state_ID[] {
    let result: state_ID[] = [];
    for (let s of states) {
      // Transitions pour le symbole spécifique
      let trans = nfa.transitions[s]?.[symbol] || [];
      result.push(...trans);

      // Si le symbole n'est pas DOT lui-même, ajouter aussi les transitions DOT
      // car DOT peut matcher n'importe quel caractère, y compris ce symbole
      if (symbol !== DOT) {
        let dotTrans = nfa.transitions[s]?.[DOT] || [];
        result.push(...dotTrans);
      }
    }
    return epsilonClosure(nfa, result);
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
        if (sym !== EPSILON) {
          symbols.add(sym);
        }
      }
    }

    // Recursively process transitions
    for (let sym of symbols) {
      let targetStates = getTransitions(states, sym);
      if (targetStates.length > 0) {
        dfaTransitions[currentId][sym] = processState(targetStates);
      }
    }

    // Check if this is an accepting state
    if (states.some((s) => nfa.accepts.includes(s))) {
      dfaAccepts.push(currentId);
    }

    return currentId;
  }

  // Start the recursive process
  let startSet = epsilonClosure(nfa, [nfa.start]);
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

  /**
   * @returns l'ensemble des symboles utilisés dans les transitions du DFA
   */
  function getSymbols(): Set<string> {
    const symbols = new Set<string>();
    for (let s of states) {
      for (let sym in transitions[s] || {}) {
        symbols.add(sym);
      }
    }
    return symbols;
  }

  /**
   * Calcule la signature d'un état basée sur ses transitions
   * Une signature représente le comportement de l'état en fonction de ses transitions.
   * Deux états ayant la même signature sont potentiellement équivalents.
   *
   * @param state - L'état dont on veut obtenir la signature
   * @param partitions - Les partitions actuelles des états
   * @param symbols - L'ensemble des symboles de l'alphabet
   * @returns Une chaîne représentant les groupes cibles pour chaque symbole.
   *          Cette signature est utilisée pour identifier les états équivalents lors de la minimisation du DFA.
   *          Chaque symbole est mappé à l'index du groupe dans lequel se trouve l'état cible.
   */
  function getStateSignature(
    state: state_ID,
    partitions: state_ID[][],
    symbols: Set<string>
  ): string {
    return Array.from(symbols)
      .map((sym) => {
        const targetState = transitions[state]?.[sym];
        return partitions.findIndex((p) => p.includes(targetState));
      })
      .join(",");
  }

  /**
   * Raffine un groupe d'états en sous-groupes basés sur leurs signatures de transition
   *
   * @param group - Le groupe d'états à raffiner
   * @param partitions - Les partitions actuelles des états
   * @param symbols - L'ensemble des symboles de l'alphabet
   * @returns Un tableau de nouveaux groupes d'états, chacun contenant des états avec des signatures identiques
   */
  function refineGroup(
    group: state_ID[],
    partitions: state_ID[][],
    symbols: Set<string>
  ): state_ID[][] {
    const splits: { [key: string]: state_ID[] } = {};

    for (const state of group) {
      const signature = getStateSignature(state, partitions, symbols);
      if (!splits[signature]) splits[signature] = [];
      splits[signature].push(state);
    }

    return Object.values(splits);
  }

  /**
   * Raffine récursivement les partitions jusqu'à ce qu'aucun raffinement supplémentaire ne soit possible
   * Cette fonction implémente l'étape clé de l'algorithme de minimisation de Hopcroft
   *
   * @param currentPartitions - Les partitions actuelles des états
   * @param symbols - L'ensemble des symboles de l'alphabet
   * @returns Les partitions finales où tous les états dans une même partition sont équivalents
   */
  function refinePartitions(
    currentPartitions: state_ID[][],
    symbols: Set<string>
  ): state_ID[][] {
    let newPartitions: state_ID[][] = [];
    let changed = false;

    for (const group of currentPartitions) {
      const refinedGroups = refineGroup(group, currentPartitions, symbols);
      newPartitions.push(...refinedGroups);
      if (refinedGroups.length > 1) changed = true;
    }

    return changed ? refinePartitions(newPartitions, symbols) : newPartitions;
  }

  /**
   * Construit le DFA minimisé à partir des partitions finales
   * Chaque partition devient un état dans le DFA minimisé
   *
   * @param partitions - Les partitions finales des états équivalents
   * @returns Le DFA minimisé où chaque état représente une classe d'équivalence des états originaux
   */
  function buildMinimizedDfa(partitions: state_ID[][]): DFA {
    const stateMap: { [key: state_ID]: state_ID } = {};
    partitions.forEach((group, idx) =>
      group.forEach((s) => (stateMap[s] = idx))
    );

    const minTransitions: { [key: state_ID]: { [key: string]: state_ID } } = {};
    const symbols = getSymbols();

    for (let idx = 0; idx < partitions.length; idx++) {
      const rep = partitions[idx][0];
      minTransitions[idx] = {};
      for (const sym of symbols) {
        const target = transitions[rep]?.[sym];
        if (target !== undefined) {
          minTransitions[idx][sym] = stateMap[target];
        }
      }
    }

    return {
      states: partitions.map((_, i) => i),
      transitions: minTransitions,
      start: stateMap[start],
      accepts: partitions
        .map((g, idx) => (g.some((s) => accepts.includes(s)) ? idx : -1))
        .filter((x) => x !== -1),
    };
  }

  // Initialisation des partitions avec états acceptants et non-acceptants
  const nonAccepts = states.filter((s) => !accepts.includes(s));
  const initialPartitions = [accepts.slice(), nonAccepts].filter(
    (p) => p.length
  );
  const symbols = getSymbols();

  // Lancement du processus de minimisation
  const finalPartitions = refinePartitions(initialPartitions, symbols);

  return buildMinimizedDfa(finalPartitions);
}


/**
 * 
 * @param dfa 
 * @param input 
 * @returns 
 */
export function matchDfa(dfa: DFA, input: string): boolean {
  let state = dfa.start;
  for (let c of input) {
    let next = dfa.transitions[state]?.[c] ?? dfa.transitions[state]?.[DOT];
    if (next === undefined) return false;
    state = next;
    // Si on est dans un état acceptant et qu'on a une transition DOT vers lui-même, on accepte immédiatement
    if (dfa.accepts.includes(state) && dfa.transitions[state]?.[DOT] === state) {
      return true;
    } 
  }
  return dfa.accepts.includes(state);
}