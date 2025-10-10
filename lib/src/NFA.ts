import { DOT, EPSILON, type state_ID } from "./const";
import { SyntaxTree } from "./RegexParser";

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
 * Construction d'un NFA à partir d'un arbre syntaxique représentant une expression régulière
 * 
 * @param tree l'arbre syntaxique représentant l'expression régulière
 * @returns un NFA construit à partir de l'arbre syntaxique
 */
export function nfaFromSyntaxTree(tree: SyntaxTree): NFA {
  let stateId = 0;
  /**
   * Génère un nouvel identifiant d'état unique
   * @returns Un nouvel identifiant d'état unique
   */
  function newState() {
    return stateId++;
  }

  /**
   * Construit récursivement un NFA à partir d'un nœud de l'arbre syntaxique
   * Cette fonction implémente les constructions de Thompson pour chaque opérateur
   * 
   * @param t - Le nœud de l'arbre syntaxique à traiter
   * @returns Un objet contenant :
   *          - start: l'état initial du fragment
   *          - end: l'état final du fragment
   *          - nfa: le fragment d'NFA construit
   * @throws {Error} Si le type de nœud n'est pas reconnu
   */
  function build(t: SyntaxTree): { start: state_ID; end: state_ID; nfa: NFA } {
    if (t.type === "char") {
      const s = newState(),
        e = newState();
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e],
          transitions: { [s]: { [t.value || EPSILON]: [e] } }, // Handle empty char as EPSILON
          start: s,
          accepts: [e],
        },
      };
    }
    if (t.type === "dot") {
      const s = newState(),
        e = newState();
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e],
          transitions: { [s]: { [DOT]: [e] } },
          start: s,
          accepts: [e],
        },
      };
    }
    if (t.type === "star") {
      const s = newState(),
        e = newState();
      const child = build(t.child);
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e, ...child.nfa.states],
          transitions: {
            [s]: { [EPSILON]: [child.start, e] },
            [child.end]: { [EPSILON]: [child.start, e] },
            ...child.nfa.transitions,
          },
          start: s,
          accepts: [e],
        },
      };
    }
    if (t.type === "concat") {
      const left = build(t.left);
      const right = build(t.right);
      return {
        start: left.start,
        end: right.end,
        nfa: {
          states: [...left.nfa.states, ...right.nfa.states],
          transitions: {
            ...left.nfa.transitions,
            ...right.nfa.transitions,
            [left.end]: { [EPSILON]: [right.start] },
          },
          start: left.start,
          accepts: [right.end],
        },
      };
    }
    if (t.type === "alt") {
      const s = newState(),
        e = newState();
      const left = build(t.left);
      const right = build(t.right);
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e, ...left.nfa.states, ...right.nfa.states],
          transitions: {
            [s]: { [EPSILON]: [left.start, right.start] },
            [left.end]: { [EPSILON]: [e] },
            [right.end]: { [EPSILON]: [e] },
            ...left.nfa.transitions,
            ...right.nfa.transitions,
          },
          start: s,
          accepts: [e],
        },
      };
    }
    throw new Error("Type de noeud inconnu");
  }
  const result = build(tree);
  return result.nfa;
}

/**
 * Calcule la fermeture epsilon d'un ensemble d'états
 * La fermeture epsilon d'un état est l'ensemble de tous les états accessibles
 * depuis cet état en suivant uniquement des transitions epsilon
 *
 * @param nfa le NFA
 * @param states l'ensemble d'états initial
 * @returns l'ensemble d'états accessibles via des transitions epsilon
 */
function epsilonClosure(nfa: NFA, states: state_ID[]): state_ID[] {
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

/**
 * Vérifie si une chaîne de caractères correspond à un motif donné représenté par un NFA
 *
 * @param nfa le NFA représentant le motif
 * @param input la chaîne de caractères à vérifier
 * @returns true si la chaîne correspond au motif représenté par le NFA, sinon false
 */
export function matchNfa(nfa: NFA, input: string): boolean {
  // Commencer avec la fermeture epsilon de l'état initial
  let states = epsilonClosure(nfa, [nfa.start]);

  for (let c of input) {
    let nextStates: state_ID[] = [];

    for (let s of states) {
      // Transitions pour le caractère exact
      const charTransitions = nfa.transitions[s]?.[c] || [];
      nextStates.push(...charTransitions);

      // Transitions pour DOT (correspond à n'importe quel caractère)
      const dotTransitions = nfa.transitions[s]?.[DOT] || [];
      nextStates.push(...dotTransitions);
    }

    // Appliquer la fermeture epsilon après chaque transition
    states = epsilonClosure(nfa, nextStates);

    // Si aucun état n'est accessible, la correspondance échoue
    if (states.length === 0) {
      return false;
    }
  }

  // Vérifier si au moins un des états finaux est un état acceptant
  return states.some((s) => nfa.accepts.includes(s));
}
