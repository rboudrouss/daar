/**
 * Semantic Search - Recherche par similarité sémantique avec TF-IDF
 */

import type Database from "better-sqlite3";
import { RECOMMENDATION_DEFAULT_LIMIT, RECOMMENDATION_JACCARD_THRESHOLD } from "../utils/const";

/**
 * Vecteur TF-IDF d'un document
 */
export interface TFIDFVector {
  bookId: number;
  vector: Map<string, number>; // term -> tf-idf score
  magnitude: number; // Norme du vecteur
}

/**
 * Classe pour la recherche sémantique
 */
export class SemanticSearch {
  private db: Database.Database;
  private vectorCache: Map<number, TFIDFVector> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Calcule le vecteur TF-IDF d'un livre
   */
  private computeTFIDFVector(bookId: number): TFIDFVector {
    // Vérifier le cache
    if (this.vectorCache.has(bookId)) {
      return this.vectorCache.get(bookId)!;
    }

    // Récupérer les termes du livre
    const entries = this.db
      .prepare(
        `
      SELECT i.term, i.term_frequency, t.document_frequency, 
             (SELECT COUNT(*) FROM books) as total_books
      FROM inverted_index i
      JOIN term_stats t ON i.term = t.term
      WHERE i.book_id = ?
    `
      )
      .all(bookId) as Array<{
      term: string;
      term_frequency: number;
      document_frequency: number;
      total_books: number;
    }>;

    const vector = new Map<string, number>();
    let magnitudeSquared = 0;

    for (const entry of entries) {
      // TF-IDF = TF * IDF
      // TF = term_frequency (déjà normalisé dans l'index)
      // IDF = log(N / DF)
      const tf = entry.term_frequency;
      const idf = Math.log(entry.total_books / entry.document_frequency);
      const tfidf = tf * idf;

      vector.set(entry.term, tfidf);
      magnitudeSquared += tfidf * tfidf;
    }

    const magnitude = Math.sqrt(magnitudeSquared);

    const tfidfVector: TFIDFVector = {
      bookId,
      vector,
      magnitude,
    };

    // Cache le vecteur
    this.vectorCache.set(bookId, tfidfVector);

    return tfidfVector;
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs TF-IDF
   */
  private cosineSimilarity(vec1: TFIDFVector, vec2: TFIDFVector): number {
    if (vec1.magnitude === 0 || vec2.magnitude === 0) {
      return 0;
    }

    let dotProduct = 0;

    // Calculer le produit scalaire
    for (const [term, value1] of vec1.vector) {
      const value2 = vec2.vector.get(term);
      if (value2 !== undefined) {
        dotProduct += value1 * value2;
      }
    }

    // Similarité cosinus = dot product / (magnitude1 * magnitude2)
    return dotProduct / (vec1.magnitude * vec2.magnitude);
  }

  /**
   * Trouve les livres les plus similaires à un livre donné
   * @param bookId ID du livre de référence
   * @param limit Nombre de résultats à retourner
   * @param minSimilarity Similarité minimale (0-1)
   * @returns Liste de livres similaires avec leur score
   */
  findSimilarBooks(
    bookId: number,
    limit: number = RECOMMENDATION_DEFAULT_LIMIT,
    minSimilarity: number = RECOMMENDATION_JACCARD_THRESHOLD
  ): Array<{ bookId: number; similarity: number }> {
    // Calculer le vecteur du livre de référence
    const refVector = this.computeTFIDFVector(bookId);

    // Récupérer tous les autres livres
    const allBooks = this.db
      .prepare(
        `
      SELECT id FROM books WHERE id != ?
    `
      )
      .all(bookId) as Array<{ id: number }>;

    // Calculer la similarité avec chaque livre
    const similarities: Array<{ bookId: number; similarity: number }> = [];

    for (const book of allBooks) {
      const bookVector = this.computeTFIDFVector(book.id);
      const similarity = this.cosineSimilarity(refVector, bookVector);

      if (similarity >= minSimilarity) {
        similarities.push({
          bookId: book.id,
          similarity,
        });
      }
    }

    // Trier par similarité décroissante
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Retourner les top N
    return similarities.slice(0, limit);
  }

  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.vectorCache.clear();
  }
}
