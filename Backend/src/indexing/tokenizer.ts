/**
 * Tokenizer pour l'analyse de texte
 * Transforme le texte brut en termes indexables
 */

import { TOKENIZER_IGNORE_STOP_WORDS, TOKENIZER_MIN_WORD_LENGTH, TOKENIZER_CASE_SENSITIVE, TOKENIZER_KEEP_POSITIONS } from "../utils/const";

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
    // 1. Normalisation : lowercase si nécessaire
    let normalized = this.config.caseSensitive ? text : text.toLowerCase();

    // 2. Découpage en mots (split sur espaces et ponctuation)
    // Garde les lettres, chiffres, et quelques caractères spéciaux
    const words = normalized.match(/[a-zà-ÿ0-9]+/gi) || [];

    // 3. Filtrage et collecte des positions
    const terms: string[] = [];
    const positions = this.config.keepPositions
      ? new Map<string, number[]>()
      : undefined;
    let position = 0;

    for (const word of words) {
      // Filtrer par longueur minimale
      if (word.length < this.config.minWordLength) {
        position++;
        continue;
      }

      // Filtrer les stop words
      if (this.config.removeStopWords && STOP_WORDS.has(word)) {
        position++;
        continue;
      }

      // Ajouter le terme
      terms.push(word);

      // Enregistrer la position si nécessaire
      if (positions) {
        if (!positions.has(word)) {
          positions.set(word, []);
        }
        positions.get(word)!.push(position);
      }

      position++;
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

/**
 * Liste de stop words français et anglais (mots vides à ignorer)
 */
const STOP_WORDS = new Set([
  // Français
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "ou",
  "mais",
  "donc",
  "or",
  "ni",
  "car",
  "ce",
  "cette",
  "ces",
  "mon",
  "ton",
  "son",
  "ma",
  "ta",
  "sa",
  "mes",
  "tes",
  "ses",
  "notre",
  "votre",
  "leur",
  "je",
  "tu",
  "il",
  "elle",
  "nous",
  "vous",
  "ils",
  "elles",
  "on",
  "qui",
  "que",
  "quoi",
  "dont",
  "où",
  "dans",
  "sur",
  "sous",
  "avec",
  "sans",
  "pour",
  "par",
  "en",
  "au",
  "aux",
  "à",
  "est",
  "sont",
  "était",
  "été",
  "être",
  "avoir",
  "avait",
  "eu",
  "fait",
  "faire",
  "dit",
  "dire",
  // Anglais
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
]);
