/**
 * Recommendations - Système de recommandations basé sur Jaccard et l'historique
 */

import type Database from "better-sqlite3";
import { BookSuggestion, Book } from "../utils/types";
import { RECOMMENDATION_DEFAULT_LIMIT } from "../utils/const";

/**
 * Classe pour générer des recommandations
 */
export class RecommendationEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Génère des recommandations basées sur l'historique de clics globaux
   * @param limit Nombre de recommandations
   * @returns Liste de suggestions
   */
  getRecommendationsFromHistory(limit: number = RECOMMENDATION_DEFAULT_LIMIT): BookSuggestion[] {
    // Récupérer les livres les plus cliqués globalement
    const clickedBooks = this.db
      .prepare(
        `
      SELECT book_id, COUNT(*) as click_count
      FROM book_clicks
      GROUP BY book_id
      ORDER BY click_count DESC
      LIMIT 5
    `
      )
      .all() as Array<{
      book_id: number;
      click_count: number;
    }>;

    if (clickedBooks.length === 0) {
      // Pas d'historique, retourner les livres avec le meilleur PageRank
      return this.getTopPageRankBooks(limit);
    }

    // Pour chaque livre cliqué, trouver les voisins Jaccard
    const recommendations = new Map<
      number,
      { score: number; similarity: number }
    >();

    for (const clicked of clickedBooks) {
      const neighbors = this.db
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
        LIMIT 10
      `
        )
        .all(clicked.book_id, clicked.book_id, clicked.book_id) as Array<{
        neighbor_id: number;
        similarity: number;
      }>;

      for (const neighbor of neighbors) {
        // Calculer un score combiné : similarité * poids du livre cliqué
        const weight = clicked.click_count / clickedBooks[0].click_count; // Normaliser
        const score = neighbor.similarity * weight;

        if (recommendations.has(neighbor.neighbor_id)) {
          // Additionner les scores si le livre est recommandé par plusieurs sources
          const existing = recommendations.get(neighbor.neighbor_id)!;
          recommendations.set(neighbor.neighbor_id, {
            score: existing.score + score,
            similarity: Math.max(existing.similarity, neighbor.similarity),
          });
        } else {
          recommendations.set(neighbor.neighbor_id, {
            score,
            similarity: neighbor.similarity,
          });
        }
      }
    }

    // Convertir en BookSuggestion
    const suggestions: BookSuggestion[] = [];

    for (const [bookId, data] of recommendations) {
      const book = this.db
        .prepare(
          `
        SELECT id, title, author, file_path, cover_image_path, word_count, created_at
        FROM books
        WHERE id = ?
      `
        )
        .get(bookId) as any;

      if (book) {
        suggestions.push({
          book: {
            id: book.id,
            title: book.title,
            author: book.author,
            filePath: book.file_path,
            coverImagePath: book.cover_image_path,
            wordCount: book.word_count,
            createdAt: book.created_at,
          },
          score: data.score,
          reason: "hybrid",
          similarity: data.similarity,
        });
      }
    }

    // Trier par score décroissant
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.slice(0, limit);
  }

  /**
   * Retourne les livres avec le meilleur PageRank
   */
  private getTopPageRankBooks(limit: number): BookSuggestion[] {
    const books = this.db
      .prepare(
        `
      SELECT b.id, b.title, b.author, b.file_path as filePath, b.cover_image_path as coverImagePath,
             b.word_count as wordCount, b.created_at as createdAt,
             p.score as pagerank_score
      FROM books b
      LEFT JOIN pagerank p ON b.id = p.book_id
      ORDER BY p.score DESC
      LIMIT ?
    `
      )
      .all(limit) as Array<Book & { pagerank_score: number }>;

    return books.map((book) => ({
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        filePath: book.filePath,
        coverImagePath: book.coverImagePath,
        wordCount: book.wordCount,
        createdAt: book.createdAt,
      },
      score: book.pagerank_score || 0,
      reason: "pagerank" as const,
    }));
  }

  /**
   * Génère des recommandations basées uniquement sur Jaccard
   * @param bookId ID du livre de référence
   * @param limit Nombre de recommandations
   * @returns Liste de suggestions
   */
  getJaccardRecommendations(
    bookId: number,
    limit: number = RECOMMENDATION_DEFAULT_LIMIT
  ): BookSuggestion[] {
    const neighbors = this.db
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
      LIMIT ?
    `
      )
      .all(bookId, bookId, bookId, limit) as Array<{
      neighbor_id: number;
      similarity: number;
    }>;

    const suggestions: BookSuggestion[] = [];

    for (const neighbor of neighbors) {
      const book = this.db
        .prepare(
          `
        SELECT id, title, author, file_path, word_count, created_at
        FROM books
        WHERE id = ?
      `
        )
        .get(neighbor.neighbor_id) as Book | undefined;

      if (book) {
        suggestions.push({
          book,
          score: neighbor.similarity,
          reason: "jaccard",
          similarity: neighbor.similarity,
        });
      }
    }

    return suggestions;
  }
}
