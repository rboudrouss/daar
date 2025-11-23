/**
 * Moteur de recherche principal
 */

import { getDatabase } from "../db/connection.js";
import { Tokenizer } from "../indexing/tokenizer.js";
import { ScoringEngine } from "./scoring.js";
import { Highlighter } from "./highlighter.js";
import { FuzzyMatcher } from "./fuzzy.js";
import { SemanticSearch } from "./semantic.js";
import { RecommendationEngine } from "./recommendations.js";
import {
  SearchParams,
  SearchResult,
  BookSuggestion,
  Book,
} from "../utils/types.js";
import { RECOMMENDATION_DEFAULT_LIMIT, SEARCH_FUZZY_DEFAULT_MAX_DISTANCE, STOP_WORDS, TOKENIZER_IGNORE_STOP_WORDS } from "../utils/const.js";

/**
 * Moteur de recherche
 */
export class SearchEngine {
  private db;
  private tokenizer: Tokenizer;
  private scoringEngine: ScoringEngine;
  private highlighter: Highlighter;
  private fuzzyMatcher: FuzzyMatcher;
  private semanticSearch: SemanticSearch;
  private recommendationEngine: RecommendationEngine;

  constructor() {
    this.db = getDatabase();
    this.tokenizer = new Tokenizer({ removeStopWords: false }); // Pas de stop words pour les requêtes
    this.scoringEngine = new ScoringEngine();
    this.highlighter = new Highlighter();
    this.fuzzyMatcher = new FuzzyMatcher();
    this.semanticSearch = new SemanticSearch(this.db);
    this.recommendationEngine = new RecommendationEngine(this.db);
  }

  /**
   * Recherche simple par mot-clé avec toutes les fonctionnalités avancées
   */
  search(params: SearchParams): SearchResult[] {
    const startTime = Date.now();

    // Tokenizer la requête
    let queryTerms = this.tokenizer.tokenizeQuery(params.query);

    if (queryTerms.length === 0) {
      return [];
    }

    // Recherche floue si activée
    if (params.fuzzy) {
      queryTerms = this.expandQueryWithFuzzy(queryTerms, params.fuzzyDistance);
    }

    // Recherche multi-champs
    const bookIds = this.findBooksMultiField(queryTerms, params);

    if (bookIds.size === 0) {
      return [];
    }

    // Récupérer les PageRank scores
    const pageRankScores = this.getPageRankScores();

    // Calculer les scores pour chaque livre
    let results: SearchResult[] = [];

    for (const bookId of bookIds) {
      const book = this.getBook(bookId);
      if (!book) continue;

      // Appliquer les filtres
      if (!this.applyFilters(book, pageRankScores.get(bookId), params)) {
        continue;
      }

      const pageRankScore = pageRankScores.get(bookId);
      const score = this.scoringEngine.calculateHybridScore(
        bookId,
        queryTerms,
        pageRankScore
      );

      // Récupérer la fréquence totale des termes
      const termFrequency = this.getTotalTermFrequency(bookId, queryTerms);

      const result: SearchResult = {
        book,
        score,
        termFrequency,
      };

      results.push(result);
    }

    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);

    // Appliquer limit et offset
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const paginatedResults = results.slice(offset, offset + limit);

    // Ajouter le highlighting APRÈS le tri et le limit (pour ne générer que pour les résultats retournés)
    if (params.highlight) {
      for (const result of paginatedResults) {
        result.snippets = this.generateHighlights(result.book, queryTerms, params);
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(
      `🔍 Search for "${params.query}" found ${results.length} results in ${executionTime}ms`
    );

    return paginatedResults;
  }

  /**
   * Recherche avancée par RegEx
   */
  searchRegex(params: SearchParams): SearchResult[] {
    const startTime = Date.now();

    // Créer une regex à partir de la requête
    const flags = params.caseSensitive ? "" : "i";
    const regex = new RegExp(params.query, flags);

    // Chercher tous les termes qui matchent la regex dans l'index
    const allTerms = this.db
      .prepare(
        `
      SELECT DISTINCT term FROM term_stats
    `
      )
      .all() as Array<{ term: string }>;

    const matchingTerms = allTerms
      .map((t) => t.term)
      .filter((term) => regex.test(term));

    if (matchingTerms.length === 0) {
      return [];
    }

    console.log(
      `📝 Regex "${params.query}" matched ${matchingTerms.length} terms`
    );

    // Utiliser la recherche normale avec les termes matchés
    return this.search({
      ...params,
      query: matchingTerms.join(" "),
    });
  }

  /**
   * Génère des suggestions basées sur les résultats de recherche
   */
  getSuggestions(
    searchResults: SearchResult[],
    limit: number = RECOMMENDATION_DEFAULT_LIMIT
  ): BookSuggestion[] {
    if (searchResults.length === 0) {
      return [];
    }

    // Prendre les top 3 résultats
    const topResults = searchResults.slice(
      0,
      Math.min(3, searchResults.length)
    );
    const topBookIds = topResults.map((r) => r.book.id);

    // Récupérer les voisins dans le graphe Jaccard
    const neighbors = this.getJaccardNeighbors(topBookIds);

    // Filtrer les livres déjà dans les résultats
    const resultBookIds = new Set(searchResults.map((r) => r.book.id));
    const filteredNeighbors = neighbors.filter(
      (n) => !resultBookIds.has(n.bookId)
    );

    // Récupérer les PageRank scores
    const pageRankScores = this.getPageRankScores();

    // Scorer les suggestions
    const suggestions: BookSuggestion[] = filteredNeighbors
      .map((neighbor) => {
        const book = this.getBook(neighbor.bookId);
        if (!book) return null;

        const pageRank = pageRankScores.get(neighbor.bookId) || 0;

        // Score hybride : 60% Jaccard + 40% PageRank
        const score = 0.6 * neighbor.similarity + 0.4 * pageRank * 100;

        return {
          book,
          score,
          reason: "hybrid" as const,
          similarity: neighbor.similarity,
        };
      })
      .filter(
        (s): s is NonNullable<typeof s> => s !== null
      ) as BookSuggestion[];

    // Trier par score et limiter
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.slice(0, limit);
  }

  /**
   * Trouve tous les livres contenant au moins un des termes
   */
  private findBooksWithTerms(terms: string[]): Set<number> {
    const bookIds = new Set<number>();

    for (const term of terms) {
      const results = this.db
        .prepare(
          `
        SELECT DISTINCT book_id FROM inverted_index WHERE term = ?
      `
        )
        .all(term) as Array<{ book_id: number }>;

      results.forEach((r) => bookIds.add(r.book_id));
    }

    return bookIds;
  }

  /**
   * Récupère un livre par son ID
   */
  private getBook(bookId: number): Book | null {
    const result = this.db
      .prepare(
        `
      SELECT b.id, b.title, b.author, b.file_path, b.cover_image_path, b.word_count, b.created_at,
             COALESCE(bc.click_count, 0) as click_count
      FROM books b
      LEFT JOIN book_clicks bc ON b.id = bc.book_id
      WHERE b.id = ?
    `
      )
      .get(bookId) as any;

    if (!result) return null;

    return {
      id: result.id,
      title: result.title,
      author: result.author,
      filePath: result.file_path,
      coverImagePath: result.cover_image_path,
      wordCount: result.word_count,
      createdAt: result.created_at,
      clickCount: result.click_count,
    };
  }

  /**
   * Récupère les scores PageRank
   */
  private getPageRankScores(): Map<number, number> {
    const scores = this.db
      .prepare(
        `
      SELECT book_id, score FROM pagerank
    `
      )
      .all() as Array<{ book_id: number; score: number }>;

    return new Map(scores.map((s) => [s.book_id, s.score]));
  }

  /**
   * Récupère la fréquence totale des termes dans un livre
   */
  private getTotalTermFrequency(bookId: number, terms: string[]): number {
    let total = 0;

    for (const term of terms) {
      const result = this.db
        .prepare(
          `
        SELECT term_frequency FROM inverted_index WHERE term = ? AND book_id = ?
      `
        )
        .get(term, bookId) as { term_frequency: number } | undefined;

      if (result) {
        total += result.term_frequency;
      }
    }

    return total;
  }

  /**
   * Récupère les voisins Jaccard des livres donnés
   */
  private getJaccardNeighbors(
    bookIds: number[]
  ): Array<{ bookId: number; similarity: number }> {
    const neighbors = new Map<number, number>(); // bookId -> max similarity

    for (const bookId of bookIds) {
      // Récupérer les voisins (dans les deux sens)
      const results = this.db
        .prepare(
          `
        SELECT
          CASE
            WHEN book_id_1 = ? THEN book_id_2
            ELSE book_id_1
          END as neighbor_id,
          similarity
        FROM jaccard_edges
        WHERE book_id_1 = ? OR book_id_2 = ?
        ORDER BY similarity DESC
        LIMIT 20
      `
        )
        .all(bookId, bookId, bookId) as Array<{
        neighbor_id: number;
        similarity: number;
      }>;

      for (const { neighbor_id, similarity } of results) {
        const currentSim = neighbors.get(neighbor_id) || 0;
        neighbors.set(neighbor_id, Math.max(currentSim, similarity));
      }
    }

    return Array.from(neighbors.entries()).map(([bookId, similarity]) => ({
      bookId,
      similarity,
    }));
  }



  /**
   * Étend la requête avec des termes similaires (fuzzy)
   */
  private expandQueryWithFuzzy(
    queryTerms: string[],
    maxDistance: number = SEARCH_FUZZY_DEFAULT_MAX_DISTANCE
  ): string[] {
    const allTerms = this.db
      .prepare(
        `
      SELECT DISTINCT term FROM term_stats
    `
      )
      .all() as Array<{ term: string }>;

    const availableTerms = allTerms.map((t) => t.term);
    const expandedTerms = new Set<string>(queryTerms);

    for (const term of queryTerms) {
      const similar = this.fuzzyMatcher.findMatchingTerms(
        term,
        availableTerms,
        true,
        maxDistance
      );
      similar.forEach((t) => expandedTerms.add(t));
    }

    return Array.from(expandedTerms);
  }

  /**
   * Recherche multi-champs (titre, auteur, contenu)
   */
  private findBooksMultiField(
    queryTerms: string[],
    params: SearchParams
  ): Set<number> {
    const searchFields = params.searchFields || ["content"];
    const bookIds = new Set<number>();

    // Recherche dans le contenu (index inversé)
    if (searchFields.includes("content")) {
      const contentBooks = this.findBooksWithTerms(queryTerms);
      contentBooks.forEach((id) => bookIds.add(id));
    }

    // Recherche dans le titre et l'auteur
    if (searchFields.includes("title") || searchFields.includes("author")) {
      const query = queryTerms.join(" ");
      const conditions: string[] = [];
      const params_array: string[] = [];

      if (searchFields.includes("title")) {
        conditions.push("title LIKE ?");
        params_array.push(`%${query}%`);
      }

      if (searchFields.includes("author")) {
        conditions.push("author LIKE ?");
        params_array.push(`%${query}%`);
      }

      const results = this.db
        .prepare(
          `
        SELECT id FROM books WHERE ${conditions.join(" OR ")}
      `
        )
        .all(...params_array) as Array<{ id: number }>;

      results.forEach((r) => bookIds.add(r.id));
    }

    return bookIds;
  }

  /**
   * Applique les filtres sur un livre
   */
  private applyFilters(
    book: Book,
    pageRank: number | undefined,
    params: SearchParams
  ): boolean {
    // Filtre par auteur
    if (
      params.author &&
      !book.author.toLowerCase().includes(params.author.toLowerCase())
    ) {
      return false;
    }

    // Filtre par longueur
    if (params.minWordCount && book.wordCount < params.minWordCount) {
      return false;
    }

    if (params.maxWordCount && book.wordCount > params.maxWordCount) {
      return false;
    }

    // Filtre par PageRank
    if (params.minPageRank && (!pageRank || pageRank < params.minPageRank)) {
      return false;
    }

    return true;
  }

  /**
   * Génère les highlights pour un livre
   */
  private generateHighlights(
    book: Book,
    queryTerms: string[],
    params: SearchParams
  ) {
    // Récupérer les positions des termes
    const positions = new Map<string, number[]>();

    for (const term of new Set(queryTerms)) {
      if (TOKENIZER_IGNORE_STOP_WORDS && STOP_WORDS.has(term.toLowerCase())) continue;
      const result = this.db
        .prepare(
          `
        SELECT positions FROM inverted_index WHERE term = ? AND book_id = ?
      `
        )
        .get(term, book.id) as { positions: string } | undefined;

      if (result) {
        positions.set(term, JSON.parse(result.positions));
      }
    }

    return this.highlighter.generateSnippets(
      book.filePath,
      queryTerms,
      positions,
      {
        snippetCount: params.snippetCount,
        snippetLength: params.snippetLength,
      }
    );
  }

  /**
   * Obtient des recommandations basées sur l'historique de clics globaux
   */
  getRecommendations(limit: number = RECOMMENDATION_DEFAULT_LIMIT): BookSuggestion[] {
    return this.recommendationEngine.getRecommendationsFromHistory(limit);
  }

  /**
   * Trouve des livres similaires par sémantique
   */
  findSimilarBooks(bookId: number, limit: number = RECOMMENDATION_DEFAULT_LIMIT): SearchResult[] {
    const similar = this.semanticSearch.findSimilarBooks(bookId, limit);

    return similar
      .map((s) => {
        const book = this.getBook(s.bookId);
        if (!book) return null;

        return {
          book,
          score: s.similarity,
        };
      })
      .filter((r): r is SearchResult => r !== null);
  }
}
