/**
 * Constantes globales pour la configuration
 * si DEFAULT, ça veut dire que cette valeur peur être changé, par exemple être passé en paramètre
 */

import { getConfig } from "./config.js";

// Constants with DEFAULT can be passed as parameters (not configurable via admin)
export const JACCARD_DEFAULT_THRESHOLD = parseFloat(
  process.env.JACCARD_THRESHOLD || "0.1"
);
export const JACCARD_DEFAULT_TOP_K = parseInt(
  process.env.JACCARD_TOP_K || "50"
);
export const JACCARD_DEFAULT_BATCH_SIZE = parseInt(
  process.env.JACCARD_BATCH_SIZE || "1000"
);

// Jaccard optimization settings (configurable via admin)
export function getJaccardMaxTermFrequency(): number {
  return getConfig(
    "JACCARD_MAX_TERM_FREQUENCY",
    "JACCARD_MAX_TERM_FREQUENCY",
    0.7,
    "number"
  );
}

export function getJaccardMinSharedTerms(): number {
  return getConfig(
    "JACCARD_MIN_SHARED_TERMS",
    "JACCARD_MIN_SHARED_TERMS",
    5,
    "number"
  );
}

export const PAGERANK_DEFAULT_MAX_ITERATIONS = parseInt(
  process.env.PAGERANK_MAX_ITERATIONS || "100"
);
export const PAGERANK_DEFAULT_DAMPING = parseFloat(
  process.env.PAGERANK_DAMPING || "0.85"
);
export const PAGERANK_DEFAULT_TOLERANCE = parseFloat(
  process.env.PAGERANK_TOLERANCE || "1e-6"
);

// Configurable constants (loaded from database with fallback to env vars)
// These are getter functions that always return fresh values from the database
export function getTokenizerIgnoreStopWords(): boolean {
  return getConfig(
    "TOKENIZER_IGNORE_STOP_WORDS",
    "TOKENIZER_IGNORE_STOP_WORDS",
    true,
    "boolean"
  );
}

export function getTokenizerMinWordLength(): number {
  return getConfig(
    "TOKENIZER_MIN_WORD_LENGTH",
    "TOKENIZER_MIN_WORD_LENGTH",
    2,
    "number"
  );
}

export function getTokenizerCaseSensitive(): boolean {
  return getConfig(
    "TOKENIZER_CASE_SENSITIVE",
    "TOKENIZER_CASE_SENSITIVE",
    false,
    "boolean"
  );
}

export function getTokenizerKeepPositions(): boolean {
  return getConfig(
    "TOKENIZER_KEEP_POSITIONS",
    "TOKENIZER_KEEP_POSITIONS",
    true,
    "boolean"
  );
}

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD is not defined");
}

export const SEARCH_FUZZY_DEFAULT_MAX_DISTANCE = parseInt(
  process.env.SEARCH_FUZZY_DEFAULT_MAX_DISTANCE || "2"
);

export function getSearchHighlightSnippetCount(): number {
  return getConfig(
    "SEARCH_HIGHLIGHT_SNIPPET_COUNT",
    "SEARCH_HIGHLIGHT_SNIPPET_COUNT",
    3,
    "number"
  );
}

export function getSearchHighlightSnippetLength(): number {
  return getConfig(
    "SEARCH_HIGHLIGHT_SNIPPET_LENGTH",
    "SEARCH_HIGHLIGHT_SNIPPET_LENGTH",
    150,
    "number"
  );
}

export function getSearchHighlightContextLengthBefore(): number {
  return getConfig(
    "SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE",
    "SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE",
    100,
    "number"
  );
}

export function getSearchHighlightContextLengthAfter(): number {
  return getConfig(
    "SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER",
    "SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER",
    100,
    "number"
  );
}

export const RECOMMENDATION_DEFAULT_LIMIT = parseInt(
  process.env.RECOMMENDATION_DEFAULT_LIMIT || "10"
);
export const RECOMMENDATION_JACCARD_THRESHOLD = parseFloat(
  process.env.RECOMMENDATION_JACCARD_THRESHOLD || "0.1"
);

export function getGutenbergBatchSize(): number {
  return getConfig(
    "GUTENBERG_BATCH_SIZE",
    "GUTENBERG_BATCH_SIZE",
    30,
    "number"
  );
}

export function getSearchScoringBm25Weight(): number {
  return getConfig(
    "SEARCH_SCORING_BM25_WEIGHT",
    "SEARCH_SCORING_BM25_WEIGHT",
    0.6,
    "number"
  );
}

export function getSearchScoringPagerankWeight(): number {
  return getConfig(
    "SEARCH_SCORING_PAGERANK_WEIGHT",
    "SEARCH_SCORING_PAGERANK_WEIGHT",
    0.4,
    "number"
  );
}



export function getSearchScoringK1(): number {
  return getConfig("SEARCH_SCORING_K1", "SEARCH_SCORING_K1", 1.2, "number");
}

export function getSearchScoringB(): number {
  return getConfig("SEARCH_SCORING_B", "SEARCH_SCORING_B", 0.75, "number");
}

export function getSearchScoringEnableProximityBonus(): boolean {
  return getConfig(
    "SEARCH_SCORING_ENABLE_PROXIMITY_BONUS",
    "SEARCH_SCORING_ENABLE_PROXIMITY_BONUS",
    true,
    "boolean"
  );
}

export const STOP_WORDS = new Set([
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
