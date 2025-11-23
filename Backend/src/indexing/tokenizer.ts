/**
 * Tokenizer pour l'analyse de texte
 * Transforme le texte brut en termes indexables
 */

import { TOKENIZER_IGNORE_STOP_WORDS, TOKENIZER_MIN_WORD_LENGTH, TOKENIZER_CASE_SENSITIVE, TOKENIZER_KEEP_POSITIONS, STOP_WORDS } from "../utils/const";

/**
 * Configuration du tokenizer
 */
export interface TokenizerConfig {
  removeStopWords: boolean;
  minWordLength: number;
  caseSensitive: boolean;
  keepPositions: boolean;
}

/**
 * Résultat de la tokenization
 */
export interface TokenizationResult {
  terms: string[];
  positions?: Map<string, number[]>; // terme -> positions
  totalTokens: number;
}

/**
 * Tokenizer par défaut
 */
export class Tokenizer {
  private config: TokenizerConfig;

  constructor(config: Partial<TokenizerConfig> = {}) {
    this.config = {
      removeStopWords: config.removeStopWords ?? TOKENIZER_IGNORE_STOP_WORDS,
      minWordLength: config.minWordLength ?? TOKENIZER_MIN_WORD_LENGTH,
      caseSensitive: config.caseSensitive ?? TOKENIZER_CASE_SENSITIVE,
      keepPositions: config.keepPositions ?? TOKENIZER_KEEP_POSITIONS,
    };
  }

  /**
   * Tokenize un texte en termes
   */
  tokenize(text: string): TokenizationResult {
    // 1. Découpage en mots avec leurs positions de caractères dans le texte ORIGINAL
    const regex = /[a-zà-ÿ0-9]+/gi;
    const words: Array<{ word: string; charPosition: number }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Normaliser le mot (pas le texte entier) pour l'indexation
      const normalizedWord = this.config.caseSensitive
        ? match[0]
        : match[0].toLowerCase();

      words.push({
        word: normalizedWord,
        charPosition: match.index, // Position du caractère dans le texte ORIGINAL
      });
    }

    // 3. Filtrage et collecte des positions
    const terms: string[] = [];
    const positions = this.config.keepPositions
      ? new Map<string, number[]>()
      : undefined;

    for (const { word, charPosition } of words) {
      // Filtrer par longueur minimale
      if (word.length < this.config.minWordLength) {
        continue;
      }

      // Filtrer les stop words
      if (TOKENIZER_IGNORE_STOP_WORDS && this.config.removeStopWords && STOP_WORDS.has(word)) {
        continue;
      }

      // Ajouter le terme
      terms.push(word);

      // Enregistrer la position de caractère (pas l'index de token)
      if (positions) {
        if (!positions.has(word)) {
          positions.set(word, []);
        }
        positions.get(word)!.push(charPosition);
      }
    }

    return {
      terms,
      positions,
      totalTokens: words.length,
    };
  }

  /**
   * Tokenize une requête (même logique mais peut être différente)
   */
  tokenizeQuery(query: string): string[] {
    // Pour les requêtes, on peut être moins strict
    const normalized = this.config.caseSensitive ? query : query.toLowerCase();
    const words = normalized.match(/[a-zà-ÿ0-9]+/gi) || [];

    return words.filter((word) => {
      // Pas de filtre de longueur minimale pour les requêtes
      // Pas de stop words pour les requêtes (l'utilisateur sait ce qu'il cherche)
      return word.length > 0;
    });
  }

  /**
   * Compte les occurrences de chaque terme
   */
  countTerms(terms: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const term of terms) {
      counts.set(term, (counts.get(term) || 0) + 1);
    }
    return counts;
  }
}

/**
 * Instance par défaut du tokenizer
 */
export const defaultTokenizer = new Tokenizer();
