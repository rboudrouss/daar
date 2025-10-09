import { DOT, EPSILON, type state_ID } from "./const.ts";
import { SyntaxTree } from "./RegexParser.ts";

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
  function newState() {
    return stateId++;
  }

  /**
   * Fonction récursive pour construire un NFA à partir d'un arbre syntaxique
   * 
   * @param t le noeud de l'arbre syntaxique
   * @returns un fragment d'NFA avec les états de début et de fin
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
