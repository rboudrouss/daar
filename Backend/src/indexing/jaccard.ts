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
   * Charge les termes d'un batch de livres (optimisé pour la RAM)
   */
  private loadBookTermsBatch(bookIds: number[]): Map<number, Set<string>> {
    if (bookIds.length === 0) return new Map();

    const placeholders = bookIds.map(() => "?").join(",");
    const terms = this.db
      .prepare(
        `
      SELECT book_id, term FROM inverted_index
      WHERE book_id IN (${placeholders})
    `
      )
      .all(...bookIds) as Array<{ book_id: number; term: string }>;

    const bookTermsMap = new Map<number, Set<string>>();
    for (const { book_id, term } of terms) {
      if (!bookTermsMap.has(book_id)) {
        bookTermsMap.set(book_id, new Set());
      }
      bookTermsMap.get(book_id)!.add(term);
    }

    return bookTermsMap;
  }

  /**
   * Trouve les candidats pour un batch de livres (optimisé pour la RAM)
   */
  private getCandidatesForBatch(bookIds: number[]): Map<number, Set<number>> {
    if (bookIds.length === 0) return new Map();

    const placeholders = bookIds.map(() => "?").join(",");
    const candidates = this.db
      .prepare(
        `
      SELECT i1.book_id as book1, i2.book_id as book2
      FROM inverted_index i1
      JOIN inverted_index i2 ON i1.term = i2.term
      WHERE i1.book_id IN (${placeholders})
        AND i1.book_id < i2.book_id
      GROUP BY i1.book_id, i2.book_id
    `
      )
      .all(...bookIds) as Array<{ book1: number; book2: number }>;

    const candidatesMap = new Map<number, Set<number>>();
    for (const bookId of bookIds) {
      candidatesMap.set(bookId, new Set());
    }

    for (const { book1, book2 } of candidates) {
      candidatesMap.get(book1)!.add(book2);
    }

    return candidatesMap;
  }

  /**
   * Construit le graphe de Jaccard pour tous les livres (optimisé RAM)
   * Traite les livres par batches et applique Top-K progressivement
   */
  buildJaccardGraph(onProgress?: (progress: IndexingProgress) => void): number {
    console.log("\nBuilding Jaccard similarity graph (RAM-optimized)...");
    console.log(`   Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Top-K neighbors: ${this.config.topK}`);
    console.log(`   Batch size: ${this.config.batchSize}\n`);

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

    console.log(`Processing ${totalBooks} books in batches...\n`);

    // Stocker seulement les Top-K similarités par livre (limite la RAM)
    const allSimilarities = new Map<
      number,
      Array<{ bookId: number; similarity: number }>
    >();

    let processedPairs = 0;
    let processedBooks = 0;
    const startTime = Date.now();

    // Traiter par batches pour économiser la RAM
    const PROCESSING_BATCH_SIZE = 50; // Traiter 50 livres à la fois

    for (
      let batchStart = 0;
      batchStart < totalBooks;
      batchStart += PROCESSING_BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + PROCESSING_BATCH_SIZE, totalBooks);
      const currentBatch = bookIds.slice(batchStart, batchEnd);

      console.log(
        `Processing batch ${Math.floor(batchStart / PROCESSING_BATCH_SIZE) + 1}/${Math.ceil(totalBooks / PROCESSING_BATCH_SIZE)} (books ${batchStart + 1}-${batchEnd})...`
      );

      // Charger les termes du batch actuel
      const batchTermsMap = this.loadBookTermsBatch(currentBatch);

      // Charger les candidats pour ce batch
      const batchCandidatesMap = this.getCandidatesForBatch(currentBatch);

      // Calculer les similarités pour ce batch
      for (const bookId1 of currentBatch) {
        const terms1 = batchTermsMap.get(bookId1);
        if (!terms1 || terms1.size === 0) continue;

        const candidates = batchCandidatesMap.get(bookId1) || new Set();

        // Charger les termes des candidats (par petits groupes)
        const candidateIds = Array.from(candidates);
        for (let i = 0; i < candidateIds.length; i += 100) {
          const candidateChunk = candidateIds.slice(i, i + 100);
          const candidateTermsMap = this.loadBookTermsBatch(candidateChunk);

          for (const bookId2 of candidateChunk) {
            if (bookId2 <= bookId1) continue;

            const terms2 = candidateTermsMap.get(bookId2);
            if (!terms2 || terms2.size === 0) continue;

            const similarity = this.calculateJaccardSimilarity(terms1, terms2);
            processedPairs++;

            if (similarity >= this.config.similarityThreshold) {
              if (!allSimilarities.has(bookId1)) {
                allSimilarities.set(bookId1, []);
              }
              if (!allSimilarities.has(bookId2)) {
                allSimilarities.set(bookId2, []);
              }

              const neighbors1 = allSimilarities.get(bookId1)!;
              const neighbors2 = allSimilarities.get(bookId2)!;

              neighbors1.push({ bookId: bookId2, similarity });
              neighbors2.push({ bookId: bookId1, similarity });

              // Appliquer Top-K progressivement pour limiter la RAM
              if (neighbors1.length > this.config.topK * 2) {
                neighbors1.sort((a, b) => b.similarity - a.similarity);
                allSimilarities.set(
                  bookId1,
                  neighbors1.slice(0, this.config.topK)
                );
              }
              if (neighbors2.length > this.config.topK * 2) {
                neighbors2.sort((a, b) => b.similarity - a.similarity);
                allSimilarities.set(
                  bookId2,
                  neighbors2.slice(0, this.config.topK)
                );
              }
            }
          }
        }

        processedBooks++;

        // Progression
        if (onProgress && processedBooks % 10 === 0) {
          const percentage = (processedBooks / totalBooks) * 100;
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = processedBooks / elapsed;
          const remaining = (totalBooks - processedBooks) / rate;

          onProgress({
            currentBook: processedBooks,
            totalBooks,
            currentPhase: "jaccard",
            message: `Processing book ${processedBooks}/${totalBooks} (${processedPairs} pairs, ~${remaining.toFixed(0)}s remaining)`,
            percentage,
          });
        }
      }
    }

    const calcElapsed = (Date.now() - startTime) / 1000;
    console.log(
      `\nCalculated ${processedPairs} similarities in ${calcElapsed.toFixed(2)}s`
    );

    // Appliquer le Top-K final et insérer dans la DB
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

  /**
   * Ajoute des livres au graphe de Jaccard de manière incrémentale
   * Compare uniquement les nouveaux livres avec les livres existants
   * Beaucoup plus rapide que de reconstruire tout le graphe
   */
  addBooksToJaccardGraph(
    newBookIds: number[],
    onProgress?: (progress: IndexingProgress) => void
  ): number {
    console.log(
      `\nAdding ${newBookIds.length} books to Jaccard graph (incremental)...`
    );
    console.log(`   Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Top-K neighbors: ${this.config.topK}\n`);

    const overallStartTime = Date.now();

    if (newBookIds.length === 0) {
      console.log("No new books to add");
      return 0;
    }

    // Récupérer tous les IDs de livres existants (excluant les nouveaux)
    const allBooks = this.db
      .prepare("SELECT id FROM books ORDER BY id")
      .all() as Array<{ id: number }>;
    const allBookIds = allBooks.map((b) => b.id);
    const existingBookIds = allBookIds.filter((id) => !newBookIds.includes(id));

    console.log(`Comparing ${newBookIds.length} new books with ${existingBookIds.length} existing books...`);

    // Charger les termes de tous les nouveaux livres en une seule fois (optimisation)
    console.log("Loading terms for new books...");
    const newBooksTermsMap = this.loadBookTermsBatch(newBookIds);

    // Stocker les similarités pour mise à jour Top-K
    const allSimilarities = new Map<
      number,
      Array<{ bookId: number; similarity: number }>
    >();

    // Charger les Top-K existants pour tous les livres
    console.log("Loading existing Top-K neighbors...");
    const existingEdges = this.db
      .prepare(
        `
      SELECT book_id_1, book_id_2, similarity FROM jaccard_edges
    `
      )
      .all() as Array<{
      book_id_1: number;
      book_id_2: number;
      similarity: number;
    }>;

    // Initialiser allSimilarities avec les arêtes existantes
    for (const edge of existingEdges) {
      if (!allSimilarities.has(edge.book_id_1)) {
        allSimilarities.set(edge.book_id_1, []);
      }
      if (!allSimilarities.has(edge.book_id_2)) {
        allSimilarities.set(edge.book_id_2, []);
      }
      allSimilarities
        .get(edge.book_id_1)!
        .push({ bookId: edge.book_id_2, similarity: edge.similarity });
      allSimilarities
        .get(edge.book_id_2)!
        .push({ bookId: edge.book_id_1, similarity: edge.similarity });
    }

    let processedPairs = 0;
    let processedBooks = 0;
    const startTime = Date.now();

    // Pour chaque nouveau livre
    for (const newBookId of newBookIds) {
      const newBookTerms = newBooksTermsMap.get(newBookId);
      if (!newBookTerms || newBookTerms.size === 0) continue;

      // Initialiser la liste de voisins pour ce nouveau livre
      if (!allSimilarities.has(newBookId)) {
        allSimilarities.set(newBookId, []);
      }

      // Trouver les candidats (livres existants qui partagent au moins un terme)
      const candidates = this.getCandidatesForNewBook(newBookId, existingBookIds);

      // Charger les termes des candidats par chunks
      const candidateIds = Array.from(candidates);
      for (let i = 0; i < candidateIds.length; i += 100) {
        const candidateChunk = candidateIds.slice(i, i + 100);
        const candidateTermsMap = this.loadBookTermsBatch(candidateChunk);

        for (const existingBookId of candidateChunk) {
          const existingBookTerms = candidateTermsMap.get(existingBookId);
          if (!existingBookTerms || existingBookTerms.size === 0) continue;

          const similarity = this.calculateJaccardSimilarity(
            newBookTerms,
            existingBookTerms
          );
          processedPairs++;

          if (similarity >= this.config.similarityThreshold) {
            // Ajouter aux voisins du nouveau livre
            allSimilarities.get(newBookId)!.push({
              bookId: existingBookId,
              similarity,
            });

            // Ajouter aux voisins du livre existant
            if (!allSimilarities.has(existingBookId)) {
              allSimilarities.set(existingBookId, []);
            }
            allSimilarities.get(existingBookId)!.push({
              bookId: newBookId,
              similarity,
            });
          }
        }
      }

      processedBooks++;

      // Progression
      if (onProgress && processedBooks % 5 === 0) {
        const percentage = (processedBooks / newBookIds.length) * 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processedBooks / elapsed;
        const remaining = (newBookIds.length - processedBooks) / rate;

        onProgress({
          currentBook: processedBooks,
          totalBooks: newBookIds.length,
          currentPhase: "jaccard",
          message: `Processing new book ${processedBooks}/${newBookIds.length} (${processedPairs} pairs, ~${remaining.toFixed(0)}s remaining)`,
          percentage,
        });
      }
    }

    const calcElapsed = (Date.now() - startTime) / 1000;
    console.log(
      `\nCalculated ${processedPairs} similarities in ${calcElapsed.toFixed(2)}s`
    );

    // Supprimer toutes les anciennes arêtes et recréer avec Top-K
    console.log("Applying Top-K and updating database...");
    this.db.prepare("DELETE FROM jaccard_edges").run();
    const edges = this.applyTopKAndInsert(allSimilarities);

    const totalElapsed = (Date.now() - overallStartTime) / 1000;
    console.log(`\nIncremental Jaccard update completed in ${totalElapsed.toFixed(2)}s`);
    console.log(`   Processed ${processedPairs} pairs`);
    console.log(`   Total edges: ${edges}\n`);

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
   * Trouve les candidats pour un nouveau livre (livres existants qui partagent au moins un terme)
   */
  private getCandidatesForNewBook(
    newBookId: number,
    existingBookIds: number[]
  ): Set<number> {
    if (existingBookIds.length === 0) return new Set();

    const placeholders = existingBookIds.map(() => "?").join(",");
    const candidates = this.db
      .prepare(
        `
      SELECT DISTINCT i2.book_id
      FROM inverted_index i1
      JOIN inverted_index i2 ON i1.term = i2.term
      WHERE i1.book_id = ?
        AND i2.book_id IN (${placeholders})
        AND i2.book_id != ?
    `
      )
      .all(newBookId, ...existingBookIds, newBookId) as Array<{
      book_id: number;
    }>;

    return new Set(candidates.map((c) => c.book_id));
  }
}
