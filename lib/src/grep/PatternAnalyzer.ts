import { SyntaxTree } from "../search/utils";
import { extractLiterals, isAlternationOfLiterals } from "./LiteralExtractor";

/**
 * Résultat de l'analyse d'un pattern regex pour l'optimisation SQL
 */
export interface SqlPatternAnalysis {
  /** Type de pattern détecté */
  type:
    | "exact" // Littéral exact (ex: "cat")
    | "prefix" // Commence par un littéral (ex: "cat.*")
    | "suffix" // Termine par un littéral (ex: ".*cat")
    | "contains" // Contient des littéraux (ex: ".*cat.*dog.*")
    | "alternation" // Alternation de littéraux (ex: "cat|dog|bird")
    | "complex"; // Pattern complexe nécessitant NFA complet

  /** Littéral exact (pour type "exact") */
  exactLiteral?: string;

  /** Préfixe littéral (pour type "prefix") */
  prefix?: string;

  /** Suffixe littéral (pour type "suffix") */
  suffix?: string;

  /** Littéraux requis (pour type "contains") */
  requiredLiterals?: string[];

  /** Littéraux alternatifs (pour type "alternation") */
  alternationLiterals?: string[];

  /** Longueur minimale possible */
  minLength?: number;

  /** Longueur maximale possible (undefined si illimitée) */
  maxLength?: number;

  /** Longueur exacte (si le pattern a une longueur fixe) */
  exactLength?: number;
}

/**
 * Analyse un pattern regex pour déterminer les optimisations SQL possibles
 *
 * @param tree L'arbre syntaxique du regex
 * @returns L'analyse du pattern
 */
export function analyzeSqlPattern(tree: SyntaxTree): SqlPatternAnalysis {
  // Vérifier si c'est une alternation pure de littéraux
  const alternationCheck = isAlternationOfLiterals(tree);
  if (alternationCheck.isAlternation && alternationCheck.literals) {
    return {
      type: "alternation",
      alternationLiterals: alternationCheck.literals,
    };
  }

  // Vérifier si c'est un littéral pur
  const exactLiteral = extractExactLiteral(tree);
  if (exactLiteral !== null) {
    return {
      type: "exact",
      exactLiteral,
      exactLength: exactLiteral.length,
      minLength: exactLiteral.length,
      maxLength: exactLiteral.length,
    };
  }

  // Extraire le préfixe et le suffixe
  const prefix = extractPrefix(tree);
  const suffix = extractSuffix(tree);

  // Déterminer le type de pattern
  if (prefix && !suffix && hasWildcardAfter(tree)) {
    return {
      type: "prefix",
      prefix,
      minLength: prefix.length,
    };
  }

  if (suffix && !prefix && hasWildcardBefore(tree)) {
    return {
      type: "suffix",
      suffix,
      minLength: suffix.length,
    };
  }

  // Extraire tous les littéraux requis
  const literals = extractLiterals(tree);
  if (literals.length > 0) {
    const lengthInfo = analyzeLengthConstraints(tree);
    return {
      type: "contains",
      requiredLiterals: literals,
      ...lengthInfo,
    };
  }

  // Pattern complexe sans littéraux
  return {
    type: "complex",
  };
}

/**
 * Extrait le littéral exact si le pattern est un littéral pur
 */
function extractExactLiteral(tree: SyntaxTree): string | null {
  let literal = "";

  function traverse(node: SyntaxTree): boolean {
    if (node.type === "char") {
      literal += node.value;
      return true;
    } else if (node.type === "concat") {
      return traverse(node.left) && traverse(node.right);
    }
    return false;
  }

  return traverse(tree) ? literal : null;
}

/**
 * Extrait le préfixe littéral d'un pattern (avant tout wildcard)
 */
function extractPrefix(tree: SyntaxTree): string | null {
  return extractPrefixRecursive(tree);
}

function extractPrefixRecursive(tree: SyntaxTree): string | null {
  if (tree.type === "char") {
    return tree.value;
  } else if (tree.type === "concat") {
    // Essayer d'extraire le préfixe de la partie gauche
    const leftLiteral = extractExactLiteral(tree.left);
    if (leftLiteral !== null) {
      // La partie gauche est entièrement littérale, continuer avec la droite
      const rightPrefix = extractPrefixRecursive(tree.right);
      return rightPrefix !== null ? leftLiteral + rightPrefix : leftLiteral;
    } else {
      // La partie gauche n'est pas entièrement littérale, extraire son préfixe
      return extractPrefixRecursive(tree.left);
    }
  }
  // dot, star, alt ne sont pas des préfixes
  return null;
}

/**
 * Extrait le suffixe littéral d'un pattern (après le dernier wildcard)
 */
function extractSuffix(tree: SyntaxTree): string | null {
  const suffix = extractSuffixRecursive(tree);
  return suffix.length > 0 ? suffix : null;
}

function extractSuffixRecursive(tree: SyntaxTree): string {
  if (tree.type === "char") {
    return tree.value;
  } else if (tree.type === "concat") {
    // Essayer d'abord la partie droite
    const rightSuffix = extractSuffixRecursive(tree.right);
    if (rightSuffix.length > 0) {
      // Vérifier si la partie droite est entièrement littérale
      const rightLiteral = extractExactLiteral(tree.right);
      if (rightLiteral !== null) {
        // La partie droite est littérale, essayer d'ajouter la gauche
        const leftSuffix = extractSuffixRecursive(tree.left);
        return leftSuffix + rightSuffix;
      }
      return rightSuffix;
    }
  }
  return "";
}

/**
 * Vérifie si le pattern a un wildcard après le préfixe
 */
function hasWildcardAfter(tree: SyntaxTree): boolean {
  function check(node: SyntaxTree): boolean {
    if (node.type === "dot" || node.type === "star") {
      return true;
    } else if (node.type === "concat") {
      return check(node.left) || check(node.right);
    } else if (node.type === "alt") {
      return check(node.left) || check(node.right);
    }
    return false;
  }
  return check(tree);
}

/**
 * Vérifie si le pattern a un wildcard avant le suffixe
 */
function hasWildcardBefore(tree: SyntaxTree): boolean {
  function check(node: SyntaxTree): boolean {
    if (node.type === "dot" || node.type === "star") {
      return true;
    } else if (node.type === "concat") {
      return check(node.left);
    } else if (node.type === "alt") {
      return check(node.left) || check(node.right);
    }
    return false;
  }
  return check(tree);
}

/**
 * Analyse les contraintes de longueur d'un pattern
 */
function analyzeLengthConstraints(tree: SyntaxTree): {
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
} {
  const { min, max } = computeLengthBounds(tree);

  if (min === max && min !== Infinity) {
    return {
      exactLength: min,
      minLength: min,
      maxLength: max,
    };
  }

  return {
    minLength: min === Infinity ? undefined : min,
    maxLength: max === Infinity ? undefined : max,
  };
}

/**
 * Calcule les bornes de longueur min/max d'un pattern
 */
function computeLengthBounds(tree: SyntaxTree): { min: number; max: number } {
  if (tree.type === "char") {
    return { min: 1, max: 1 };
  } else if (tree.type === "dot") {
    return { min: 1, max: 1 };
  } else if (tree.type === "star") {
    return { min: 0, max: Infinity };
  } else if (tree.type === "concat") {
    const left = computeLengthBounds(tree.left);
    const right = computeLengthBounds(tree.right);
    return {
      min: left.min + right.min,
      max: left.max === Infinity || right.max === Infinity
        ? Infinity
        : left.max + right.max,
    };
  } else if (tree.type === "alt") {
    const left = computeLengthBounds(tree.left);
    const right = computeLengthBounds(tree.right);
    return {
      min: Math.min(left.min, right.min),
      max: Math.max(left.max, right.max),
    };
  }
  return { min: 0, max: Infinity };
}

