/**
 * Prefilter testing utilities
 */

import {
  canUsePrefilter,
  extractLiterals,
  AhoCorasick,
  type SyntaxTree,
  type Match,
} from "@monorepo/lib";

/**
 * Execute matching with optional prefiltering
 * @param syntaxTree - Parsed syntax tree
 * @param text - Text to search
 * @param matchFn - Function to perform full matching
 * @returns Array of matches
 */
export function matchWithPrefilter<TStructure>(
  syntaxTree: SyntaxTree,
  text: string,
  structure: TStructure,
  matchFn: (structure: TStructure, text: string) => Match[]
): Match[] {
  // Use prefiltering if beneficial
  if (canUsePrefilter(syntaxTree)) {
    const literals = extractLiterals(syntaxTree);
    const ac = new AhoCorasick(literals);

    // Only run full matching if prefilter finds potential matches
    if (ac.contains(text)) {
      return matchFn(structure, text);
    }

    // If prefilter doesn't find anything, return empty array
    return [];
  }

  // No useful prefilter, run matching directly
  return matchFn(structure, text);
}

/**
 * Check if prefiltering is applicable for a pattern
 */
export function shouldUsePrefilter(syntaxTree: SyntaxTree): boolean {
  return canUsePrefilter(syntaxTree);
}
