import type { AhoCorasick } from "@monorepo/lib";

/**
 * Calculate the size of a structure in KB
 * @param obj - The object to measure
 * @returns Size in KB
 */
export function calculateStructureSize(obj: any): number {
  const str = JSON.stringify(obj);
  return str.length / 1024; // Convert to KB
}

/**
 * Count nodes in a trie structure (for Aho-Corasick)
 * @param ac - The Aho-Corasick instance
 * @returns Number of nodes in the trie
 */
export function countTrieNodes(ac: AhoCorasick): number {
  // Access the private root through type assertion
  const root = (ac as any).root;
  let count = 0;

  function traverse(node: any) {
    count++;
    if (node.children) {
      for (const child of node.children.values()) {
        traverse(child);
      }
    }
  }

  if (root) {
    traverse(root);
  }

  return count;
}

