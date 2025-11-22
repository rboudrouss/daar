/**
 * Système de scoring pour les résultats de recherche
 * Implémente BM25 et scoring hybride
 */

import { getDatabase } from '../db/connection.js';
import { ScoringConfig } from '../utils/types.js';

/**
 * Calculateur de scores
 */
export class ScoringEngine {
  private db;
  private config: ScoringConfig;
  private avgDocLength: number;
  private totalDocs: number;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.db = getDatabase();
    this.config = {
      bm25Weight: config.bm25Weight ?? 0.6,
      pageRankWeight: config.pageRankWeight ?? 0.4,
      occurrenceWeight: config.occurrenceWeight ?? 0.0,
      k1: config.k1 ?? 1.2,
      b: config.b ?? 0.75,
    };

    // Charger les statistiques de la bibliothèque
    const stats = this.loadLibraryStats();
    this.avgDocLength = stats.avgDocLength;
    this.totalDocs = stats.totalBooks;
  }

  /**
   * Charge les statistiques de la bibliothèque
   */
  private loadLibraryStats(): { avgDocLength: number; totalBooks: number } {
    const meta = this.db.prepare(`
      SELECT key, value FROM library_metadata WHERE key IN ('avg_doc_length', 'total_books')
    `).all() as Array<{ key: string; value: string }>;

    const stats = Object.fromEntries(meta.map(m => [m.key, parseFloat(m.value)]));

    return {
      avgDocLength: stats.avg_doc_length || 0,
      totalBooks: stats.total_books || 0,
    };
  }

  /**
   * Calcule le score BM25 pour un document et un ensemble de termes
   */
  calculateBM25(
    bookId: number,
    queryTerms: string[]
  ): number {
    let score = 0;

    // Récupérer la longueur du document
    const docLengthResult = this.db.prepare(`
      SELECT word_count FROM books WHERE id = ?
    `).get(bookId) as { word_count: number } | undefined;

    if (!docLengthResult) return 0;

    const docLength = docLengthResult.word_count;

    for (const term of queryTerms) {
      // Récupérer TF (term frequency) pour ce document
      const tfResult = this.db.prepare(`
        SELECT term_frequency FROM inverted_index WHERE term = ? AND book_id = ?
      `).get(term, bookId) as { term_frequency: number } | undefined;

      if (!tfResult) continue;

      const tf = tfResult.term_frequency;

      // Récupérer DF (document frequency)
      const dfResult = this.db.prepare(`
        SELECT document_frequency FROM term_stats WHERE term = ?
      `).get(term) as { document_frequency: number } | undefined;

      if (!dfResult) continue;

      const df = dfResult.document_frequency;

      // Calcul IDF
      const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

      // Normalisation par la longueur du document
      const norm = 1 - this.config.b + this.config.b * (docLength / this.avgDocLength);

      // Score BM25 pour ce terme
      const termScore = idf * ((tf * (this.config.k1 + 1)) / (tf + this.config.k1 * norm));

      score += termScore;
    }

    return score;
  }

  /**
   * Calcule le score hybride (BM25 + PageRank)
   */
  calculateHybridScore(
    bookId: number,
    queryTerms: string[],
    pageRankScore?: number
  ): number {
    const bm25Score = this.calculateBM25(bookId, queryTerms);

    // Si pas de PageRank, retourner seulement BM25
    if (pageRankScore === undefined || pageRankScore === null) {
      return bm25Score;
    }

    // Normaliser PageRank (typiquement entre 0 et 1, mais on peut le scaler)
    // PageRank est déjà normalisé (somme = 1), on le multiplie par le nombre de docs
    // pour avoir un ordre de grandeur similaire à BM25
    const normalizedPageRank = pageRankScore * this.totalDocs;

    // Score hybride
    const hybridScore =
      this.config.bm25Weight * bm25Score +
      this.config.pageRankWeight * normalizedPageRank;

    return hybridScore;
  }

  /**
   * Calcule le score basé sur les occurrences (simple)
   */
  calculateOccurrenceScore(bookId: number, queryTerms: string[]): number {
    let totalOccurrences = 0;

    for (const term of queryTerms) {
      const result = this.db.prepare(`
        SELECT term_frequency FROM inverted_index WHERE term = ? AND book_id = ?
      `).get(term, bookId) as { term_frequency: number } | undefined;

      if (result) {
        totalOccurrences += result.term_frequency;
      }
    }

    // Normaliser par la longueur du document
    const docLengthResult = this.db.prepare(`
      SELECT word_count FROM books WHERE id = ?
    `).get(bookId) as { word_count: number } | undefined;

    if (!docLengthResult || docLengthResult.word_count === 0) return 0;

    return (totalOccurrences / docLengthResult.word_count) * 1000;
  }

  /**
   * Met à jour la configuration du scoring
   */
  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Récupère la configuration actuelle
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }
}

