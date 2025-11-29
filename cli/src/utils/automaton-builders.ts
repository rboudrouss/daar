/**
 * Automaton building utilities for tests
 */

import {
  parseRegex,
  nfaFromSyntaxTree,
  dfaFromNfa,
  minimizeDfa,
  type SyntaxTree,
  type NFA,
  type DFA,
} from "@monorepo/lib";
import { calculateStructureSize } from "../utils/structure-analysis";

export interface AutomatonStructure {
  syntaxTree: SyntaxTree;
  nfa: NFA;
  dfa?: DFA;
  minDfa?: DFA;
}

/**
 * Build NFA from pattern
 */
export function buildNFA(pattern: string): {
  syntaxTree: SyntaxTree;
  nfa: NFA;
} {
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  return { syntaxTree, nfa };
}

/**
 * Build DFA from pattern
 */
export function buildDFA(pattern: string): {
  syntaxTree: SyntaxTree;
  nfa: NFA;
  dfa: DFA;
} {
  const { syntaxTree, nfa } = buildNFA(pattern);
  const dfa = dfaFromNfa(nfa);
  return { syntaxTree, nfa, dfa };
}

/**
 * Build minimized DFA from pattern
 */
export function buildMinDFA(pattern: string): {
  syntaxTree: SyntaxTree;
  nfa: NFA;
  dfa: DFA;
  minDfa: DFA;
} {
  const { syntaxTree, nfa, dfa } = buildDFA(pattern);
  const minDfa = minimizeDfa(dfa);
  return { syntaxTree, nfa, dfa, minDfa };
}

/**
 * Get structure size for NFA
 */
export function getNFAStructureSize(nfa: NFA): { nodes: number; kb: number } {
  return {
    nodes: nfa.states.length,
    kb: calculateStructureSize(nfa),
  };
}

/**
 * Get structure size for DFA
 */
export function getDFAStructureSize(dfa: DFA): { nodes: number; kb: number } {
  return {
    nodes: dfa.states.length,
    kb: calculateStructureSize(dfa),
  };
}
