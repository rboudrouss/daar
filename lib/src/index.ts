import { regexParser } from "./regexParser.ts";

// 1. Parseur ERE (parenthèses, alternative, concaténation, étoile, point, lettre ASCII)
export function parseRegex(pattern: string): SyntaxTree {
  let i = 0;
  function peek() {
    return pattern[i];
  }
  function next() {
    return pattern[i++];
  }

  function parseChar(): SyntaxTree {
    if (peek() === ".") {
      next();
      return { type: "dot" };
    }
    const c = next();
    return { type: "char", value: c };
  }

  function parseStar(): SyntaxTree {
    let node = parseAtom();
    while (peek() === "*") {
      next();
      node = { type: "star", child: node };
    }
    return node;
  }

  function parseAtom(): SyntaxTree {
    if (peek() === "(") {
      next();
      const node = parseAlt();
      if (peek() !== ")") throw new Error("Parenthèse fermante attendue");
      next();
      return node;
    }
    if (peek() === "." || /[a-zA-Z0-9]/.test(peek())) {
      return parseChar();
    }
    throw new Error("Caractère inattendu: " + peek());
  }

  function parseConcat(): SyntaxTree {
    let left = parseStar();
    while (peek() && peek() !== "|" && peek() !== ")") {
      left = { type: "concat", left, right: parseStar() };
    }
    return left;
  }

  function parseAlt(): SyntaxTree {
    let left = parseConcat();
    while (peek() === "|") {
      next();
      left = { type: "alt", left, right: parseConcat() };
    }
    return left;
  }

  const tree = parseAlt();
  if (i < pattern.length) throw new Error("Fin inattendue du motif");
  return tree;
}

// 2. Construction de l'arbre de syntaxe
export type SyntaxTree =
  | { type: "char"; value: string }
  | { type: "dot" }
  | { type: "concat"; left: SyntaxTree; right: SyntaxTree }
  | { type: "alt"; left: SyntaxTree; right: SyntaxTree }
  | { type: "star"; child: SyntaxTree };

// 3. Construction NFA (Aho-Ullman)
export function nfaFromSyntaxTree(tree: SyntaxTree): NFA {
  // Construction NFA récursive (Aho-Ullman)
  let stateId = 0;
  function newState() {
    return stateId++;
  }

  function build(t: SyntaxTree): { start: number; end: number; nfa: NFA } {
    if (t.type === "char") {
      const s = newState(),
        e = newState();
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e],
          transitions: { [s]: { [t.value]: [e] } },
          start: s,
          accepts: [e],
        },
      };
    }
    if (t.type === "dot") {
      const s = newState(),
        e = newState();
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e],
          transitions: { [s]: { ".": [e] } },
          start: s,
          accepts: [e],
        },
      };
    }
    if (t.type === "star") {
      const s = newState(),
        e = newState();
      const child = build(t.child);
      const transitions = {
        [s]: { ε: [child.start, e] },
        [child.end]: { ε: [child.start, e] },
        ...child.nfa.transitions,
      };
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e, ...child.nfa.states],
          transitions,
          start: s,
          accepts: [e],
        },
      };
    }
    if (t.type === "concat") {
      const left = build(t.left);
      const right = build(t.right);
      const transitions = {
        ...left.nfa.transitions,
        ...right.nfa.transitions,
        [left.end]: { ε: [right.start] },
      };
      return {
        start: left.start,
        end: right.end,
        nfa: {
          states: [...left.nfa.states, ...right.nfa.states],
          transitions,
          start: left.start,
          accepts: [right.end],
        },
      };
    }
    if (t.type === "alt") {
      const s = newState(),
        e = newState();
      const left = build(t.left);
      const right = build(t.right);
      const transitions = {
        [s]: { ε: [left.start, right.start] },
        [left.end]: { ε: [e] },
        [right.end]: { ε: [e] },
        ...left.nfa.transitions,
        ...right.nfa.transitions,
      };
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e, ...left.nfa.states, ...right.nfa.states],
          transitions,
          start: s,
          accepts: [e],
        },
      };
    }
    throw new Error("Type de noeud inconnu");
  }
  const result = build(tree);
  return result.nfa;
}

export type NFA = {
  states: number[];
  transitions: { [key: number]: { [key: string]: number[] } };
  start: number;
  accepts: number[];
};

// 4. Transformation NFA -> DFA
export function dfaFromNfa(nfa: NFA): DFA {
  // Subset construction (NFA -> DFA)
  let dfaStates: number[][] = [];
  let dfaTransitions: { [key: number]: { [key: string]: number } } = {};
  let dfaAccepts: number[] = [];
  let stateMap: { [key: string]: number } = {};
  let queue: number[][] = [];
  let nextDfaId = 0;

  function epsilonClosure(states: number[]): number[] {
    let closure = new Set(states);
    let stack = [...states];
    while (stack.length) {
      let s = stack.pop()!;
      let trans = nfa.transitions[s]?.["ε"] || [];
      for (let t of trans) {
        if (!closure.has(t)) {
          closure.add(t);
          stack.push(t);
        }
      }
    }
    return Array.from(closure);
  }

  function getTransitions(states: number[], symbol: string): number[] {
    let result: number[] = [];
    for (let s of states) {
      let trans = nfa.transitions[s]?.[symbol] || [];
      result.push(...trans);
    }
    return epsilonClosure(result);
  }

  let startSet = epsilonClosure([nfa.start]);
  queue.push(startSet);
  stateMap[JSON.stringify(startSet)] = nextDfaId;
  dfaStates.push(startSet);
  nextDfaId++;

  while (queue.length) {
    let current = queue.shift()!;
    let currentId = stateMap[JSON.stringify(current)];
    dfaTransitions[currentId] = {};
    let symbols = new Set<string>();
    for (let s of current) {
      for (let sym in nfa.transitions[s] || {}) {
        if (sym !== "ε") symbols.add(sym);
      }
    }
    for (let sym of symbols) {
      let target = getTransitions(current, sym);
      let key = JSON.stringify(target);
      if (!(key in stateMap)) {
        stateMap[key] = nextDfaId;
        dfaStates.push(target);
        queue.push(target);
        nextDfaId++;
      }
      dfaTransitions[currentId][sym] = stateMap[key];
    }
  }
  for (let i = 0; i < dfaStates.length; i++) {
    if (dfaStates[i].some((s) => nfa.accepts.includes(s))) {
      dfaAccepts.push(i);
    }
  }
  return {
    states: dfaStates.map((_, i) => i),
    transitions: dfaTransitions,
    start: 0,
    accepts: dfaAccepts,
  };
}

export type DFA = {
  states: number[];
  transitions: { [key: number]: { [key: string]: number } };
  start: number;
  accepts: number[];
};

// 5. Minimisation du DFA
export function minimizeDfa(dfa: DFA): DFA {
  // Minimisation de DFA (table de partition)
  const { states, transitions, start, accepts } = dfa;
  let nonAccepts = states.filter((s) => !accepts.includes(s));
  let partitions = [accepts.slice(), nonAccepts.slice()].filter(
    (p) => p.length
  );
  let symbols = new Set<string>();
  for (let s of states) {
    for (let sym in transitions[s] || {}) symbols.add(sym);
  }
  let changed = true;
  while (changed) {
    changed = false;
    let newPartitions: number[][] = [];
    for (let group of partitions) {
      let splits: { [key: string]: number[] } = {};
      for (let s of group) {
        let key = Array.from(symbols)
          .map((sym) => {
            let t = transitions[s]?.[sym];
            let idx = partitions.findIndex((p) => p.includes(t));
            return idx;
          })
          .join(",");
        if (!splits[key]) splits[key] = [];
        splits[key].push(s);
      }
      newPartitions.push(...Object.values(splits));
    }
    if (newPartitions.length !== partitions.length) changed = true;
    partitions = newPartitions;
  }
  let stateMap: { [key: number]: number } = {};
  partitions.forEach((group, idx) => group.forEach((s) => (stateMap[s] = idx)));
  let minTransitions: { [key: number]: { [key: string]: number } } = {};
  for (let idx = 0; idx < partitions.length; idx++) {
    let rep = partitions[idx][0];
    minTransitions[idx] = {};
    for (let sym of symbols) {
      let t = transitions[rep]?.[sym];
      if (t !== undefined) minTransitions[idx][sym] = stateMap[t];
    }
  }
  let minAccepts = partitions
    .map((g, idx) => (g.some((s) => accepts.includes(s)) ? idx : -1))
    .filter((x) => x !== -1);
  let minStart = stateMap[start];
  return {
    states: partitions.map((_, i) => i),
    transitions: minTransitions,
    start: minStart,
    accepts: minAccepts,
  };
}

// 6. Matching DFA
export function matchDfa(dfa: DFA, input: string): boolean {
  // Teste si le DFA accepte l'entrée
  let state = dfa.start;
  for (let c of input) {
    let next = dfa.transitions[state]?.[c] ?? dfa.transitions[state]?.["."];
    if (next === undefined) return false;
    state = next;
  }
  return dfa.accepts.includes(state);
}

// 7. Détection motif simple (concaténation)
export function isSimpleConcat(tree: SyntaxTree): boolean {
  // Détecte si le motif est une concaténation simple de caractères
  if (tree.type === "char" || tree.type === "dot") return true;
  if (tree.type === "concat")
    return isSimpleConcat(tree.left) && isSimpleConcat(tree.right);
  return false;
}

// 8. Algorithme KMP
export function kmpSearch(pattern: string, text: string): number[] {
  // Algorithme KMP classique
  const n = text.length,
    m = pattern.length;
  const lps = Array(m).fill(0);
  let j = 0;
  // Prétraitement
  for (let i = 1; i < m; i++) {
    while (j > 0 && pattern[i] !== pattern[j]) j = lps[j - 1];
    if (pattern[i] === pattern[j]) j++;
    lps[i] = j;
  }
  // Recherche
  const res: number[] = [];
  j = 0;
  for (let i = 0; i < n; i++) {
    while (j > 0 && text[i] !== pattern[j]) j = lps[j - 1];
    if (text[i] === pattern[j]) j++;
    if (j === m) {
      res.push(i - m + 1);
      j = lps[j - 1];
    }
  }
  return res;
}


const parser = regexParser();
const result = parser.run("()a");
console.log(JSON.stringify(result, null, 2));
