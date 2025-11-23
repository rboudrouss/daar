/**
 * Constantes globales pour la configuration
 * si DEFAULT, ça veut dire que cette valeur peur être changé, par exemple être passé en paramètre
 */

export const JACCARD_DEFAULT_THRESHOLD = parseFloat(process.env.JACCARD_THRESHOLD || "0.1");
export const JACCARD_DEFAULT_TOP_K = parseInt(process.env.JACCARD_TOP_K || "50");
export const JACCARD_DEFAULT_BATCH_SIZE = parseInt(process.env.JACCARD_BATCH_SIZE || "1000");

export const PAGERANK_DEFAULT_MAX_ITERATIONS = parseInt(process.env.PAGERANK_MAX_ITERATIONS || "100");
export const PAGERANK_DEFAULT_DAMPING = parseFloat(process.env.PAGERANK_DAMPING || "0.85");
export const PAGERANK_DEFAULT_TOLERANCE = parseFloat(process.env.PAGERANK_TOLERANCE || "1e-6");

export const TOKENIZER_IGNORE_STOP_WORDS = process.env.TOKENIZER_IGNORE_STOP_WORDS != "false"; // true par défaut
export const TOKENIZER_MIN_WORD_LENGTH = parseInt(process.env.TOKENIZER_MIN_WORD_LENGTH || "2");
export const TOKENIZER_CASE_SENSITIVE = Boolean(process.env.TOKENIZER_CASE_SENSITIVE);
export const TOKENIZER_KEEP_POSITIONS = process.env.TOKENIZER_KEEP_POSITIONS !== "false"; // true par défaut

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD is not defined");
}

export const SEARCH_FUZZY_DEFAULT_MAX_DISTANCE = parseInt(process.env.SEARCH_FUZZY_DEFAULT_MAX_DISTANCE || "2");
export const SEARCH_HIGHLIGHT_SNIPPET_COUNT = parseInt(process.env.SEARCH_HIGHLIGHT_SNIPPET_COUNT || "3");
export const SEARCH_HIGHLIGHT_SNIPPET_LENGTH = parseInt(process.env.SEARCH_HIGHLIGHT_SNIPPET_LENGTH || "150");
export const SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE = parseInt(process.env.SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE || "100");
export const SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER = parseInt(process.env.SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER || "100");

export const RECOMMENDATION_DEFAULT_LIMIT = parseInt(process.env.RECOMMENDATION_DEFAULT_LIMIT || "10");
export const RECOMMENDATION_JACCARD_THRESHOLD = parseFloat(process.env.RECOMMENDATION_JACCARD_THRESHOLD || "0.1");

export const GUTENBERG_BATCH_SIZE = parseInt(process.env.GUTENBERG_BATCH_SIZE || "30");

export const SEARCH_SCORING_BM25_WEIGHT = parseFloat(process.env.SEARCH_SCORING_BM25_WEIGHT || "0.6");
export const SEARCH_SCORING_PAGERANK_WEIGHT = parseFloat(process.env.SEARCH_SCORING_PAGERANK_WEIGHT || "0.4");
export const SEARCH_SCORING_OCCURRENCE_WEIGHT = parseFloat(process.env.SEARCH_SCORING_OCCURRENCE_WEIGHT || "0");
export const SEARCH_SCORING_K1 = parseFloat(process.env.SEARCH_SCORING_K1 || "1.2");
export const SEARCH_SCORING_B = parseFloat(process.env.SEARCH_SCORING_B || "0.75");
export const SEARCH_SCORING_ENABLE_PROXIMITY_BONUS = process.env.SEARCH_SCORING_ENABLE_PROXIMITY_BONUS !== "false";


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

