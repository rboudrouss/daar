// Test file for lib package
import {
  dfaFromNfa,
  matchDfa,
  minimizeDfa,
  nfaFromSyntaxTree,
  parseRegex,
} from ".";

let result = parseRegex("(.*)(abc)(.*)");
console.log(JSON.stringify(result, null, 2));
let nfa = nfaFromSyntaxTree(result);
console.log(JSON.stringify(nfa, null, 2));
let dfa = dfaFromNfa(nfa);
console.log(JSON.stringify(dfa, null, 2));
let minDfa = minimizeDfa(dfa);
console.log(JSON.stringify(minDfa, null, 2));
let s = "jdioaabczd";
console.log(matchDfa(minDfa, s));
console.log(matchDfa(dfa, s));
