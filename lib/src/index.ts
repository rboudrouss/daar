import type { SyntaxTree } from "./RegexParser";

export function isSimpleConcat(tree: SyntaxTree): boolean {
  if (tree.type === "char" || tree.type === "dot") return true;
  if (tree.type === "concat")
    return isSimpleConcat(tree.left) && isSimpleConcat(tree.right);
  return false;
}

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

export * from "./utils";
export * from "./RegexParser";
export * from "./NFA";
export * from "./DFA";
