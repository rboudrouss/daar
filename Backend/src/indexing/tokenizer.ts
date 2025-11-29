/**
 * Tokenizer pour l'analyse de texte
 * Transforme le texte brut en termes indexables
 */

import {
  getTokenizerIgnoreStopWords,
  getTokenizerMinWordLength,
  getTokenizerCaseSensitive,
  getTokenizerKeepPositions,
  STOP_WORDS,
} from "../utils/const";

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
      removeStopWords: config.removeStopWords ?? getTokenizerIgnoreStopWords(),
      minWordLength: config.minWordLength ?? getTokenizerMinWordLength(),
      caseSensitive: config.caseSensitive ?? getTokenizerCaseSensitive(),
      keepPositions: config.keepPositions ?? getTokenizerKeepPositions(),
    };
  }

  /**
   * Tokenize un texte en termes (optimisé)
   */
  tokenize(text: string): TokenizationResult {
    const regex = /[a-zà-ÿ0-9]+/gi;
    const words: Array<{ word: string; charPosition: number }> = [];

    // Utiliser matchAll() au lieu de exec() en boucle (plus performant)
    const matches = text.matchAll(regex);

    for (const match of matches) {
      const normalizedWord = this.config.caseSensitive
        ? match[0]
        : match[0].toLowerCase();

      words.push({
        word: normalizedWord,
        charPosition: match.index!,
      });
    }

    // Filtrage et collecte des positions
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
      if (
        getTokenizerIgnoreStopWords() &&
        this.config.removeStopWords &&
        STOP_WORDS.has(word)
      ) {
        continue;
      }

      // Ajouter le terme
      terms.push(word);

      // Enregistrer la position de caractère
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
