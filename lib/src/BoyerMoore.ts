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
 */

/**
 * Construit la table des mauvais caractères pour Boyer-Moore
 * Optimisé: utilise un objet plain pour de meilleures performances
 *
 * @param pattern Le motif à rechercher
 * @returns Un objet associant chaque caractère à sa dernière position dans le motif
 */
function buildBadCharTable(pattern: string): { [key: string]: number } {
  const table: { [key: string]: number } = {};
  const m = pattern.length;

  // Pour chaque caractère du motif, on stocke sa dernière position
  for (let i = 0; i < m - 1; i++) {
    table[pattern[i]] = i;
  }

  return table;
}

/**
 * Construit la table des bons suffixes pour Boyer-Moore
 * Cette table indique de combien on peut décaler le motif quand un suffixe correspond
 *
 * @param pattern Le motif à rechercher
 * @returns Un tableau où goodSuffix[i] indique le décalage pour un suffixe de longueur i
 */
function buildGoodSuffixTable(pattern: string): number[] {
  const m = pattern.length;
  const goodSuffix = new Array(m + 1).fill(m);
  const suffixes = computeSuffixes(pattern);

  // Cas 1: Le suffixe apparaît ailleurs dans le motif
  for (let i = 0; i < m; i++) {
    const j = m - suffixes[i];
    if (suffixes[i] === i + 1) {
      for (let k = 0; k < j; k++) {
        if (goodSuffix[k] === m) {
          goodSuffix[k] = j;
        }
      }
    }
  }

  // Cas 2: Une partie du suffixe correspond au début du motif
  for (let i = 0; i < m; i++) {
    goodSuffix[m - suffixes[i]] = m - i - 1;
  }

  return goodSuffix;
}

/**
 * Calcule les longueurs des suffixes du motif
 * suffixes[i] = longueur du plus long suffixe de pattern[0..i] qui est aussi un suffixe de pattern
 *
 * @param pattern Le motif à analyser
 * @returns Un tableau des longueurs de suffixes
 */
function computeSuffixes(pattern: string): number[] {
  const m = pattern.length;
  const suffixes = new Array(m).fill(0);
  suffixes[m - 1] = m;

  let g = m - 1;
  let f = 0;

  for (let i = m - 2; i >= 0; i--) {
    if (i > g && suffixes[i + m - 1 - f] < i - g) {
      suffixes[i] = suffixes[i + m - 1 - f];
    } else {
      if (i < g) {
        g = i;
      }
      f = i;
      while (g >= 0 && pattern[g] === pattern[g + m - 1 - f]) {
        g--;
      }
      suffixes[i] = f - g;
    }
  }

  return suffixes;
}

/**
 * Recherche toutes les occurrences d'un motif dans un texte avec Boyer-Moore
 * Utilise à la fois la bad character rule et la good suffix rule
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
  const goodSuffix = buildGoodSuffixTable(pattern);

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

      // Déplacer le motif: utiliser goodSuffix[0] ou au minimum 1
      s += Math.max(1, goodSuffix[0]);
    } else {
      // Mismatch: utiliser le maximum entre bad character et good suffix
      const badCharShift = j - (badChar[text[s + j]] ?? -1);
      const goodSuffixShift = goodSuffix[j + 1];
      s += Math.max(1, badCharShift, goodSuffixShift);
    }
  }

  return matches;
}

/**
 * Vérifie si un motif existe dans un texte (version optimisée qui s'arrête au premier match)
 * Utilise à la fois la bad character rule et la good suffix rule
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
  const goodSuffix = buildGoodSuffixTable(pattern);

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

    // Mismatch: utiliser le maximum entre bad character et good suffix
    const badCharShift = j - (badChar[text[s + j]] ?? -1);
    const goodSuffixShift = goodSuffix[j + 1];
    s += Math.max(1, badCharShift, goodSuffixShift);
  }

  return false;
}

