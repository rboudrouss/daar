import Parser from "./parserLib/parser.ts";
import { many, sequence } from "./parserLib/pComb.ts";
import { anyChar, char } from "./parserLib/pGen.ts";

type SyntaxTree = { type: "dot" } | { type: "char"; value: string };

let decoder = new TextDecoder();

export default function regexParser(pattern: string) {
  return many(
    new Parser<SyntaxTree>((state) => {
      if (state.isError) return state;
      const charParser = char(state.peekChar());
      const dotParser = char(".").map(() => ({ type: "dot" } as SyntaxTree));


      return parser.run(state);
    })
  );
}
