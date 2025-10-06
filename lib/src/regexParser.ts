/**
 * Regular Expression Parser using Parser Combinators
 *
 * This module implements a parser for regular expressions that supports:
 * - Literal strings (e.g., "abc")
 * - Wildcards (dot operator: ".")
 * - Repetition (star operator: "*")
 * - Grouping (parentheses: "()")
 * - Alternation (pipe operator: "|")
 */

import Parser from "./parserLib/parser.ts";
import { str } from "./parserLib/pGen.ts";

//=============================================================================
// Types
//=============================================================================

/**
 * Represents a node in the regular expression syntax tree.
 * Each node represents a different regular expression construct.
 */
export type SyntaxTree =
  | { type: "string"; value: string } // Literal string (e.g., "abc")
  | { type: "dot" } // Wildcard (matches any character)
  | { type: "concat"; left: SyntaxTree; right: SyntaxTree } // Concatenation
  | { type: "alt"; left: SyntaxTree; right: SyntaxTree } // Alternation
  | { type: "star"; child: SyntaxTree }; // Repetition

//=============================================================================
// Helper Functions
//=============================================================================

/**
 * Checks if a character is a special regex operator.
 * Special characters: . * ( ) |
 */
const isSpecialChar = (char: string): boolean => {
  return [".", "*", "(", ")", "|"].includes(char);
};

//=============================================================================
// Basic Parsers
//=============================================================================

/**
 * Parses a sequence of non-special characters as a single string.
 * For example: "abc" is parsed as a single string node.
 */
const stringParser = new Parser<SyntaxTree>((state) => {
  if (state.isError) return state;
  const { dataView, index } = state;

  if (index >= dataView.byteLength) {
    return state.updateError("Unexpected end of input");
  }

  let value = "";
  let currentIndex = index;

  while (currentIndex < dataView.byteLength) {
    const char = state.getString(currentIndex, 1);
    if (isSpecialChar(char)) break;
    value += char;
    currentIndex++;
  }

  if (value.length === 0) {
    return state.updateError("Expected a sequence of non-special characters");
  }

  return state
    .updateByteIndex(value.length)
    .updateResult({ type: "string", value });
});

/**
 * Parses the dot operator (.) which matches any character.
 */
const dotParser = str(".").map((): SyntaxTree => ({ type: "dot" }));

//=============================================================================
// Forward Declarations for Recursive Parsers
//=============================================================================

// These parsers are mutually recursive, so we need to declare them before defining them
let atomParser: Parser<SyntaxTree>; // Parses atomic expressions (strings, dots, groups)
let starParser: Parser<SyntaxTree>; // Parses star repetition
let concatParser: Parser<SyntaxTree>; // Parses concatenation
let altParser: Parser<SyntaxTree>; // Parses alternation

//=============================================================================
// Core Parser Implementation
//=============================================================================

/**
 * Parses atomic expressions: strings, dots, or groups.
 * This is the lowest level of the parsing hierarchy.
 */
atomParser = new Parser((state) => {
  if (state.isError) return state;

  // First try: Parse a literal string
  const stringResult = stringParser.pf(state);
  if (!stringResult.isError) return stringResult;

  // Second try: Parse a dot wildcard
  const dotResult = dotParser.pf(state);
  if (!dotResult.isError) return dotResult;

  // Third try: Parse a grouped expression
  const openResult = str("(").pf(state);
  if (openResult.isError)
    return state.updateError("Expected string, dot, or group");

  // Handle empty group case first
  const peekClose = openResult.getChar(openResult.index);
  if (peekClose === ")") {
    // Empty group - return an empty string node
    return str(")").pf(openResult).updateResult({ type: "string", value: "" });
  }

  // Parse group contents if not empty
  const groupResult = altParser.pf(openResult);
  if (groupResult.isError) return groupResult;

  const closeResult = str(")").pf(groupResult);
  if (closeResult.isError)
    return closeResult.updateError("Expected closing parenthesis");

  return closeResult.updateResult(groupResult.result);
});

/**
 * Parses star repetition: expression followed by zero or more stars.
 * Example: a*, (ab)*, (a|b)*
 */
starParser = new Parser((state) => {
  if (state.isError) return state;

  // First parse the expression to be repeated
  const atomResult = atomParser.pf(state);
  if (atomResult.isError) return atomResult;

  // Then parse any following stars
  let node = atomResult.result;
  let currentState = atomResult;

  while (!currentState.isError) {
    const starResult = str("*").pf(currentState);
    if (starResult.isError) break;
    node = { type: "star", child: node };
    currentState = starResult.updateResult(node);
  }

  return currentState.updateResult(node);
});

/**
 * Parses concatenation: sequence of expressions without operators between them.
 * Example: ab, a*b, (ab)c
 */
concatParser = new Parser((state) => {
  if (state.isError) return state;

  // Parse the first expression
  const firstResult = starParser.pf(state);
  if (firstResult.isError) return firstResult;

  // Keep concatenating while there are more expressions
  let left = firstResult.result;
  let currentState = firstResult;

  while (!currentState.isError) {
    const peek = currentState.getChar(currentState.index);
    // Stop if we hit end, alternation, or group end
    if (peek === "" || peek === "|" || peek === ")") break;

    const rightResult = starParser.pf(currentState);
    if (rightResult.isError) break;

    left = { type: "concat", left, right: rightResult.result };
    currentState = rightResult;
  }

  return currentState.updateResult(left);
});

/**
 * Parses alternation: expressions separated by |.
 * Example: a|b, abc|def, a*|b*
 * Note: this parser is also the highest level and combines all others
 */
altParser = new Parser((state) => {
  if (state.isError) return state;

  // Parse the first alternative
  const firstResult = concatParser.pf(state);
  if (firstResult.isError) return firstResult;

  // Keep adding alternatives while we see pipes
  let left = firstResult.result;
  let currentState = firstResult;

  while (!currentState.isError) {
    const pipeResult = str("|").pf(currentState);
    if (pipeResult.isError) break;

    const rightResult = concatParser.pf(pipeResult);
    if (rightResult.isError) return rightResult;

    left = { type: "alt", left, right: rightResult.result };
    currentState = rightResult;
  }

  return currentState.updateResult(left);
});

// Main regex parser
export function regexParser(): Parser<SyntaxTree> {
  return new Parser((state) => {
    const result = altParser.pf(state);
    if (result.isError) return result;
    if (result.index < result.dataView.byteLength) {
      return result.updateError(
        `Unexpected character at position ${result.index}`
      );
    }
    return result;
  });
}
