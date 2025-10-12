import { SyntaxTree } from "./RegexParser";

/**
 * Extrait les segments littéraux d'une concaténation
 * Un segment est une séquence de caractères sans wildcards
 */
function extractLiteralSegments(t: SyntaxTree): string[] {
  const segments: string[] = [];
  let currentSegment = "";

  function traverse(node: SyntaxTree): void {
    if (node.type === "char") {
      currentSegment += node.value;
    } else if (node.type === "dot" || node.type === "star") {
      // Wildcard trouvé: sauvegarder le segment courant et réinitialiser
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = "";
      }
      // Si c'est une étoile, traverser l'enfant
      if (node.type === "star") {
        traverse(node.child);
      }
    } else if (node.type === "concat") {
      // Traverser les deux côtés
      traverse(node.left);
      traverse(node.right);
    } else if (node.type === "alt") {
      // Pour une alternation, on doit traiter chaque branche séparément
      // Sauvegarder le segment courant
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = "";
      }
      // Extraire les segments de chaque branche
      const leftSegments = extractLiteralSegments(node.left);
      const rightSegments = extractLiteralSegments(node.right);
      segments.push(...leftSegments, ...rightSegments);
    }
  }

  traverse(t);

  // Sauvegarder le dernier segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Extrait les littéraux d'un arbre syntaxique de regex pour le préfiltrage
 *
 * Cette fonction analyse l'arbre syntaxique et extrait les chaînes littérales
 * qui DOIVENT apparaître dans toute correspondance. Ces littéraux peuvent être
 * utilisés pour un préfiltrage rapide avec Boyer-Moore ou Aho-Corasick.
 *
 * Stratégie:
 * - Extrait les segments de caractères consécutifs
 * - Ignore les wildcards (. et .*)
 * - Pour les alternations, extrait les littéraux de chaque branche
 *
 * @param tree L'arbre syntaxique du regex
 * @returns Un tableau de chaînes littérales à rechercher
 */
export function extractLiterals(tree: SyntaxTree): string[] {
  const segments = extractLiteralSegments(tree);

  // Filtrer les segments vides et dédupliquer
  const uniqueLiterals = Array.from(new Set(segments.filter((s) => s.length > 0)));

  // Trier par longueur décroissante (les plus longs d'abord pour un meilleur préfiltrage)
  return uniqueLiterals.sort((a, b) => b.length - a.length);
}



/**
 * Détermine si un regex peut bénéficier d'un préfiltrage
 * 
 * @param tree L'arbre syntaxique du regex
 * @returns true si le préfiltrage est utile
 */
export function canUsePrefilter(tree: SyntaxTree): boolean {
  const literals = extractLiterals(tree);
  
  // Le préfiltrage est utile si on a au moins un littéral de longueur >= 2
  return literals.length > 0 && literals[0].length >= 2;
}

