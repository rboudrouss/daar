/**
 * Implémentation de l'algorithme de Boyer-Moore pour la recherche de motifs
 * 
 * Boyer-Moore est un algorithme de recherche de sous-chaîne très efficace qui:
 * - Parcourt le texte de gauche à droite
 * - Compare le motif de droite à gauche
 * - Utilise deux heuristiques pour sauter des positions:
 *   1. Bad character rule: saute en fonction du caractère qui ne correspond pas
 *   2. Good suffix rule: saute en fonction du suffixe qui correspond
 * 
 * Pour simplifier, on implémente seulement la bad character rule
 */

/**
 * Construit la table des mauvais caractères pour Boyer-Moore
 * 
 * @param pattern Le motif à rechercher
 * @returns Une Map associant chaque caractère à sa dernière position dans le motif
 */
function buildBadCharTable(pattern: string): Map<string, number> {
  const table = new Map<string, number>();
  const m = pattern.length;

  // Pour chaque caractère du motif, on stocke sa dernière position
  for (let i = 0; i < m - 1; i++) {
    table.set(pattern[i], i);
  }

  return table;
}

/**
 * Recherche toutes les occurrences d'un motif dans un texte avec Boyer-Moore
 * 
 * @param text Le texte dans lequel rechercher
 * @param pattern Le motif à rechercher
 * @returns Un tableau des positions de début de chaque occurrence
 */
export function boyerMooreSearch(text: string, pattern: string): number[] {
  const n = text.length;
  const m = pattern.length;
  const matches: number[] = [];

  if (m === 0 || m > n) {
    return matches;
  }

  const badChar = buildBadCharTable(pattern);

  let s = 0; // Position de départ dans le texte

  while (s <= n - m) {
    let j = m - 1;

    // Comparer le motif de droite à gauche
    while (j >= 0 && pattern[j] === text[s + j]) {
      j--;
    }

    if (j < 0) {
      // Match trouvé
      matches.push(s);

      // Déplacer le motif pour chercher la prochaine occurrence
      s += m;
    } else {
      // Mismatch: utiliser la bad character rule
      const badCharPos = badChar.get(text[s + j]) ?? -1;
      s += Math.max(1, j - badCharPos);
    }
  }

  return matches;
}

/**
 * Vérifie si un motif existe dans un texte (version optimisée qui s'arrête au premier match)
 * 
 * @param text Le texte dans lequel rechercher
 * @param pattern Le motif à rechercher
 * @returns true si le motif est trouvé, false sinon
 */
export function boyerMooreContains(text: string, pattern: string): boolean {
  const n = text.length;
  const m = pattern.length;

  if (m === 0 || m > n) {
    return false;
  }

  const badChar = buildBadCharTable(pattern);

  let s = 0;

  while (s <= n - m) {
    let j = m - 1;

    while (j >= 0 && pattern[j] === text[s + j]) {
      j--;
    }

    if (j < 0) {
      // Match trouvé
      return true;
    }

    const badCharPos = badChar.get(text[s + j]) ?? -1;
    s += Math.max(1, j - badCharPos);
  }

  return false;
}

