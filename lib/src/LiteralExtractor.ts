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
    } else if (node.type === "dot") {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = "";
      }
    } else if (node.type === "star") {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = "";
      }
    } else if (node.type === "concat") {
      traverse(node.left);
      traverse(node.right);
    } else if (node.type === "alt") {
      const leftSegments = extractLiteralSegments(node.left);
      const rightSegments = extractLiteralSegments(node.right);
      let allSegments = leftSegments.concat(rightSegments);

      if (currentSegment.length > 0) {
        allSegments = allSegments.map((s) => currentSegment + s);
        currentSegment = "";
      }
      segments.push(...allSegments);
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
 * @param tree L'arbre syntaxique du regex
 * @returns Un tableau de chaînes littérales à rechercher
 */
export function extractLiterals(tree: SyntaxTree): string[] {
  const segments = extractLiteralSegments(tree);

  // Filtrer les segments vides et dédupliquer
  const uniqueLiterals = Array.from(
    new Set(segments.filter((s) => s.length > 0))
  );

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

/**
 * Vérifie si un noeud de l'arbre syntaxique est un littéral pur (sans wildcards ni étoiles)
 *
 * @param node Le noeud à vérifier
 * @returns true si le noeud est un littéral pur
 */
function isPureLiteral(node: SyntaxTree): boolean {
  if (node.type === "char") {
    return true;
  }
  if (node.type === "concat") {
    return isPureLiteral(node.left) && isPureLiteral(node.right);
  }
  // dot, star, alt ne sont pas des littéraux purs
  return false;
}

/**
 * Extrait tous les littéraux d'une alternation pure (ex: "from|what|who")
 * Retourne null si ce n'est pas une alternation pure de littéraux
 *
 * @param tree L'arbre syntaxique du regex
 * @returns Un tableau de littéraux si c'est une alternation pure, null sinon
 */
function extractAlternationLiterals(tree: SyntaxTree): string[] | null {
  // Cas de base: un seul littéral
  if (isPureLiteral(tree)) {
    let literal = "";
    function extractString(node: SyntaxTree): void {
      if (node.type === "char") {
        literal += node.value;
      } else if (node.type === "concat") {
        extractString(node.left);
        extractString(node.right);
      }
    }
    extractString(tree);
    return [literal];
  }

  // Cas récursif: alternation
  if (tree.type === "alt") {
    const leftLiterals = extractAlternationLiterals(tree.left);
    const rightLiterals = extractAlternationLiterals(tree.right);

    if (leftLiterals !== null && rightLiterals !== null) {
      return [...leftLiterals, ...rightLiterals];
    }
  }

  return null;
}

/**
 * Détermine si le pattern est une alternation pure de littéraux (ex: "from|what|who")
 * et retourne les littéraux si c'est le cas
 *
 * @param tree L'arbre syntaxique du regex
 * @returns Un objet avec isAlternation (boolean) et literals (string[] ou null)
 */
export function isAlternationOfLiterals(tree: SyntaxTree): {
  isAlternation: boolean;
  literals: string[] | null;
} {
  const literals = extractAlternationLiterals(tree);

  if (literals !== null && literals.length > 1) {
    return { isAlternation: true, literals };
  }

  return { isAlternation: false, literals: null };
}
