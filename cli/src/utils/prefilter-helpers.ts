/**
 * Prefilter testing utilities
 *
 * Implements line-by-line prefiltering similar to GrepMatcher
 */

import {
  canUsePrefilter,
  extractLiterals,
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

  // Build prefilter if beneficial
  if (canUsePrefilter(syntaxTree) && literals.length > 0) {
    prefilter = new AhoCorasick(literals);
  }

  return {
    structure,
    syntaxTree,
    prefilter,
    literals,
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

      // Check if this line contains ALL the prefilter literals (using containsAll like GrepMatcher)
      // This is important for patterns like "test.*keyword" where both literals must be present
      if (prefilterStructure.prefilter.containsAll(line)) {
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
