/**
 * Prefilter testing utilities
 *
 * Implements line-by-line prefiltering similar to GrepMatcher
 */

import {
  canUsePrefilter,
  extractLiterals,
  hasAlternation,
  AhoCorasick,
  type SyntaxTree,
  type Match,
} from "@monorepo/lib";

/**
 * Structure that holds both the main automaton and optional prefilter
 */
export interface PrefilterStructure<TStructure> {
  structure: TStructure;
  syntaxTree: SyntaxTree;
  prefilter?: AhoCorasick;
  literals: string[];
  isAlternation: boolean; // true if pattern is alternation of literals (use contains), false otherwise (use containsAll)
}

/**
 * Build a prefilter structure (should be done during build phase)
 * @param syntaxTree - Parsed syntax tree
 * @param structure - The main automaton structure
 * @returns Combined structure with optional prefilter
 */
export function buildPrefilterStructure<TStructure>(
  syntaxTree: SyntaxTree,
  structure: TStructure
): PrefilterStructure<TStructure> {
  let prefilter: AhoCorasick | undefined;
  const literals = extractLiterals(syntaxTree);

  // Check if the pattern contains an alternation (even nested, e.g., "\.(com|org|net)")
  // If yes, we should use contains() instead of containsAll()
  const isAlternation = hasAlternation(syntaxTree);

  // Build prefilter if beneficial
  if (canUsePrefilter(syntaxTree) && literals.length > 0) {
    prefilter = new AhoCorasick(literals);
  }

  return {
    structure,
    syntaxTree,
    prefilter,
    literals,
    isAlternation,
  };
}

/**
 * Execute matching with optional prefiltering
 * Uses line-by-line prefiltering to reduce search space, similar to GrepMatcher
 * @param prefilterStructure - Structure with prefilter built
 * @param text - Text to search
 * @param matchFn - Function to perform full matching on a line
 * @returns Array of matches with positions adjusted to original text
 */
export function matchWithPrefilter<TStructure>(
  prefilterStructure: PrefilterStructure<TStructure>,
  text: string,
  matchFn: (structure: TStructure, text: string) => Match[]
): Match[] {
  // Use prefilter if available
  if (prefilterStructure.prefilter) {
    // Split text into lines
    const lines = text.split('\n');
    const allMatches: Match[] = [];
    let currentPos = 0;

    // Process each line with prefiltering
    for (const line of lines) {
      const lineLength = line.length;

      // Choose the appropriate prefilter method based on pattern type:
      // - For alternation patterns (e.g., "cat|dog|bird"), use contains() - ANY literal must be present
      // - For concatenation patterns (e.g., "test.*keyword"), use containsAll() - ALL literals must be present
      const shouldProcess = prefilterStructure.isAlternation
        ? prefilterStructure.prefilter.contains(line)
        : prefilterStructure.prefilter.containsAll(line);

      if (shouldProcess) {
        // Run full matching only on this line
        const matches = matchFn(prefilterStructure.structure, line);

        // Adjust match positions to be relative to the original text
        for (const match of matches) {
          allMatches.push({
            start: match.start + currentPos,
            end: match.end + currentPos,
            text: match.text,
          });
        }
      }

      // Move to next line (+1 for newline character)
      currentPos += lineLength + 1;
    }

    return allMatches;
  }

  // No prefilter, run matching directly on full text
  return matchFn(prefilterStructure.structure, text);
}

/**
 * Check if prefiltering is applicable for a pattern
 */
export function shouldUsePrefilter(syntaxTree: SyntaxTree): boolean {
  return canUsePrefilter(syntaxTree);
}
