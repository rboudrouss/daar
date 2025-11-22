/**
 * Calcul de la similarité de Jaccard et construction du graphe
 */

import { getDatabase, withTransaction } from '../db/connection.js';
import { IndexingProgress, JaccardEdge } from '../utils/types.js';

/**
 * Configuration pour le calcul de Jaccard
 */
export interface JaccardConfig {
  similarityThreshold: number; // Seuil minimum de similarité (ex: 0.05)
  topK: number; // Nombre maximum de voisins à garder par livre (ex: 50)
  batchSize: number; // Taille des batches pour l'insertion
}

/**
 * Calculateur de similarité Jaccard
 */
export class JaccardCalculator {
  private db;
  private config: JaccardConfig;

  constructor(config: Partial<JaccardConfig> = {}) {
    this.db = getDatabase();
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.05,
      topK: config.topK ?? 50,
      batchSize: config.batchSize ?? 1000,
    };
  }

  /**
   * Calcule la similarité de Jaccard entre deux ensembles de termes
   */
  private calculateJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Récupère les termes uniques d'un livre
   */
  private getBookTerms(bookId: number): Set<string> {
    const terms = this.db.prepare(`
      SELECT DISTINCT term FROM inverted_index WHERE book_id = ?
    `).all(bookId) as Array<{ term: string }>;

    return new Set(terms.map(t => t.term));
  }

  /**
   * Récupère tous les livres qui partagent au moins un terme avec le livre donné
   */
  private getCandidateBooks(bookId: number): Set<number> {
    const candidates = this.db.prepare(`
      SELECT DISTINCT i2.book_id
      FROM inverted_index i1
      JOIN inverted_index i2 ON i1.term = i2.term
      WHERE i1.book_id = ? AND i2.book_id != ?
    `).all(bookId, bookId) as Array<{ book_id: number }>;

    return new Set(candidates.map(c => c.book_id));
  }

  /**
   * Construit le graphe de Jaccard pour tous les livres
   */
  buildJaccardGraph(onProgress?: (progress: IndexingProgress) => void): number {
    console.log('\nBuilding Jaccard similarity graph...');
    console.log(`   Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Top-K neighbors: ${this.config.topK}\n`);

    // Récupérer tous les IDs de livres
    const books = this.db.prepare('SELECT id FROM books ORDER BY id').all() as Array<{ id: number }>;
    const bookIds = books.map(b => b.id);
    const totalBooks = bookIds.length;

    if (totalBooks < 2) {
      console.log('Not enough books to build graph (need at least 2)');
      return 0;
    }

    // Calculer le nombre total de paires
    const totalPairs = (totalBooks * (totalBooks - 1)) / 2;
    console.log(`Processing ${totalBooks} books (${totalPairs} potential pairs)...\n`);

    // Stocker toutes les similarités pour chaque livre (pour le Top-K)
    const allSimilarities = new Map<number, Array<{ bookId: number; similarity: number }>>();

    let processedPairs = 0;
    const startTime = Date.now();

    // Calculer les similarités
    for (let i = 0; i < totalBooks; i++) {
      const bookId1 = bookIds[i];
      const terms1 = this.getBookTerms(bookId1);

      // Optimisation : ne comparer qu'avec les livres qui partagent au moins un terme
      const candidates = this.getCandidateBooks(bookId1);

      for (const bookId2 of candidates) {
        if (bookId2 <= bookId1) continue; // Éviter les doublons et auto-comparaisons

        const terms2 = this.getBookTerms(bookId2);
        const similarity = this.calculateJaccardSimilarity(terms1, terms2);

        processedPairs++;

        // Ne garder que si au-dessus du seuil
        if (similarity >= this.config.similarityThreshold) {
          // Stocker pour les deux livres
          if (!allSimilarities.has(bookId1)) {
            allSimilarities.set(bookId1, []);
          }
          if (!allSimilarities.has(bookId2)) {
            allSimilarities.set(bookId2, []);
          }

          allSimilarities.get(bookId1)!.push({ bookId: bookId2, similarity });
          allSimilarities.get(bookId2)!.push({ bookId: bookId1, similarity });
        }
      }

      // Progression
      if (onProgress && (i + 1) % 10 === 0) {
        const percentage = ((i + 1) / totalBooks) * 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processedPairs / elapsed;
        const remaining = (totalPairs - processedPairs) / rate;

        onProgress({
          currentBook: i + 1,
          totalBooks,
          currentPhase: 'jaccard',
          message: `Processing book ${i + 1}/${totalBooks} (${processedPairs} pairs, ~${remaining.toFixed(0)}s remaining)`,
          percentage,
        });
      }
    }

    // Appliquer le Top-K et insérer dans la DB
    const edges = this.applyTopKAndInsert(allSimilarities);

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`\nJaccard graph built in ${elapsed.toFixed(2)}s`);
    console.log(`   Processed ${processedPairs} pairs`);
    console.log(`   Created ${edges} edges (avg ${(edges / totalBooks).toFixed(1)} per book)\n`);

    // Mettre à jour les métadonnées
    this.db.prepare(`
      UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'jaccard_edges'
    `).run(edges.toString());

    return edges;
  }

  /**
   * Applique le filtre Top-K et insère les arêtes dans la DB
   */
  private applyTopKAndInsert(
    allSimilarities: Map<number, Array<{ bookId: number; similarity: number }>>
  ): number {
    const edges: JaccardEdge[] = [];
    const processedPairs = new Set<string>();

    // Pour chaque livre, garder seulement les Top-K voisins
    for (const [bookId, neighbors] of allSimilarities.entries()) {
      // Trier par similarité décroissante et garder les Top-K
      const topNeighbors = neighbors
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, this.config.topK);

      // Créer les arêtes (en évitant les doublons)
      for (const { bookId: neighborId, similarity } of topNeighbors) {
        const pairKey = bookId < neighborId
          ? `${bookId}-${neighborId}`
          : `${neighborId}-${bookId}`;

        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          edges.push({
            bookId1: Math.min(bookId, neighborId),
            bookId2: Math.max(bookId, neighborId),
            similarity,
          });
        }
      }
    }

    // Insérer dans la DB par batches
    this.insertEdgesBatch(edges);

    return edges.length;
  }

  /**
   * Insère les arêtes dans la DB par batches
   */
  private insertEdgesBatch(edges: JaccardEdge[]): void {
    const insertEdge = this.db.prepare(`
      INSERT OR REPLACE INTO jaccard_edges (book_id_1, book_id_2, similarity)
      VALUES (?, ?, ?)
    `);

    const batchSize = this.config.batchSize;
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      withTransaction(() => {
        for (const edge of batch) {
          insertEdge.run(edge.bookId1, edge.bookId2, edge.similarity);
        }
      });
    }
  }
}

