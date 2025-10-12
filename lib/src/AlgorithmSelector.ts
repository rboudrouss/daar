/**
 * Module de sélection automatique de l'algorithme optimal
 * 
 * Ce module analyse le pattern regex et choisit le meilleur algorithme
 * en fonction de la complexité du pattern et des caractéristiques du matching.
 */

import { SyntaxTree } from "./RegexParser";
import { extractLiterals } from "./LiteralExtractor";

/**
 * Types d'algorithmes disponibles
 */
export type AlgorithmType = "literal-kmp" | "literal-bm" | "nfa" | "dfa" | "min-dfa";

/**
 * Résultat de l'analyse du pattern
 */
export interface PatternAnalysis {
  /** Type de pattern détecté */
  patternType: "literal" | "simple" | "complex";
  
  /** Algorithme recommandé */
  recommendedAlgorithm: AlgorithmType;
  
  /** Raison du choix */
  reason: string;
  
  /** Littéraux extraits (si applicable) */
  literals: string[];
  
  /** Complexité estimée du pattern */
  complexity: number;
  
  /** Le pattern est-il un simple littéral ? */
  isLiteral: boolean;
  
  /** Le pattern contient-il des wildcards ? */
  hasWildcards: boolean;
  
  /** Le pattern contient-il des alternations ? */
  hasAlternations: boolean;
  
  /** Le pattern contient-il des étoiles ? */
  hasStars: boolean;
}

/**
 * Analyse un arbre syntaxique pour déterminer ses caractéristiques
 */
function analyzeTree(tree: SyntaxTree): {
  isLiteral: boolean;
  hasWildcards: boolean;
  hasAlternations: boolean;
  hasStars: boolean;
  complexity: number;
} {
  let isLiteral = true;
  let hasWildcards = false;
  let hasAlternations = false;
  let hasStars = false;
  let complexity = 0;

  function traverse(node: SyntaxTree): void {
    if (node.type === "char") {
      complexity += 1;
    } else if (node.type === "dot") {
      isLiteral = false;
      hasWildcards = true;
      complexity += 2;
    } else if (node.type === "star") {
      isLiteral = false;
      hasStars = true;
      complexity += 5;
      traverse(node.child);
    } else if (node.type === "concat") {
      traverse(node.left);
      traverse(node.right);
    } else if (node.type === "alt") {
      isLiteral = false;
      hasAlternations = true;
      complexity += 3;
      traverse(node.left);
      traverse(node.right);
    }
  }

  traverse(tree);

  return { isLiteral, hasWildcards, hasAlternations, hasStars, complexity };
}

/**
 * Extrait le littéral d'un pattern purement littéral
 */
function extractLiteralString(tree: SyntaxTree): string | null {
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
 * Analyse un pattern et recommande le meilleur algorithme
 * 
 * Stratégie de sélection :
 * 1. Si le pattern est un littéral pur :
 *    - Longueur < 10 : KMP (garantie linéaire, simple)
 *    - Longueur >= 10 : Boyer-Moore (plus rapide en pratique)
 * 
 * 2. Si le pattern est simple (peu de wildcards/alternations) :
 *    - DFA (bon compromis vitesse/mémoire)
 * 
 * 3. Si le pattern est complexe (beaucoup d'alternations/étoiles) :
 *    - NFA (moins de mémoire, acceptable pour patterns complexes)
 *    - Ou min-DFA si on veut optimiser la mémoire du DFA
 * 
 * @param tree L'arbre syntaxique du pattern
 * @returns L'analyse complète avec l'algorithme recommandé
 */
export function analyzePattern(tree: SyntaxTree): PatternAnalysis {
  const { isLiteral, hasWildcards, hasAlternations, hasStars, complexity } = analyzeTree(tree);
  const literals = extractLiterals(tree);

  // Cas 1 : Pattern purement littéral
  if (isLiteral) {
    const literalString = extractLiteralString(tree);
    const length = literalString?.length || 0;

    if (length < 10) {
      return {
        patternType: "literal",
        recommendedAlgorithm: "literal-kmp",
        reason: `Pattern littéral court (${length} chars) - KMP offre une garantie linéaire O(n+m)`,
        literals: literalString ? [literalString] : [],
        complexity,
        isLiteral,
        hasWildcards,
        hasAlternations,
        hasStars,
      };
    } else {
      return {
        patternType: "literal",
        recommendedAlgorithm: "literal-bm",
        reason: `Pattern littéral long (${length} chars) - Boyer-Moore est plus rapide en pratique O(n/m)`,
        literals: literalString ? [literalString] : [],
        complexity,
        isLiteral,
        hasWildcards,
        hasAlternations,
        hasStars,
      };
    }
  }

  // Cas 2 : Pattern simple (peu de complexité)
  if (complexity <= 10 && !hasAlternations) {
    return {
      patternType: "simple",
      recommendedAlgorithm: "dfa",
      reason: `Pattern simple (complexité ${complexity}) - DFA offre un bon compromis vitesse/mémoire`,
      literals,
      complexity,
      isLiteral,
      hasWildcards,
      hasAlternations,
      hasStars,
    };
  }

  // Cas 3 : Pattern avec alternations mais pas trop complexe
  if (hasAlternations && complexity <= 20) {
    return {
      patternType: "simple",
      recommendedAlgorithm: "dfa",
      reason: `Pattern avec alternations (complexité ${complexity}) - DFA gère bien les alternations`,
      literals,
      complexity,
      isLiteral,
      hasWildcards,
      hasAlternations,
      hasStars,
    };
  }

  // Cas 4 : Pattern complexe
  if (complexity > 20) {
    return {
      patternType: "complex",
      recommendedAlgorithm: "nfa",
      reason: `Pattern complexe (complexité ${complexity}) - NFA utilise moins de mémoire`,
      literals,
      complexity,
      isLiteral,
      hasWildcards,
      hasAlternations,
      hasStars,
    };
  }

  // Cas par défaut : DFA
  return {
    patternType: "simple",
    recommendedAlgorithm: "dfa",
    reason: `Pattern standard (complexité ${complexity}) - DFA par défaut`,
    literals,
    complexity,
    isLiteral,
    hasWildcards,
    hasAlternations,
    hasStars,
  };
}

/**
 * TODO Détermine si on devrait minimiser le DFA
 * 
 * La minimisation est utile si :
 * - Le pattern est complexe (beaucoup d'états)
 * - On s'attend à faire beaucoup de matching (amortit le coût de minimisation)
 * 
 * @param analysis L'analyse du pattern
 * @returns true si la minimisation est recommandée
 */
export function shouldMinimizeDfa(analysis: PatternAnalysis): boolean {
  // Minimiser si le pattern est complexe
  return analysis.complexity > 15 && analysis.recommendedAlgorithm === "dfa";
}

/**
 * Obtient une description lisible de l'algorithme
 */
export function getAlgorithmDescription(algorithm: AlgorithmType): string {
  switch (algorithm) {
    case "literal-kmp":
      return "KMP (Knuth-Morris-Pratt) - Recherche littérale avec garantie linéaire";
    case "literal-bm":
      return "Boyer-Moore - Recherche littérale optimisée";
    case "nfa":
      return "NFA (Non-deterministic Finite Automaton) - Faible empreinte mémoire";
    case "dfa":
      return "DFA (Deterministic Finite Automaton) - Matching rapide";
    case "min-dfa":
      return "Minimized DFA - DFA optimisé en mémoire";
    default:
      return "Unknown algorithm";
  }
}

