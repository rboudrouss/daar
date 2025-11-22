/**
 * Fuzzy Search - Recherche floue avec Levenshtein distance
 */

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * @param a Première chaîne
 * @param b Deuxième chaîne
 * @returns Distance de Levenshtein
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialisation
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Calcul
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Trouve les termes similaires dans une liste avec une distance maximale
 * @param query Terme recherché
 * @param terms Liste de termes disponibles
 * @param maxDistance Distance maximale (défaut: 2)
 * @returns Termes similaires triés par distance
 */
export function findSimilarTerms(
  query: string,
  terms: string[],
  maxDistance: number = 2
): Array<{ term: string; distance: number }> {
  const results: Array<{ term: string; distance: number }> = [];

  for (const term of terms) {
    const distance = levenshteinDistance(query.toLowerCase(), term.toLowerCase());
    if (distance <= maxDistance) {
      results.push({ term, distance });
    }
  }

  // Trier par distance (les plus proches en premier)
  results.sort((a, b) => a.distance - b.distance);

  return results;
}

/**
 * Classe pour la recherche floue
 */
export class FuzzyMatcher {
  private termCache: Map<string, string[]> = new Map();

  /**
   * Trouve les termes correspondants (exact ou fuzzy)
   * @param query Terme recherché
   * @param availableTerms Termes disponibles dans l'index
   * @param fuzzy Activer la recherche floue
   * @param maxDistance Distance maximale pour fuzzy
   * @returns Liste de termes correspondants
   */
  findMatchingTerms(
    query: string,
    availableTerms: string[],
    fuzzy: boolean = false,
    maxDistance: number = 2
  ): string[] {
    const queryLower = query.toLowerCase();

    // Recherche exacte
    if (!fuzzy) {
      return availableTerms.filter(term => term.toLowerCase() === queryLower);
    }

    // Recherche floue
    const cacheKey = `${queryLower}:${maxDistance}`;
    if (this.termCache.has(cacheKey)) {
      return this.termCache.get(cacheKey)!;
    }

    const similar = findSimilarTerms(queryLower, availableTerms, maxDistance);
    const matchedTerms = similar.map(s => s.term);

    // Cache le résultat
    this.termCache.set(cacheKey, matchedTerms);

    return matchedTerms;
  }

  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.termCache.clear();
  }
}

