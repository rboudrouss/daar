/**
 * Calcul de la similarité de Jaccard pondérée (IDF-weighted) et construction du graphe
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

/** Taille des batches pour le traitement */
const PROCESSING_BATCH_SIZE = 50;
const CANDIDATE_CHUNK_SIZE = 100;

interface JaccardConfig {
  similarityThreshold: number;
  topK: number;
  batchSize: number;
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

  /** Charge les fréquences de documents pour le calcul IDF */
  private loadTermDocFrequencies(): void {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM books")
      .get() as { count: number };
    this.totalBooks = result.count;

    if (this.totalBooks === 0) return;

    const termFreqs = this.db
      .prepare(
        `
        SELECT term, COUNT(DISTINCT book_id) as doc_freq
        FROM inverted_index
        GROUP BY term
      `
      )
      .all() as Array<{ term: string; doc_freq: number }>;

    this.termDocFrequencies.clear();
    for (const { term, doc_freq } of termFreqs) {
      this.termDocFrequencies.set(term, doc_freq);
    }
  }

  /** Calcule l'IDF d'un terme: log(N / df) */
  private calculateIDF(term: string): number {
    const docFreq = this.termDocFrequencies.get(term) || 1;
    return Math.log(this.totalBooks / docFreq);
  }

  /** Vérifie si un terme est trop fréquent (stop word dynamique) */
  private isTermTooFrequent(term: string, maxTermFrequency: number): boolean {
    const docFreq = this.termDocFrequencies.get(term) || 0;
    return docFreq / this.totalBooks > maxTermFrequency;
  }

  /**
   * Calcule la similarité de Jaccard pondérée par IDF
   * Formula: sum(IDF(term) for term in A ∩ B) / sum(IDF(term) for term in A ∪ B)
   */
  private calculateWeightedJaccardSimilarity(
    terms1: Map<string, number>,
    terms2: Map<string, number>,
    maxTermFrequency: number
  ): number {
    let intersectionWeight = 0;
    let unionWeight = 0;

    const [smallerMap, largerMap] =
      terms1.size < terms2.size ? [terms1, terms2] : [terms2, terms1];

    for (const [term, idf] of smallerMap) {
      if (this.isTermTooFrequent(term, maxTermFrequency)) continue;
      if (largerMap.has(term)) intersectionWeight += idf;
      unionWeight += idf;
    }

    for (const [term, idf] of largerMap) {
      if (this.isTermTooFrequent(term, maxTermFrequency)) continue;
      if (!smallerMap.has(term)) unionWeight += idf;
    }

    return unionWeight === 0 ? 0 : intersectionWeight / unionWeight;
  }

  /**
   * Traite les candidats pour un livre donné et calcule les similarités
   * @returns le nombre de paires traitées
   */
  private processBookCandidates(
    bookId: number,
    bookTerms: Map<string, number>,
    candidateIds: number[],
    allSimilarities: Map<number, Array<{ bookId: number; similarity: number }>>,
    maxTermFrequency: number,
    shouldProcess: (candidateId: number) => boolean
  ): number {
    let processedPairs = 0;

    for (let i = 0; i < candidateIds.length; i += CANDIDATE_CHUNK_SIZE) {
      const candidateChunk = candidateIds.slice(i, i + CANDIDATE_CHUNK_SIZE);
      const candidateTermsMap = this.loadBookTermsWithIDF(
        candidateChunk,
        maxTermFrequency
      );

      for (const candidateId of candidateChunk) {
        if (!shouldProcess(candidateId)) continue;

        const candidateTerms = candidateTermsMap.get(candidateId);
        if (!candidateTerms || candidateTerms.size === 0) continue;

        const similarity = this.calculateWeightedJaccardSimilarity(
          bookTerms,
          candidateTerms,
          maxTermFrequency
        );
        processedPairs++;

        if (similarity >= this.config.similarityThreshold) {
          this.addSimilarity(allSimilarities, bookId, candidateId, similarity);
        }
      }
    }

    return processedPairs;
  }

  /** Charge les termes d'un batch de livres avec leurs IDF */
  private loadBookTermsWithIDF(
    bookIds: number[],
    maxTermFrequency: number
  ): Map<number, Map<string, number>> {
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

    const bookTermsMap = new Map<number, Map<string, number>>();

    for (const { book_id, term } of terms) {
      if (this.isTermTooFrequent(term, maxTermFrequency)) continue;

      if (!bookTermsMap.has(book_id)) {
        bookTermsMap.set(book_id, new Map());
      }
      bookTermsMap.get(book_id)!.set(term, this.calculateIDF(term));
    }

    return bookTermsMap;
  }

  /** Trouve les candidats pour un batch de livres avec filtrage dynamique */
  private getCandidatesForBatch(
    bookIds: number[],
    maxTermFrequency: number,
    minSharedTerms: number
  ): Map<number, Set<number>> {
    if (bookIds.length === 0) return new Map();

    // Pre-compute max doc frequency threshold
    const maxDocFreq = Math.floor(this.totalBooks * maxTermFrequency);

    const placeholders = bookIds.map(() => "?").join(",");
    const candidates = this.db
      .prepare(
        `
        WITH batch_terms AS (
          SELECT term, book_id
          FROM inverted_index
          WHERE book_id IN (${placeholders})
        )
        SELECT bt.book_id as book1, i2.book_id as book2, COUNT(*) as shared_terms
        FROM batch_terms bt
        JOIN term_stats ts ON bt.term = ts.term AND ts.document_frequency <= ?
        JOIN inverted_index i2 ON bt.term = i2.term AND bt.book_id < i2.book_id
        GROUP BY bt.book_id, i2.book_id
        HAVING shared_terms >= ?
      `
      )
      .all(...bookIds, maxDocFreq, minSharedTerms) as Array<{
      book1: number;
      book2: number;
      shared_terms: number;
    }>;

    const candidatesMap = new Map<number, Set<number>>();
    for (const bookId of bookIds) {
      candidatesMap.set(bookId, new Set());
    }
    for (const { book1, book2 } of candidates) {
      candidatesMap.get(book1)!.add(book2);
    }

    return candidatesMap;
  }

  /** Construit le graphe de Jaccard pondéré pour tous les livres */
  buildJaccardGraph(onProgress?: (progress: IndexingProgress) => void): number {
    const maxTermFrequency = getJaccardMaxTermFrequency();
    const minSharedTerms = getJaccardMinSharedTerms();

    console.log("\nBuilding IDF-weighted Jaccard similarity graph...");
    console.log(
      `   Threshold: ${this.config.similarityThreshold}, Top-K: ${this.config.topK}`
    );
    console.log(
      `   Max term frequency: ${(maxTermFrequency * 100).toFixed(0)}%, Min shared terms: ${minSharedTerms}\n`
    );

    const startTime = Date.now();
    this.loadTermDocFrequencies();

    const bookIds = (
      this.db.prepare("SELECT id FROM books ORDER BY id").all() as Array<{
        id: number;
      }>
    ).map((b) => b.id);
    const totalBooks = bookIds.length;

    if (totalBooks < 2) {
      console.log("Not enough books to build graph (need at least 2)");
      return 0;
    }

    console.log(`Processing ${totalBooks} books...\n`);

    const allSimilarities = new Map<
      number,
      Array<{ bookId: number; similarity: number }>
    >();
    let processedPairs = 0;
    let processedBooks = 0;

    // Traiter par batches
    for (
      let batchStart = 0;
      batchStart < totalBooks;
      batchStart += PROCESSING_BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + PROCESSING_BATCH_SIZE, totalBooks);
      const currentBatch = bookIds.slice(batchStart, batchEnd);

      const batchTermsMap = this.loadBookTermsWithIDF(
        currentBatch,
        maxTermFrequency
      );
      const batchCandidatesMap = this.getCandidatesForBatch(
        currentBatch,
        maxTermFrequency,
        minSharedTerms
      );

      for (const bookId1 of currentBatch) {
        const terms1 = batchTermsMap.get(bookId1);
        if (!terms1 || terms1.size === 0) continue;

        const candidates = batchCandidatesMap.get(bookId1) || new Set<number>();
        const candidateIds = Array.from(candidates);

        processedPairs += this.processBookCandidates(
          bookId1,
          terms1,
          candidateIds,
          allSimilarities,
          maxTermFrequency,
          (id) => id > bookId1 // only process pairs where bookId2 > bookId1
        );

        processedBooks++;
        this.reportProgress(
          onProgress,
          processedBooks,
          totalBooks,
          processedPairs,
          startTime
        );
      }
    }

    this.db.prepare("DELETE FROM jaccard_edges").run();
    const edges = this.applyTopKAndInsert(allSimilarities);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `\nJaccard graph built in ${elapsed}s - ${processedPairs} pairs, ${edges} edges\n`
    );

    this.updateMetadata(edges);
    return edges;
  }

  /** Ajoute une similarité bidirectionnelle avec limitation Top-K */
  private addSimilarity(
    similarities: Map<number, Array<{ bookId: number; similarity: number }>>,
    bookId1: number,
    bookId2: number,
    similarity: number
  ): void {
    if (!similarities.has(bookId1)) similarities.set(bookId1, []);
    if (!similarities.has(bookId2)) similarities.set(bookId2, []);

    const neighbors1 = similarities.get(bookId1)!;
    const neighbors2 = similarities.get(bookId2)!;

    neighbors1.push({ bookId: bookId2, similarity });
    neighbors2.push({ bookId: bookId1, similarity });

    // Limiter la RAM en appliquant Top-K progressivement
    if (neighbors1.length > this.config.topK * 2) {
      neighbors1.sort((a, b) => b.similarity - a.similarity);
      similarities.set(bookId1, neighbors1.slice(0, this.config.topK));
    }
    if (neighbors2.length > this.config.topK * 2) {
      neighbors2.sort((a, b) => b.similarity - a.similarity);
      similarities.set(bookId2, neighbors2.slice(0, this.config.topK));
    }
  }

  /** Rapporte la progression */
  private reportProgress(
    onProgress: ((progress: IndexingProgress) => void) | undefined,
    processedBooks: number,
    totalBooks: number,
    processedPairs: number,
    startTime: number
  ): void {
    if (!onProgress || processedBooks % 10 !== 0) return;

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processedBooks / elapsed;
    const remaining = (totalBooks - processedBooks) / rate;

    onProgress({
      currentBook: processedBooks,
      totalBooks,
      currentPhase: "jaccard",
      message: `Processing ${processedBooks}/${totalBooks} (${processedPairs} pairs, ~${remaining.toFixed(0)}s remaining)`,
      percentage: (processedBooks / totalBooks) * 100,
    });
  }

  /** Applique le filtre Top-K et insère les arêtes dans la DB */
  private applyTopKAndInsert(
    allSimilarities: Map<number, Array<{ bookId: number; similarity: number }>>
  ): number {
    const edges: JaccardEdge[] = [];
    const processedPairs = new Set<string>();

    for (const [bookId, neighbors] of allSimilarities.entries()) {
      const topNeighbors = neighbors
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, this.config.topK);

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

    this.insertEdgesBatch(edges);
    return edges.length;
  }

  /** Insère les arêtes dans la DB par batches */
  private insertEdgesBatch(edges: JaccardEdge[]): void {
    const insertEdge = this.db.prepare(`
      INSERT OR REPLACE INTO jaccard_edges (book_id_1, book_id_2, similarity)
      VALUES (?, ?, ?)
    `);

    for (let i = 0; i < edges.length; i += this.config.batchSize) {
      const batch = edges.slice(i, i + this.config.batchSize);
      withTransaction(() => {
        for (const edge of batch) {
          insertEdge.run(edge.bookId1, edge.bookId2, edge.similarity);
        }
      });
    }
  }

  /** Met à jour les métadonnées */
  private updateMetadata(edges: number): void {
    this.db
      .prepare(
        `UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'jaccard_edges'`
      )
      .run(edges.toString());
  }

  /** Ajoute des livres au graphe de Jaccard de manière incrémentale */
  addBooksToJaccardGraph(
    newBookIds: number[],
    onProgress?: (progress: IndexingProgress) => void
  ): number {
    const maxTermFrequency = getJaccardMaxTermFrequency();
    const minSharedTerms = getJaccardMinSharedTerms();

    console.log(
      `\nAdding ${newBookIds.length} books to Jaccard graph (incremental)...`
    );
    console.log(
      `   Threshold: ${this.config.similarityThreshold}, Top-K: ${this.config.topK}\n`
    );

    if (newBookIds.length === 0) {
      console.log("No new books to add");
      return 0;
    }

    const startTime = Date.now();
    let debugtime = Date.now();
    this.loadTermDocFrequencies();

    const allBookIds = (
      this.db.prepare("SELECT id FROM books ORDER BY id").all() as Array<{
        id: number;
      }>
    ).map((b) => b.id);
    const existingBookIds = allBookIds.filter((id) => !newBookIds.includes(id));

    console.log(
      `Comparing ${newBookIds.length} new books with ${existingBookIds.length} existing books...`
    );

    const newBooksTermsMap = this.loadBookTermsWithIDF(
      newBookIds,
      maxTermFrequency
    );
    const allSimilarities = this.loadExistingEdges();

    let processedPairs = 0;
    let processedBooks = 0;

    for (const newBookId of newBookIds) {
      const newBookTerms = newBooksTermsMap.get(newBookId);
      if (!newBookTerms || newBookTerms.size === 0) continue;

      if (!allSimilarities.has(newBookId)) {
        allSimilarities.set(newBookId, []);
      }

      const candidates = this.getCandidatesForNewBook(
        newBookId,
        existingBookIds,
        maxTermFrequency,
        minSharedTerms
      );
      const candidateIds = Array.from(candidates);

      processedPairs += this.processBookCandidates(
        newBookId,
        newBookTerms,
        candidateIds,
        allSimilarities,
        maxTermFrequency,
        () => true // process all candidates
      );

      processedBooks++;
      this.reportProgressIncremental(
        onProgress,
        processedBooks,
        newBookIds.length,
        processedPairs,
        startTime
      );
    }

    this.db.prepare("DELETE FROM jaccard_edges").run();
    const edges = this.applyTopKAndInsert(allSimilarities);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `\nIncremental update completed in ${elapsed}s - ${processedPairs} pairs, ${edges} edges\n`
    );

    this.updateMetadata(edges);
    return edges;
  }

  /** Charge les arêtes existantes */
  private loadExistingEdges(): Map<
    number,
    Array<{ bookId: number; similarity: number }>
  > {
    const existingEdges = this.db
      .prepare(`SELECT book_id_1, book_id_2, similarity FROM jaccard_edges`)
      .all() as Array<{
      book_id_1: number;
      book_id_2: number;
      similarity: number;
    }>;

    const similarities = new Map<
      number,
      Array<{ bookId: number; similarity: number }>
    >();

    for (const edge of existingEdges) {
      if (!similarities.has(edge.book_id_1))
        similarities.set(edge.book_id_1, []);
      if (!similarities.has(edge.book_id_2))
        similarities.set(edge.book_id_2, []);
      similarities
        .get(edge.book_id_1)!
        .push({ bookId: edge.book_id_2, similarity: edge.similarity });
      similarities
        .get(edge.book_id_2)!
        .push({ bookId: edge.book_id_1, similarity: edge.similarity });
    }

    return similarities;
  }

  /** Rapporte la progression pour l'ajout incrémental */
  private reportProgressIncremental(
    onProgress: ((progress: IndexingProgress) => void) | undefined,
    processedBooks: number,
    totalBooks: number,
    processedPairs: number,
    startTime: number
  ): void {
    if (!onProgress || processedBooks % 5 !== 0) return;

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processedBooks / elapsed;
    const remaining = (totalBooks - processedBooks) / rate;

    onProgress({
      currentBook: processedBooks,
      totalBooks,
      currentPhase: "jaccard",
      message: `Processing ${processedBooks}/${totalBooks} (${processedPairs} pairs, ~${remaining.toFixed(0)}s remaining)`,
      percentage: (processedBooks / totalBooks) * 100,
    });
  }

  /** Trouve les candidats pour un nouveau livre */
  private getCandidatesForNewBook(
    newBookId: number,
    existingBookIds: number[],
    maxTermFrequency: number,
    minSharedTerms: number
  ): Set<number> {
    if (existingBookIds.length === 0) return new Set();

    // Pre-compute max doc frequency threshold
    const maxDocFreq = Math.floor(this.totalBooks * maxTermFrequency);

    const candidates = this.db
      .prepare(
        `
        WITH new_book_terms AS (
          SELECT i.term
          FROM inverted_index i
          JOIN term_stats ts ON i.term = ts.term AND ts.document_frequency <= ?
          WHERE i.book_id = ?
        )
        SELECT i2.book_id, COUNT(*) as shared_terms
        FROM new_book_terms nbt
        JOIN inverted_index i2 ON nbt.term = i2.term
        WHERE i2.book_id != ?
        GROUP BY i2.book_id
        HAVING shared_terms >= ?
      `
      )
      .all(maxDocFreq, newBookId, newBookId, minSharedTerms) as Array<{
      book_id: number;
      shared_terms: number;
    }>;

    // Filter to only existing books if the list is provided (for incremental updates)
    const existingSet = new Set(existingBookIds);
    return new Set(
      candidates
        .filter((c) => existingSet.has(c.book_id))
        .map((c) => c.book_id)
    );
  }
}
