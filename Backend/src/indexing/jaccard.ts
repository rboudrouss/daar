/**
 * Calcul de la similarité de Jaccard et construction du graphe
 */

import { getDatabase, withTransaction } from "../db/connection.js";
import {
  JACCARD_DEFAULT_THRESHOLD,
  JACCARD_DEFAULT_TOP_K,
  JACCARD_DEFAULT_BATCH_SIZE,
} from "../utils/const.js";
import { IndexingProgress, JaccardEdge } from "../utils/types.js";

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
      similarityThreshold:
        config.similarityThreshold ?? JACCARD_DEFAULT_THRESHOLD,
      topK: config.topK ?? JACCARD_DEFAULT_TOP_K,
      batchSize: config.batchSize ?? JACCARD_DEFAULT_BATCH_SIZE,
    };
  }

  /**
   * Calcule la similarité de Jaccard entre deux ensembles de termes
   */
  private calculateJaccardSimilarity(
    set1: Set<string>,
    set2: Set<string>
  ): number {
    const smallerSet = set1.size < set2.size ? set1 : set2;
    const largerSet = set1.size < set2.size ? set2 : set1;

    let intersectionSize = 0;
    for (const item of smallerSet) {
      if (largerSet.has(item)) {
        intersectionSize++;
      }
    }

    const unionSize = set1.size + set2.size - intersectionSize;
    if (unionSize === 0) return 0;

    return intersectionSize / unionSize;
  }

  /**
   * Pré-charge tous les termes de tous les livres en une seule requête
   * Retourne un Map<bookId, Set<term>>
   */
  private preloadAllBookTerms(): Map<number, Set<string>> {
    console.log("Preloading all book terms...");
    const startTime = Date.now();

    // Une seule requête pour TOUS les livres
    const allTerms = this.db
      .prepare(
        `
      SELECT book_id, term FROM inverted_index
      ORDER BY book_id
    `
      )
      .all() as Array<{ book_id: number; term: string }>;

    // Construire le Map
    const bookTermsMap = new Map<number, Set<string>>();
    for (const { book_id, term } of allTerms) {
      if (!bookTermsMap.has(book_id)) {
        bookTermsMap.set(book_id, new Set());
      }
      bookTermsMap.get(book_id)!.add(term);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(
      `Preloaded ${allTerms.length} terms for ${bookTermsMap.size} books in ${elapsed.toFixed(2)}s\n`
    );

    return bookTermsMap;
  }

  /**
   * Pré-calcule toutes les paires de livres candidats en une seule requête
   * Retourne un Map<bookId, Set<candidateBookId>>
   */
  private preloadAllCandidates(bookIds: number[]): Map<number, Set<number>> {
    console.log("Preloading candidate pairs...");
    const startTime = Date.now();

    // Une seule requête pour TOUTES les paires de candidats
    const allCandidates = this.db
      .prepare(
        `
      SELECT i1.book_id as book1, i2.book_id as book2
      FROM inverted_index i1
      JOIN inverted_index i2 ON i1.term = i2.term
      WHERE i1.book_id < i2.book_id
      GROUP BY i1.book_id, i2.book_id
    `
      )
      .all() as Array<{ book1: number; book2: number }>;

    // Construire le Map bidirectionnel
    const candidatesMap = new Map<number, Set<number>>();

    // Initialiser tous les livres
    for (const bookId of bookIds) {
      candidatesMap.set(bookId, new Set());
    }

    // Remplir les candidats (bidirectionnel)
    for (const { book1, book2 } of allCandidates) {
      candidatesMap.get(book1)!.add(book2);
      candidatesMap.get(book2)!.add(book1);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const totalPairs = allCandidates.length;
    console.log(
      `Preloaded ${totalPairs} candidate pairs in ${elapsed.toFixed(2)}s\n`
    );

    return candidatesMap;
  }

  /**
   * Construit le graphe de Jaccard pour tous les livres
   */
  buildJaccardGraph(onProgress?: (progress: IndexingProgress) => void): number {
    console.log("\nBuilding Jaccard similarity graph...");
    console.log(`   Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Top-K neighbors: ${this.config.topK}\n`);

    const overallStartTime = Date.now();

    // Récupérer tous les IDs de livres
    const books = this.db
      .prepare("SELECT id FROM books ORDER BY id")
      .all() as Array<{ id: number }>;
    const bookIds = books.map((b) => b.id);
    const totalBooks = bookIds.length;

    if (totalBooks < 2) {
      console.log("Not enough books to build graph (need at least 2)");
      return 0;
    }

    console.log(`Processing ${totalBooks} books...\n`);

    const bookTermsMap = this.preloadAllBookTerms();

    const candidatesMap = this.preloadAllCandidates(bookIds);

    const allSimilarities = new Map<
      number,
      Array<{ bookId: number; similarity: number }>
    >();

    let processedPairs = 0;
    const startTime = Date.now();

    console.log("Calculating Jaccard similarities...");

    // Calculer les similarités
    for (let i = 0; i < totalBooks; i++) {
      const bookId1 = bookIds[i];
      const terms1 = bookTermsMap.get(bookId1);

      if (!terms1 || terms1.size === 0) continue;

      // Récupérer les candidats pré-calculés
      const candidates = candidatesMap.get(bookId1) || new Set();

      for (const bookId2 of candidates) {
        if (bookId2 <= bookId1) continue; // Éviter les doublons et auto-comparaisons

        const terms2 = bookTermsMap.get(bookId2);
        if (!terms2 || terms2.size === 0) continue;

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
        const estimatedTotal = (processedPairs / (i + 1)) * totalBooks;
        const remaining = (estimatedTotal - processedPairs) / rate;

        onProgress({
          currentBook: i + 1,
          totalBooks,
          currentPhase: "jaccard",
          message: `Processing book ${i + 1}/${totalBooks} (${processedPairs} pairs, ~${remaining.toFixed(0)}s remaining)`,
          percentage,
        });
      }
    }

    const calcElapsed = (Date.now() - startTime) / 1000;
    console.log(
      `\nCalculated ${processedPairs} similarities in ${calcElapsed.toFixed(2)}s`
    );

    // Appliquer le Top-K et insérer dans la DB
    const edges = this.applyTopKAndInsert(allSimilarities);

    const totalElapsed = (Date.now() - overallStartTime) / 1000;
    console.log(`\nJaccard graph built in ${totalElapsed.toFixed(2)}s`);
    console.log(`   Processed ${processedPairs} pairs`);
    console.log(
      `   Created ${edges} edges (avg ${(edges / totalBooks).toFixed(1)} per book)\n`
    );

    // Mettre à jour les métadonnées
    this.db
      .prepare(
        `
      UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'jaccard_edges'
    `
      )
      .run(edges.toString());

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
        const pairKey =
          bookId < neighborId
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
