import { parseRegex, nfaFromSyntaxTree, dfaFromNfa, matchDfa } from '@monorepo/lib';

const regex = parseRegex('a(b|c)*d');
const nfa = nfaFromSyntaxTree(regex);
const dfa = dfaFromNfa(nfa);

console.log('Backend: Testing regex matching');
console.log('Pattern: a(b|c)*d');
console.log('Match "abcd":', matchDfa(dfa, 'abcd'));
console.log('Match "acd":', matchDfa(dfa, 'acd'));
console.log('Match "abd":', matchDfa(dfa, 'abd'));