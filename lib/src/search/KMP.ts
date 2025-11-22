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

/**
 * Vérifie si un motif existe dans un texte avec KMP (version optimisée qui s'arrête au premier match)
 *
 * @param text Le texte dans lequel rechercher
 * @param pattern Le motif à rechercher
 * @returns true si le motif est trouvé, false sinon
 */
export function kmpContains(text: string, pattern: string): boolean {
  const n = text.length,
    m = pattern.length;

  if (m === 0 || m > n) {
    return false;
  }

  const lps = Array(m).fill(0);
  let j = 0;

  // Prétraitement
  for (let i = 1; i < m; i++) {
    while (j > 0 && pattern[i] !== pattern[j]) j = lps[j - 1];
    if (pattern[i] === pattern[j]) j++;
    lps[i] = j;
  }

  // Recherche
  j = 0;
  for (let i = 0; i < n; i++) {
    while (j > 0 && text[i] !== pattern[j]) j = lps[j - 1];
    if (text[i] === pattern[j]) j++;
    if (j === m) {
      return true; // Match trouvé, on s'arrête
    }
  }

  return false;
}
