/**
 * Validation utilities for CLI options
 */

export type OptimizationLevel =
  | "auto"
  | "literal-kmp"
  | "literal-bm"
  | "aho-corasick"
  | "nfa"
  | "nfa-dfa-cache"
  | "dfa"
  | "min-dfa";

const VALID_OPTIMIZATION_LEVELS: OptimizationLevel[] = [
  "auto",
  "literal-kmp",
  "literal-bm",
  "aho-corasick",
  "nfa",
  "nfa-dfa-cache",
  "dfa",
  "min-dfa",
];

/**
 * Validate optimization level
 * @param level - The optimization level to validate
 * @returns True if valid, false otherwise
 */
export function isValidOptimizationLevel(level: string): level is OptimizationLevel {
  return VALID_OPTIMIZATION_LEVELS.includes(level as OptimizationLevel);
}

/**
 * Get error message for invalid optimization level
 * @param level - The invalid optimization level
 * @returns Error message
 */
export function getOptimizationLevelError(level: string): string {
  return `Invalid optimization level: ${level}\nValid options are: ${VALID_OPTIMIZATION_LEVELS.join(", ")}`;
}

