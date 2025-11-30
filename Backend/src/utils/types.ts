/**
 * Types pour le moteur de recherche de bibliothèque
 */

/**
 * Représente un livre dans la bibliothèque
 */
export interface Book {
  id: number;
  title: string;
  author: string;
  filePath: string;
  coverImagePath?: string;
  wordCount: number;
  createdAt?: string;
  clickCount?: number;
}

/**
 * Métadonnées d'un livre (avant indexation)
 */
export interface BookMetadata {
  title: string;
  author: string;
  filePath: string;
  coverImagePath?: string;
}

/**
 * Entrée dans l'index inversé
 */
export interface IndexEntry {
  term: string;
  bookId: number;
  termFrequency: number;
  positions?: number[]; // Positions du terme dans le document
}

/**
 * Statistiques globales d'un terme
 */
export interface TermStats {
  term: string;
  documentFrequency: number; // Nombre de documents contenant ce terme
  totalFrequency: number; // Nombre total d'occurrences
}

/**
 * Arête dans le graphe de Jaccard
 */
export interface JaccardEdge {
  bookId1: number;
  bookId2: number;
  similarity: number;
}

/**
 * Score PageRank d'un livre
 */
export interface PageRankScore {
  bookId: number;
  score: number;
}

/**
 * Extrait de texte avec highlighting
 */
export interface TextSnippet {
  text: string; // Texte avec <mark>...</mark> autour des termes
  position: number; // Position dans le document
  matchedTerms: string[]; // Termes matchés dans ce snippet
}

/**
 * Résultat de recherche avec score
 */
export interface SearchResult {
  book: Book;
  score: number;
  termFrequency?: number; // Nombre d'occurrences du terme recherché
  snippet?: string; // Extrait du texte (deprecated, use snippets)
  snippets?: TextSnippet[]; // Extraits de texte avec highlighting
}

/**
 * Suggestion de livre
 */
export interface BookSuggestion {
  book: Book;
  score: number;
  reason: "jaccard" | "pagerank" | "popular" | "hybrid";
  similarity?: number; // Similarité Jaccard si applicable
}

/**
 * Paramètres de recherche
 */
export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
  useRegex?: boolean;
  caseSensitive?: boolean;
  // Filtres
  author?: string;
  minWordCount?: number;
  maxWordCount?: number;
  minPageRank?: number;
  // Options
  fuzzy?: boolean; // Recherche floue
  fuzzyDistance?: number; // Distance Levenshtein max (défaut: 2)
  // Multi-champs
  searchFields?: ("title" | "author" | "content")[]; // Champs à rechercher
  fieldWeights?: { title?: number; author?: number; content?: number }; // Poids par champ
  // Highlighting
  highlight?: boolean; // Activer le highlighting
  snippetCount?: number; // Nombre de snippets à retourner (défaut: 3)
  snippetLength?: number; // Longueur d'un snippet en caractères (défaut: 150)
}

/**
 * Réponse de l'API de recherche
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  executionTimeMs: number;
  suggestions?: BookSuggestion[];
}

/**
 * Configuration du scoring
 */
export interface ScoringConfig {
  bm25Weight: number; // Poids du score BM25
  pageRankWeight: number; // Poids du PageRank
  k1: number; // Paramètre BM25
  b: number; // Paramètre BM25
  enableProximityBonus: boolean; // Activer le bonus de proximité
}

/**
 * Statistiques de la bibliothèque
 */
export interface LibraryStats {
  totalBooks: number;
  totalTerms: number;
  avgDocLength: number;
  totalWords: number;
  jaccardEdges: number;
  pageRankCalculated: boolean;
}

/**
 * Configuration de l'indexation
 */
export interface IndexingConfig {
  removeStopWords: boolean;
  stemming: boolean;
  minWordLength: number;
  storePositions: boolean;
}

/**
 * Progression de l'indexation
 */
export interface IndexingProgress {
  currentBook: number;
  totalBooks: number;
  currentPhase:
    | "reading"
    | "tokenizing"
    | "indexing"
    | "jaccard"
    | "pagerank"
    | "done";
  message: string;
  percentage: number;
}
