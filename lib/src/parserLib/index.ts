/**
 * This code is inspired by my parsers combinator implementation in typescript done for this project:
 * https://github.com/rboudrouss/request_parser/ which itself is a simplier implementation of my friend's library in TS:
 * https://github.com/Speykious/arcsquared wich itself was inspired by the Parsec library in Haskell
 */

import Parser from "./parser.ts";
import ParserState from "./pState.ts";

export * from "./parser.ts";
export * from "./pGen.ts";
export * from "./pComb.ts";
export * from "./pState.ts";
export * from "./utils.ts";

export { Parser, ParserState };

export default Parser;

/**
 * Tuple function (Typescript trick). Use it to have the correct tuple type,
 * especially when using the `sequenceOf` parser.
 *
 * ## Example
 *
 * Normally, the array
 * ```ts
 * ["hello", 42, true]
 * ```
 * would have the type
 * ```ts
 * (string | number | boolean)[]
 * ```
 * but if you write
 * ```ts
 * tup("hello", 42, true)
 * ```
 * instead, then it has the type
 * ```ts
 * [string, number, boolean]
 * ```
 */
export function tup<T extends any[]>(...data: T) {
  return data;
}
