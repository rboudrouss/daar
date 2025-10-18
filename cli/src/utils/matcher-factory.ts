/**
 * Factory for creating pattern matchers based on algorithm type
 */

import {
  type SyntaxTree,
  type DFA,
  type AlgorithmType,
  nfaFromSyntaxTree,
  dfaFromNfa,
  minimizeDfa,
  findAllMatchesNfa,
  findAllMatchesDfa,
  findAllMatchesLiteralKmp,
  findAllMatchesLiteralBm,
  findAllMatchesNfaWithDfaCache,
  AhoCorasick,
  isAlternationOfLiterals,
} from "@monorepo/lib";
import { MemoryTracker } from "./memory-utils";
import { calculateStructureSize, countTrieNodes } from "./structure-analysis";

export interface MatcherResult {
  matcher: (
    line: string
  ) => Array<{ start: number; end: number; text: string }>;
  nfaTime: number;
  dfaTime?: number;
  minDfaTime?: number;
  structureStats: {
    nfaNodes?: number;
    nfaSize?: number;
    dfaNodes?: number;
    dfaSize?: number;
    minDfaNodes?: number;
    minDfaSize?: number;
    acNodes?: number;
    acSize?: number;
  };
}

export interface MatcherOptions {
  syntaxTree: SyntaxTree;
  algorithm: AlgorithmType;
  pattern: string;
  ignoreCase: boolean;
  memTracker: MemoryTracker;
}

/**
 * Create a matcher function based on the selected algorithm
 */
export function createMatcher(options: MatcherOptions): MatcherResult {
  const { syntaxTree, algorithm, pattern, ignoreCase, memTracker } = options;

  const structureStats: MatcherResult["structureStats"] = {};
  let nfaTime = 0;
  let dfaTime: number | undefined;
  let minDfaTime: number | undefined;

  // Literal search algorithms (KMP, Boyer-Moore)
  if (algorithm === "literal-kmp" || algorithm === "literal-bm") {
    const matcher = createLiteralMatcher(algorithm, pattern, ignoreCase);
    return { matcher, nfaTime: 0, structureStats };
  }

  // Aho-Corasick for multiple literals
  if (algorithm === "aho-corasick") {
    const result = createAhoCorasickMatcher(syntaxTree, ignoreCase);
    structureStats.acNodes = result.acNodes;
    structureStats.acSize = result.acSize;
    return { matcher: result.matcher, nfaTime: 0, structureStats };
  }

  // Automaton-based algorithms (NFA, DFA, min-DFA, NFA-DFA-cache)
  const startNfa = performance.now();
  const nfa = nfaFromSyntaxTree(syntaxTree);
  nfaTime = performance.now() - startNfa;
  memTracker.update();

  structureStats.nfaNodes = nfa.states.length;
  structureStats.nfaSize = calculateStructureSize(nfa);

  // NFA-only or NFA with DFA cache
  if (algorithm === "nfa" || algorithm === "nfa-dfa-cache") {
    const matcher = createNfaMatcher(algorithm, nfa, ignoreCase);
    return { matcher, nfaTime, structureStats };
  }

  // DFA-based algorithms
  const startDfa = performance.now();
  const dfa = dfaFromNfa(nfa);
  dfaTime = performance.now() - startDfa;
  memTracker.update();

  structureStats.dfaNodes = dfa.states.length;
  structureStats.dfaSize = calculateStructureSize(dfa);

  if (algorithm === "dfa") {
    const matcher = createDfaMatcher(dfa, ignoreCase);
    return { matcher, nfaTime, dfaTime, structureStats };
  }

  // Minimized DFA
  if (algorithm === "min-dfa") {
    const startMinDfa = performance.now();
    const minDfa = minimizeDfa(dfa);
    minDfaTime = performance.now() - startMinDfa;
    memTracker.update();

    structureStats.minDfaNodes = minDfa.states.length;
    structureStats.minDfaSize = calculateStructureSize(minDfa);

    const matcher = createDfaMatcher(minDfa, ignoreCase);
    return { matcher, nfaTime, dfaTime, minDfaTime, structureStats };
  }

  throw new Error(`Unsupported algorithm: ${algorithm}`);
}

/**
 * Create a literal matcher (KMP or Boyer-Moore)
 */
function createLiteralMatcher(
  algorithm: "literal-kmp" | "literal-bm",
  pattern: string,
  ignoreCase: boolean
): (line: string) => Array<{ start: number; end: number; text: string }> {
  const matchFn =
    algorithm === "literal-kmp"
      ? findAllMatchesLiteralKmp
      : findAllMatchesLiteralBm;

  return (line: string) => {
    const searchLine = ignoreCase ? line.toLowerCase() : line;
    return matchFn(pattern, searchLine);
  };
}

/**
 * Create an Aho-Corasick matcher for multiple literals
 */
function createAhoCorasickMatcher(
  syntaxTree: SyntaxTree,
  ignoreCase: boolean
): {
  matcher: (
    line: string
  ) => Array<{ start: number; end: number; text: string }>;
  acNodes: number;
  acSize: number;
} {
  const alternationCheck = isAlternationOfLiterals(syntaxTree);

  if (!alternationCheck.isAlternation || !alternationCheck.literals) {
    console.error(
      "Error: Aho-Corasick requires an alternation of literals (e.g., 'from|what|who')"
    );
    process.exit(1);
  }

  const patterns = ignoreCase
    ? alternationCheck.literals.map((l) => l.toLowerCase())
    : alternationCheck.literals;
  const ac = new AhoCorasick(patterns);

  const acNodes = countTrieNodes(ac);
  const acSize = calculateStructureSize(ac);

  const matcher = (line: string) => {
    const searchLine = ignoreCase ? line.toLowerCase() : line;
    const results = ac.search(searchLine);
    return results.map((r) => ({
      start: r.position,
      end: r.position + r.pattern.length,
      text: r.pattern,
    }));
  };

  return { matcher, acNodes, acSize };
}

/**
 * Create an NFA-based matcher
 */
function createNfaMatcher(
  algorithm: "nfa" | "nfa-dfa-cache",
  nfa: any,
  ignoreCase: boolean
): (line: string) => Array<{ start: number; end: number; text: string }> {
  const matchFn =
    algorithm === "nfa-dfa-cache"
      ? findAllMatchesNfaWithDfaCache
      : findAllMatchesNfa;

  return (line: string) => {
    const searchLine = ignoreCase ? line.toLowerCase() : line;
    return matchFn(nfa, searchLine);
  };
}

/**
 * Create a DFA-based matcher
 */
function createDfaMatcher(
  dfa: DFA,
  ignoreCase: boolean
): (line: string) => Array<{ start: number; end: number; text: string }> {
  return (line: string) => {
    const searchLine = ignoreCase ? line.toLowerCase() : line;
    return findAllMatchesDfa(dfa, searchLine);
  };
}
