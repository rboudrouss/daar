/**
 * Calcul de la similarité de Jaccard pondérée (IDF-weighted) et construction du graphe
 *
 * Optimisations implémentées:
 * 1. Jaccard pondéré par IDF (Inverse Document Frequency)
 * 2. Filtrage dynamique des termes trop fréquents (stop words dynamiques)
 * 3. Seuil minimum de termes partagés pour les candidats
 */

import { getDatabase, withTransaction } from "../db/connection.js";
import {
  JACCARD_DEFAULT_THRESHOLD,
  JACCARD_DEFAULT_TOP_K,
  JACCARD_DEFAULT_BATCH_SIZE,
  getJaccardMaxTermFrequency,
  getJaccardMinSharedTerms,
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
 * Calculateur de similarité Jaccard pondérée par IDF
 */
export class JaccardCalculator {
  private db;
  private config: JaccardConfig;
  private totalBooks: number = 0;
  private termDocFrequencies: Map<string, number> = new Map();

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
   * Charge les fréquences de documents pour tous les termes
   * Utilisé pour calculer IDF = log(N / df)
   */
  private loadTermDocFrequencies(): void {
    const startTime = Date.now();
    console.log("[DEBUG] Loading term document frequencies for IDF calculation...");

    // Get total number of books
    const countStart = Date.now();
    const result = this.db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number };
    this.totalBooks = result.count;
    console.log(`[DEBUG]    Book count query took ${Date.now() - countStart}ms`);

    if (this.totalBooks === 0) {
      console.log("[DEBUG] No books in database");
      return;
    }

    // Load document frequencies for all terms
    const termFreqStart = Date.now();
    const termFreqs = this.db
      .prepare(
        `
        SELECT term, COUNT(DISTINCT book_id) as doc_freq
        FROM inverted_index
        GROUP BY term
      `
      )
      .all() as Array<{ term: string; doc_freq: number }>;
    console.log(`[DEBUG]    Term frequencies SQL query took ${Date.now() - termFreqStart}ms`);

    const mapBuildStart = Date.now();
    this.termDocFrequencies.clear();
    for (const { term, doc_freq } of termFreqs) {
      this.termDocFrequencies.set(term, doc_freq);
    }
    console.log(`[DEBUG]    Building term frequency map took ${Date.now() - mapBuildStart}ms`);

    console.log(`[DEBUG]    Total: Loaded ${this.termDocFrequencies.size} term frequencies (${this.totalBooks} books) in ${Date.now() - startTime}ms`);
  }

  /**
   * Calcule l'IDF d'un terme
   * IDF = log(N / df) où N = nombre total de livres, df = nombre de livres contenant le terme
   */
  private calculateIDF(term: string): number {
    const docFreq = this.termDocFrequencies.get(term) || 1;
    return Math.log(this.totalBooks / docFreq);
  }

  /**
   * Vérifie si un terme doit être ignoré (trop fréquent)
   */
  private isTermTooFrequent(term: string, maxTermFrequency: number): boolean {
    const docFreq = this.termDocFrequencies.get(term) || 0;
    return docFreq / this.totalBooks > maxTermFrequency;
  }

  /**
   * Calcule la similarité de Jaccard pondérée par IDF entre deux ensembles de termes
   *
   * Formula: weighted_jaccard(A, B) = sum(IDF(term) for term in A ∩ B) / sum(IDF(term) for term in A ∪ B)
   *
   * @param terms1 - Terms from first book (with IDF pre-calculated)
   * @param terms2 - Terms from second book (with IDF pre-calculated)
   * @param maxTermFrequency - Maximum document frequency threshold (ignore more frequent terms)
   */
  private calculateWeightedJaccardSimilarity(
    terms1: Map<string, number>, // term -> IDF
    terms2: Map<string, number>, // term -> IDF
    maxTermFrequency: number
  ): number {
    let intersectionWeight = 0;
    let unionWeight = 0;

    // Use smaller set for iteration
    const [smallerMap, largerMap] =
      terms1.size < terms2.size ? [terms1, terms2] : [terms2, terms1];

    // Calculate intersection and add to union
    for (const [term, idf] of smallerMap) {
      // Skip terms that are too frequent
      if (this.isTermTooFrequent(term, maxTermFrequency)) continue;

      if (largerMap.has(term)) {
        intersectionWeight += idf;
      }
      unionWeight += idf;
    }

    // Add terms from larger set that are not in smaller set
    for (const [term, idf] of largerMap) {
      // Skip terms that are too frequent
      if (this.isTermTooFrequent(term, maxTermFrequency)) continue;

      if (!smallerMap.has(term)) {
        unionWeight += idf;
      }
    }

    if (unionWeight === 0) return 0;

    return intersectionWeight / unionWeight;
  }

  /**
   * Charge les termes d'un batch de livres avec leurs IDF précalculés
   * Filtre les termes trop fréquents
   */
  private loadBookTermsWithIDF(
    bookIds: number[],
    maxTermFrequency: number
  ): Map<number, Map<string, number>> {
    if (bookIds.length === 0) return new Map();

    const placeholders = bookIds.map(() => "?").join(",");
    const sqlStart = Date.now();
    const terms = this.db
      .prepare(
        `
        SELECT book_id, term FROM inverted_index
        WHERE book_id IN (${placeholders})
      `
      )
      .all(...bookIds) as Array<{ book_id: number; term: string }>;
    const sqlDuration = Date.now() - sqlStart;

    const mapBuildStart = Date.now();
    const bookTermsMap = new Map<number, Map<string, number>>();
    let skippedTerms = 0;
    let totalTerms = 0;

    for (const { book_id, term } of terms) {
      totalTerms++;
      // Skip terms that are too frequent
      if (this.isTermTooFrequent(term, maxTermFrequency)) {
        skippedTerms++;
        continue;
      }

      if (!bookTermsMap.has(book_id)) {
        bookTermsMap.set(book_id, new Map());
      }

      const idf = this.calculateIDF(term);
      bookTermsMap.get(book_id)!.set(term, idf);
    }
    const mapBuildDuration = Date.now() - mapBuildStart;

    if (bookIds.length > 10) {
      console.log(`[DEBUG]    loadBookTermsWithIDF: ${bookIds.length} books, ${terms.length} term rows - SQL: ${sqlDuration}ms, map build: ${mapBuildDuration}ms, skipped ${skippedTerms}/${totalTerms} terms`);
    }

    return bookTermsMap;
  }

  /**
   * Trouve les candidats pour un batch de livres avec filtrage dynamique
   *
   * Optimizations:
   * 1. Ignore terms present in >maxTermFrequency% of books (dynamic stop words)
   * 2. Only return pairs with at least minSharedTerms terms in common
   */
  private getCandidatesForBatchOptimized(
    bookIds: number[],
    maxTermFrequency: number,
    minSharedTerms: number
  ): Map<number, Set<number>> {
    if (bookIds.length === 0) return new Map();

    const startTime = Date.now();
    const placeholders = bookIds.map(() => "?").join(",");

    // Use CTE for dynamic filtering
    console.log(`[DEBUG]    getCandidatesForBatchOptimized: Starting SQL query for ${bookIds.length} books...`);
    const sqlStart = Date.now();
    const candidates = this.db
      .prepare(
        `
        WITH term_frequencies AS (
          SELECT term, COUNT(DISTINCT book_id) as doc_count
          FROM inverted_index
          GROUP BY term
        ),
        total_books AS (
          SELECT COUNT(*) as total FROM books
        ),
        valid_terms AS (
          SELECT tf.term
          FROM term_frequencies tf
          CROSS JOIN total_books tb
          WHERE CAST(tf.doc_count AS REAL) / tb.total <= ?
        )
        SELECT i1.book_id as book1, i2.book_id as book2, COUNT(DISTINCT i1.term) as shared_terms
        FROM inverted_index i1
        JOIN inverted_index i2 ON i1.term = i2.term
        JOIN valid_terms vt ON i1.term = vt.term
        WHERE i1.book_id IN (${placeholders})
          AND i1.book_id < i2.book_id
        GROUP BY i1.book_id, i2.book_id
        HAVING shared_terms >= ?
      `
      )
      .all(maxTermFrequency, ...bookIds, minSharedTerms) as Array<{
        book1: number;
        book2: number;
        shared_terms: number;
      }>;
    console.log(`[DEBUG]    getCandidatesForBatchOptimized: SQL query took ${Date.now() - sqlStart}ms, found ${candidates.length} candidate pairs`);

    const mapBuildStart = Date.now();
    const candidatesMap = new Map<number, Set<number>>();
    for (const bookId of bookIds) {
      candidatesMap.set(bookId, new Set());
    }

    for (const { book1, book2 } of candidates) {
      candidatesMap.get(book1)!.add(book2);
    }
    console.log(`[DEBUG]    getCandidatesForBatchOptimized: Map building took ${Date.now() - mapBuildStart}ms, total: ${Date.now() - startTime}ms`);

    return candidatesMap;
  }

  /**
   * Construit le graphe de Jaccard pondéré pour tous les livres (optimisé RAM + IDF)
   *
   * Optimizations:
   * 1. IDF-weighted Jaccard similarity
   * 2. Dynamic stop words filtering (ignore terms in >maxTermFrequency% of books)
   * 3. Minimum shared terms threshold
   * 4. Batch processing to limit RAM usage
   */
  buildJaccardGraph(onProgress?: (progress: IndexingProgress) => void): number {
    // Load configurable parameters
    const maxTermFrequency = getJaccardMaxTermFrequency();
    const minSharedTerms = getJaccardMinSharedTerms();

    console.log("\nBuilding IDF-weighted Jaccard similarity graph...");
    console.log(`   Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Top-K neighbors: ${this.config.topK}`);
    console.log(`   Max term frequency: ${(maxTermFrequency * 100).toFixed(0)}% (ignore more frequent terms)`);
    console.log(`   Min shared terms: ${minSharedTerms}`);
    console.log(`   Batch size: ${this.config.batchSize}\n`);

    const overallStartTime = Date.now();

    // Load term document frequencies for IDF calculation
    this.loadTermDocFrequencies();

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
      const batchLoopStart = Date.now();
      const batchEnd = Math.min(batchStart + PROCESSING_BATCH_SIZE, totalBooks);
      const currentBatch = bookIds.slice(batchStart, batchEnd);
      const batchNumber = Math.floor(batchStart / PROCESSING_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalBooks / PROCESSING_BATCH_SIZE);

      console.log(
        `\n[DEBUG] ========== Processing batch ${batchNumber}/${totalBatches} (books ${batchStart + 1}-${batchEnd}) ==========`
      );

      // Charger les termes du batch actuel avec IDF (filtrage des termes fréquents)
      console.log(`[DEBUG] Step 1: Loading terms for batch...`);
      const loadTermsStart = Date.now();
      const batchTermsMap = this.loadBookTermsWithIDF(currentBatch, maxTermFrequency);
      console.log(`[DEBUG] Step 1 completed in ${Date.now() - loadTermsStart}ms - loaded terms for ${batchTermsMap.size} books`);

      // Charger les candidats pour ce batch (avec filtrage dynamique)
      console.log(`[DEBUG] Step 2: Finding candidates for batch...`);
      const findCandidatesStart = Date.now();
      const batchCandidatesMap = this.getCandidatesForBatchOptimized(
        currentBatch,
        maxTermFrequency,
        minSharedTerms
      );
      const totalCandidates = Array.from(batchCandidatesMap.values()).reduce((sum, set) => sum + set.size, 0);
      console.log(`[DEBUG] Step 2 completed in ${Date.now() - findCandidatesStart}ms - found ${totalCandidates} total candidates`);

      // Calculer les similarités pour ce batch
      console.log(`[DEBUG] Step 3: Computing similarities...`);
      const computeStart = Date.now();
      let batchPairs = 0;
      let batchEdgesAdded = 0;
      let candidateChunksProcessed = 0;

      for (const bookId1 of currentBatch) {
        const terms1 = batchTermsMap.get(bookId1);
        if (!terms1 || terms1.size === 0) continue;

        const candidates = batchCandidatesMap.get(bookId1) || new Set();

        // Charger les termes des candidats (par petits groupes)
        const candidateIds = Array.from(candidates);
        for (let i = 0; i < candidateIds.length; i += 100) {
          const candidateChunk = candidateIds.slice(i, i + 100);
          const candidateTermsMap = this.loadBookTermsWithIDF(candidateChunk, maxTermFrequency);
          candidateChunksProcessed++;

          for (const bookId2 of candidateChunk) {
            if (bookId2 <= bookId1) continue;

            const terms2 = candidateTermsMap.get(bookId2);
            if (!terms2 || terms2.size === 0) continue;

            // Use IDF-weighted Jaccard similarity
            const similarity = this.calculateWeightedJaccardSimilarity(
              terms1,
              terms2,
              maxTermFrequency
            );
            processedPairs++;
            batchPairs++;

            if (similarity >= this.config.similarityThreshold) {
              batchEdgesAdded++;
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
      console.log(`[DEBUG] Step 3 completed in ${Date.now() - computeStart}ms - ${batchPairs} pairs computed, ${batchEdgesAdded} edges added, ${candidateChunksProcessed} candidate chunks`);
      console.log(`[DEBUG] Batch ${batchNumber} total time: ${Date.now() - batchLoopStart}ms`);
    }

    const calcElapsed = (Date.now() - startTime) / 1000;
    console.log(
      `\n[DEBUG] ========== Similarity calculation complete ==========`
    );
    console.log(
      `[DEBUG] Calculated ${processedPairs} similarities in ${calcElapsed.toFixed(2)}s`
    );

    // Clear edges and insert new ones
    console.log(`[DEBUG] Step 4: Clearing old edges...`);
    const clearStart = Date.now();
    this.db.prepare("DELETE FROM jaccard_edges").run();
    console.log(`[DEBUG] Step 4 completed in ${Date.now() - clearStart}ms`);

    // Appliquer le Top-K final et insérer dans la DB
    console.log(`[DEBUG] Step 5: Applying Top-K and inserting edges...`);
    const insertStart = Date.now();
    const edges = this.applyTopKAndInsert(allSimilarities);
    console.log(`[DEBUG] Step 5 completed in ${Date.now() - insertStart}ms`);

    const totalElapsed = (Date.now() - overallStartTime) / 1000;
    console.log(`\nIDF-weighted Jaccard graph built in ${totalElapsed.toFixed(2)}s`);
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
    const startTime = Date.now();
    console.log(`[DEBUG]    applyTopKAndInsert: Processing ${allSimilarities.size} books`);

    const edges: JaccardEdge[] = [];
    const processedPairs = new Set<string>();

    const sortStart = Date.now();
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
    console.log(`[DEBUG]    applyTopKAndInsert: Sorting and deduplication took ${Date.now() - sortStart}ms, ${edges.length} unique edges`);

    // Insérer dans la DB par batches
    const insertStart = Date.now();
    this.insertEdgesBatch(edges);
    console.log(`[DEBUG]    applyTopKAndInsert: DB insertion took ${Date.now() - insertStart}ms`);
    console.log(`[DEBUG]    applyTopKAndInsert: Total time ${Date.now() - startTime}ms`);

    return edges.length;
  }

  /**
   * Insère les arêtes dans la DB par batches
   */
  private insertEdgesBatch(edges: JaccardEdge[]): void {
    console.log(`[DEBUG]       insertEdgesBatch: Inserting ${edges.length} edges in batches of ${this.config.batchSize}`);
    const insertEdge = this.db.prepare(`
      INSERT OR REPLACE INTO jaccard_edges (book_id_1, book_id_2, similarity)
      VALUES (?, ?, ?)
    `);

    const batchSize = this.config.batchSize;
    let batchCount = 0;
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      withTransaction(() => {
        for (const edge of batch) {
          insertEdge.run(edge.bookId1, edge.bookId2, edge.similarity);
        }
      });
      batchCount++;
    }
    console.log(`[DEBUG]       insertEdgesBatch: Completed ${batchCount} batches`);
  }

  /**
   * Ajoute des livres au graphe de Jaccard pondéré de manière incrémentale
   *
   * Optimizations:
   * 1. IDF-weighted Jaccard similarity
   * 2. Dynamic stop words filtering (ignore terms in >maxTermFrequency% of books)
   * 3. Minimum shared terms threshold
   * 4. Only compare new books with existing books (not all pairs)
   */
  addBooksToJaccardGraph(
    newBookIds: number[],
    onProgress?: (progress: IndexingProgress) => void
  ): number {
    // Load configurable parameters
    const maxTermFrequency = getJaccardMaxTermFrequency();
    const minSharedTerms = getJaccardMinSharedTerms();

    console.log(
      `\nAdding ${newBookIds.length} books to IDF-weighted Jaccard graph (incremental)...`
    );
    console.log(`   Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Top-K neighbors: ${this.config.topK}`);
    console.log(`   Max term frequency: ${(maxTermFrequency * 100).toFixed(0)}% (ignore more frequent terms)`);
    console.log(`   Min shared terms: ${minSharedTerms}\n`);

    const overallStartTime = Date.now();

    if (newBookIds.length === 0) {
      console.log("No new books to add");
      return 0;
    }

    // Load term document frequencies for IDF calculation
    this.loadTermDocFrequencies();

    // Récupérer tous les IDs de livres existants (excluant les nouveaux)
    const allBooks = this.db
      .prepare("SELECT id FROM books ORDER BY id")
      .all() as Array<{ id: number }>;
    const allBookIds = allBooks.map((b) => b.id);
    const existingBookIds = allBookIds.filter((id) => !newBookIds.includes(id));

    console.log(`Comparing ${newBookIds.length} new books with ${existingBookIds.length} existing books...`);

    // Charger les termes de tous les nouveaux livres avec IDF
    console.log("Loading terms for new books (with IDF)...");
    const newBooksTermsMap = this.loadBookTermsWithIDF(newBookIds, maxTermFrequency);

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

      // Trouver les candidats avec filtrage dynamique
      const candidates = this.getCandidatesForNewBookOptimized(
        newBookId,
        existingBookIds,
        maxTermFrequency,
        minSharedTerms
      );

      // Charger les termes des candidats par chunks
      const candidateIds = Array.from(candidates);
      for (let i = 0; i < candidateIds.length; i += 100) {
        const candidateChunk = candidateIds.slice(i, i + 100);
        const candidateTermsMap = this.loadBookTermsWithIDF(candidateChunk, maxTermFrequency);

        for (const existingBookId of candidateChunk) {
          const existingBookTerms = candidateTermsMap.get(existingBookId);
          if (!existingBookTerms || existingBookTerms.size === 0) continue;

          // Use IDF-weighted Jaccard similarity
          const similarity = this.calculateWeightedJaccardSimilarity(
            newBookTerms,
            existingBookTerms,
            maxTermFrequency
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
    console.log(`\nIncremental IDF-weighted Jaccard update completed in ${totalElapsed.toFixed(2)}s`);
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
   * Trouve les candidats pour un nouveau livre avec filtrage dynamique
   *
   * Optimizations:
   * 1. Ignore terms present in >maxTermFrequency% of books (dynamic stop words)
   * 2. Only return books with at least minSharedTerms terms in common
   */
  private getCandidatesForNewBookOptimized(
    newBookId: number,
    existingBookIds: number[],
    maxTermFrequency: number,
    minSharedTerms: number
  ): Set<number> {
    if (existingBookIds.length === 0) return new Set();

    const placeholders = existingBookIds.map(() => "?").join(",");

    // Use CTE for dynamic filtering
    const candidates = this.db
      .prepare(
        `
        WITH term_frequencies AS (
          SELECT term, COUNT(DISTINCT book_id) as doc_count
          FROM inverted_index
          GROUP BY term
        ),
        total_books AS (
          SELECT COUNT(*) as total FROM books
        ),
        valid_terms AS (
          SELECT tf.term
          FROM term_frequencies tf
          CROSS JOIN total_books tb
          WHERE CAST(tf.doc_count AS REAL) / tb.total <= ?
        )
        SELECT i2.book_id, COUNT(DISTINCT i1.term) as shared_terms
        FROM inverted_index i1
        JOIN inverted_index i2 ON i1.term = i2.term
        JOIN valid_terms vt ON i1.term = vt.term
        WHERE i1.book_id = ?
          AND i2.book_id IN (${placeholders})
          AND i2.book_id != ?
        GROUP BY i2.book_id
        HAVING shared_terms >= ?
      `
      )
      .all(maxTermFrequency, newBookId, ...existingBookIds, newBookId, minSharedTerms) as Array<{
        book_id: number;
        shared_terms: number;
      }>;

    return new Set(candidates.map((c) => c.book_id));
  }
}
