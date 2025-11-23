/**
 * Système de scoring pour les résultats de recherche
 * Implémente BM25 et scoring hybride
 */

import { getDatabase } from "../db/connection.js";
import {
  SEARCH_SCORING_BM25_WEIGHT,
  SEARCH_SCORING_PAGERANK_WEIGHT,
  SEARCH_SCORING_OCCURRENCE_WEIGHT,
  SEARCH_SCORING_K1,
  SEARCH_SCORING_B,
  SEARCH_SCORING_ENABLE_PROXIMITY_BONUS,
} from "../utils/const.js";
import { ScoringConfig } from "../utils/types.js";

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
      bm25Weight: config.bm25Weight ?? SEARCH_SCORING_BM25_WEIGHT,
      pageRankWeight: config.pageRankWeight ?? SEARCH_SCORING_PAGERANK_WEIGHT,
      occurrenceWeight:
        config.occurrenceWeight ?? SEARCH_SCORING_OCCURRENCE_WEIGHT,
      k1: config.k1 ?? SEARCH_SCORING_K1,
      b: config.b ?? SEARCH_SCORING_B,
      enableProximityBonus:
        config.enableProximityBonus ?? SEARCH_SCORING_ENABLE_PROXIMITY_BONUS,
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
    const meta = this.db
      .prepare(
        `
      SELECT key, value FROM library_metadata WHERE key IN ('avg_doc_length', 'total_books')
    `
      )
      .all() as Array<{ key: string; value: string }>;

    const stats = Object.fromEntries(
      meta.map((m) => [m.key, parseFloat(m.value)])
    );

    return {
      avgDocLength: stats.avg_doc_length || 0,
      totalBooks: stats.total_books || 0,
    };
  }

  /**
   * Calcule le bonus de proximité basé sur les positions des termes
   * Retourne un multiplicateur entre 1.0 (pas de proximité) et 3.0 (phrase exacte)
   */
  calculateProximityBonus(bookId: number, queryTerms: string[]): number {
    if (queryTerms.length <= 1) return 1.0; // Pas de proximité pour un seul terme

    // Récupérer les positions de tous les termes
    const termPositions = new Map<string, number[]>();

    for (const term of queryTerms) {
      const result = this.db
        .prepare(
          `
        SELECT positions FROM inverted_index WHERE term = ? AND book_id = ?
      `
        )
        .get(term, bookId) as { positions: string } | undefined;

      if (!result) return 1.0; // Si un terme manque, pas de bonus

      const positions = JSON.parse(result.positions) as number[];
      termPositions.set(term, positions);
    }

    // Chercher la distance minimale entre les termes
    let minDistance = Infinity;
    let hasExactPhrase = false;

    // Pour chaque position du premier terme
    const firstTermPositions = termPositions.get(queryTerms[0])!;

    for (const startPos of firstTermPositions) {
      let maxDistanceInWindow = 0;
      let isExactPhrase = true;

      // Vérifier si tous les autres termes sont proches
      for (let i = 1; i < queryTerms.length; i++) {
        const positions = termPositions.get(queryTerms[i])!;

        // Trouver la position la plus proche de startPos + i
        const expectedPos = startPos + i;
        let closestPos = positions[0];
        let minDist = Math.abs(positions[0] - expectedPos);

        for (const pos of positions) {
          const dist = Math.abs(pos - expectedPos);
          if (dist < minDist) {
            minDist = dist;
            closestPos = pos;
          }
        }

        // Distance par rapport à la position attendue
        const distance = Math.abs(closestPos - expectedPos);
        maxDistanceInWindow = Math.max(maxDistanceInWindow, distance);

        // Si pas exactement à la position attendue, ce n'est pas une phrase exacte
        if (distance !== 0) {
          isExactPhrase = false;
        }
      }

      // Mettre à jour la distance minimale trouvée
      if (maxDistanceInWindow < minDistance) {
        minDistance = maxDistanceInWindow;
      }

      // Si on trouve une phrase exacte, on peut arrêter
      if (isExactPhrase) {
        hasExactPhrase = true;
        break;
      }
    }

    // Calculer le bonus basé sur la proximité
    if (hasExactPhrase) {
      return 3.0; // Phrase exacte : bonus x3
    } else if (minDistance === 0) {
      return 2.5; // Termes consécutifs mais pas dans l'ordre exact
    } else if (minDistance <= 2) {
      return 2.0; // Très proche (dans une fenêtre de 2 mots)
    } else if (minDistance <= 5) {
      return 1.5; // Proche (dans une fenêtre de 5 mots)
    } else if (minDistance <= 10) {
      return 1.2; // Moyennement proche (dans une fenêtre de 10 mots)
    } else {
      return 1.0; // Pas de bonus
    }
  }

  /**
   * Calcule le score BM25 pour un document et un ensemble de termes
   * Avec bonus de proximité (si activé)
   */
  calculateBM25(bookId: number, queryTerms: string[]): number {
    let score = 0;

    // Récupérer la longueur du document
    const docLengthResult = this.db
      .prepare(
        `
      SELECT word_count FROM books WHERE id = ?
    `
      )
      .get(bookId) as { word_count: number } | undefined;

    if (!docLengthResult) return 0;

    const docLength = docLengthResult.word_count;

    for (const term of queryTerms) {
      // Récupérer TF (term frequency) pour ce document
      const tfResult = this.db
        .prepare(
          `
        SELECT term_frequency FROM inverted_index WHERE term = ? AND book_id = ?
      `
        )
        .get(term, bookId) as { term_frequency: number } | undefined;

      if (!tfResult) continue;

      const tf = tfResult.term_frequency;

      // Récupérer DF (document frequency)
      const dfResult = this.db
        .prepare(
          `
        SELECT document_frequency FROM term_stats WHERE term = ?
      `
        )
        .get(term) as { document_frequency: number } | undefined;

      if (!dfResult) continue;

      const df = dfResult.document_frequency;

      // Calcul IDF
      const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

      // Normalisation par la longueur du document
      const norm =
        1 - this.config.b + this.config.b * (docLength / this.avgDocLength);

      // Score BM25 pour ce terme
      const termScore =
        idf * ((tf * (this.config.k1 + 1)) / (tf + this.config.k1 * norm));

      score += termScore;
    }

    // Appliquer le bonus de proximité si activé
    if (this.config.enableProximityBonus) {
      const proximityBonus = this.calculateProximityBonus(bookId, queryTerms);
      score *= proximityBonus;
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
      const result = this.db
        .prepare(
          `
        SELECT term_frequency FROM inverted_index WHERE term = ? AND book_id = ?
      `
        )
        .get(term, bookId) as { term_frequency: number } | undefined;

      if (result) {
        totalOccurrences += result.term_frequency;
      }
    }

    // Normaliser par la longueur du document
    const docLengthResult = this.db
      .prepare(
        `
      SELECT word_count FROM books WHERE id = ?
    `
      )
      .get(bookId) as { word_count: number } | undefined;

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
