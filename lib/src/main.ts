// Test file for lib package
import {
  dfaFromNfa,
  matchDfa,
  minimizeDfa,
  nfaFromSyntaxTree,
  parseRegex,
} from "./index.ts";

let result = parseRegex("a(b|c)*d");
console.log(JSON.stringify(result, null, 2));
let nfa = nfaFromSyntaxTree(result);
console.log(JSON.stringify(nfa, null, 2));
let dfa = dfaFromNfa(nfa);
console.log(JSON.stringify(dfa, null, 2));
let minDfa = minimizeDfa(dfa);
console.log(JSON.stringify(minDfa, null, 2));
console.log(matchDfa(minDfa, "abbd"));
console.log(matchDfa(dfa, "abbd"));
