/**
 * Implémentation de l'algorithme d'Aho-Corasick pour la recherche multi-motifs
 * 
 * Aho-Corasick est un algorithme de recherche de sous-chaînes qui permet de
 * rechercher plusieurs motifs simultanément en un seul passage sur le texte.
 * 
 * Il construit un trie avec des liens de failure qui permettent
 * de passer efficacement d'un motif à un autre lors de la recherche.
 */

interface TrieNode {
  children: Map<string, TrieNode>;
  failure: TrieNode | null;
  output: number[]; // Indices des motifs qui se terminent à ce nœud
}

export class AhoCorasick {
  private root: TrieNode;
  private patterns: string[];

  constructor(patterns: string[]) {
    this.patterns = patterns;
    this.root = this.createNode();
    this.buildTrie();
    this.buildFailureLinks();
  }

  private createNode(): TrieNode {
    return {
      children: new Map(),
      failure: null,
      output: [],
    };
  }

  /**
   * Construit le trie à partir des motifs
   */
  private buildTrie(): void {
    for (let i = 0; i < this.patterns.length; i++) {
      const pattern = this.patterns[i];
      let node = this.root;

      for (const char of pattern) {
        if (!node.children.has(char)) {
          node.children.set(char, this.createNode());
        }
        node = node.children.get(char)!;
      }

      // Marquer ce nœud comme fin d'un motif
      node.output.push(i);
    }
  }

  /**
   * Construit les liens de failure (BFS)
   */
  private buildFailureLinks(): void {
    const queue: TrieNode[] = [];

    // Initialiser les enfants de la racine
    for (const child of this.root.children.values()) {
      child.failure = this.root;
      queue.push(child);
    }

    // BFS pour construire les liens de failure
    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [char, child] of current.children) {
        queue.push(child);

        // Trouver le lien de failure
        let failure = current.failure;

        while (failure !== null && !failure.children.has(char)) {
          failure = failure.failure;
        }

        if (failure === null) {
          child.failure = this.root;
        } else {
          child.failure = failure.children.get(char)!;
          // Hériter des outputs du nœud de failure
          child.output.push(...child.failure.output);
        }
      }
    }
  }

  /**
   * Recherche toutes les occurrences de tous les motifs dans le texte
   * 
   * @param text Le texte dans lequel rechercher
   * @returns Un tableau d'objets {pattern: string, position: number}
   */
  search(text: string): Array<{ pattern: string; position: number }> {
    const results: Array<{ pattern: string; position: number }> = [];
    let node = this.root;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Suivre les liens de failure jusqu'à trouver une transition
      while (node !== this.root && !node.children.has(char)) {
        node = node.failure!;
      }

      if (node.children.has(char)) {
        node = node.children.get(char)!;
      }

      // Vérifier si on a trouvé des motifs
      for (const patternIndex of node.output) {
        const pattern = this.patterns[patternIndex];
        const position = i - pattern.length + 1;
        results.push({ pattern, position });
      }
    }

    return results;
  }

  /**
   * Vérifie si au moins un des motifs existe dans le texte
   * (version optimisée qui s'arrête au premier match)
   * 
   * @param text Le texte dans lequel rechercher
   * @returns true si au moins un motif est trouvé, false sinon
   */
  contains(text: string): boolean {
    let node = this.root;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      while (node !== this.root && !node.children.has(char)) {
        node = node.failure!;
      }

      if (node.children.has(char)) {
        node = node.children.get(char)!;
      }

      if (node.output.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Recherche et retourne le premier motif trouvé
   * 
   * @param text Le texte dans lequel rechercher
   * @returns Le premier motif trouvé, ou null
   */
  findFirst(text: string): { pattern: string; position: number } | null {
    let node = this.root;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      while (node !== this.root && !node.children.has(char)) {
        node = node.failure!;
      }

      if (node.children.has(char)) {
        node = node.children.get(char)!;
      }

      if (node.output.length > 0) {
        const patternIndex = node.output[0];
        const pattern = this.patterns[patternIndex];
        const position = i - pattern.length + 1;
        return { pattern, position };
      }
    }

    return null;
  }
}

