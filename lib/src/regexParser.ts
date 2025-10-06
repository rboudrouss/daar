import Parser from "./parserLib/parser.ts";
import { str } from "./parserLib/pGen.ts";

export type SyntaxTree =
  | { type: "string"; value: string } // Replaced char with string so that we reconize sequences of non-special characters
  | { type: "dot" }
  | { type: "concat"; left: SyntaxTree; right: SyntaxTree }
  | { type: "alt"; left: SyntaxTree; right: SyntaxTree }
  | { type: "star"; child: SyntaxTree };

// Helper to create a lazy parser (for recursive definitions)
const lazy = <T>(parserThunk: () => Parser<T>): Parser<T> =>
  new Parser((state) => parserThunk().pf(state));

// Check if a character is special
const isSpecialChar = (char: string): boolean => {
  return (
    char === "." || char === "*" || char === "(" || char === ")" || char === "|"
  );
};

// String parser (matches sequence of non-special characters)
const stringParser = new Parser<SyntaxTree>((state) => {
  if (state.isError) return state;
  const { dataView, index } = state;

  if (index >= dataView.byteLength) {
    return state.updateError("Unexpected end of input");
  }

  let value = "";
  let currentIndex = index;

  // Keep reading characters until we hit a special character or end of input
  while (currentIndex < dataView.byteLength) {
    const char = state.getString(currentIndex, 1);
    if (isSpecialChar(char)) break;
    value += char;
    currentIndex++;
  }

  // If we didn't read any characters, return an error
  if (value.length === 0) {
    return state.updateError("Expected a sequence of non-special characters");
  }

  return state
    .updateByteIndex(value.length)
    .updateResult({ type: "string", value });
});

// Dot parser (matches any character)
const dotParser = str(".").map((): SyntaxTree => ({ type: "dot" }));

// Forward declarations for recursive parsers
let atomParser: Parser<SyntaxTree>;
let starParser: Parser<SyntaxTree>;
let concatParser: Parser<SyntaxTree>;
let altParser: Parser<SyntaxTree>;

// Atom parser (string, dot, or group)
atomParser = new Parser((state) => {
  if (state.isError) return state;

  // Try parsing a string of non-special characters
  const stringResult = stringParser.pf(state);
  if (!stringResult.isError) return stringResult;

  // Try parsing a dot
  const dotResult = dotParser.pf(state);
  if (!dotResult.isError) return dotResult;

  // Try parsing a group
  const openResult = str("(").pf(state);
  if (openResult.isError)
    return state.updateError("Expected string, dot, or group");

  const groupResult = altParser.pf(openResult);
  if (groupResult.isError) return groupResult;

  const closeResult = str(")").pf(groupResult);
  if (closeResult.isError)
    return closeResult.updateError("Expected closing parenthesis");

  return closeResult.updateResult(groupResult.result);
});

// Star parser
starParser = new Parser((state) => {
  if (state.isError) return state;

  const atomResult = atomParser.pf(state);
  if (atomResult.isError) return atomResult;

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

// Concat parser
concatParser = new Parser((state) => {
  if (state.isError) return state;

  const firstResult = starParser.pf(state);
  if (firstResult.isError) return firstResult;

  let left = firstResult.result;
  let currentState = firstResult;

  while (!currentState.isError) {
    // Peek next character
    const peek = currentState.getChar(currentState.index);
    if (peek === "" || peek === "|" || peek === ")") break;

    const rightResult = starParser.pf(currentState);
    if (rightResult.isError) break;

    left = { type: "concat", left, right: rightResult.result };
    currentState = rightResult;
  }

  return currentState.updateResult(left);
});

// Alt parser
altParser = new Parser((state) => {
  if (state.isError) return state;

  const firstResult = concatParser.pf(state);
  if (firstResult.isError) return firstResult;

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
