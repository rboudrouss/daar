/**
 * Système d'indexation des livres
 */

import { readFileSync } from "fs";
import { getDatabase, withTransaction } from "../db/connection.js";
import { Tokenizer } from "./tokenizer.js";
import { BookMetadata, Book, IndexingProgress } from "../utils/types.js";

/**
 * Indexeur de livres
 */
export class BookIndexer {
  private tokenizer: Tokenizer;
  private db;

  // Prepared statements réutilisables (créés une seule fois)
  private stmtInsertBook;
  private stmtInsertIndex;
  private stmtUpdateTermStats;

  constructor(tokenizer?: Tokenizer) {
    this.tokenizer = tokenizer || new Tokenizer();
    this.db = getDatabase();

    // Créer les prepared statements une seule fois
    this.stmtInsertBook = this.db.prepare(`
      INSERT INTO books (title, author, file_path, cover_image_path, word_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.stmtInsertIndex = this.db.prepare(`
      INSERT INTO inverted_index (term, book_id, term_frequency, positions)
      VALUES (?, ?, ?, ?)
    `);

    this.stmtUpdateTermStats = this.db.prepare(`
      INSERT INTO term_stats (term, document_frequency, total_frequency)
      VALUES (?, 1, ?)
      ON CONFLICT(term) DO UPDATE SET
        document_frequency = document_frequency + 1,
        total_frequency = total_frequency + ?
    `);
  }

  /**
   * Réindexe un livre existant (met à jour uniquement l'index inversé)
   */
  reindexBook(bookId: number, filePath: string): void {
    const content = readFileSync(filePath, "utf-8");
    const { terms, positions, totalTokens } = this.tokenizer.tokenize(content);
    const termCounts = this.tokenizer.countTerms(terms);

    withTransaction(() => {
      for (const [term, count] of termCounts.entries()) {
        const termPositions = positions?.get(term) || [];
        const positionsJson = this.serializePositions(termPositions);

        this.stmtInsertIndex.run(term, bookId, count, positionsJson);
        this.stmtUpdateTermStats.run(term, count, count);
      }
    });

    console.log(
      `Reindexed book ${bookId} (${totalTokens} words, ${termCounts.size} unique terms)`
    );
  }

  /**
   * Pré-sérialise les positions en JSON (optimisation)
   */
  private serializePositions(positions: number[]): string {
    if (positions.length === 0) return "[]";
    return `[${positions.join(",")}]`;
  }

  /**
   * Indexe un seul livre avec batch inserts optimisés
   */
  indexBook(metadata: BookMetadata): Book {
    console.log(`Indexing: ${metadata.title}`);

    const content = readFileSync(metadata.filePath, "utf-8");
    const { terms, positions, totalTokens } = this.tokenizer.tokenize(content);

    // Insérer le livre dans la DB
    const result = this.stmtInsertBook.run(
      metadata.title,
      metadata.author,
      metadata.filePath,
      metadata.coverImagePath || null,
      totalTokens
    );

    const bookId = result.lastInsertRowid as number;
    const termCounts = this.tokenizer.countTerms(terms);

    // Insérer dans l'index inversé avec batch inserts (dans une transaction)
    this.insertTermsBatch(bookId, termCounts, positions);

    console.log(
      `Indexed: ${metadata.title} (${totalTokens} words, ${termCounts.size} unique terms)`
    );

    return {
      id: bookId,
      title: metadata.title,
      author: metadata.author,
      filePath: metadata.filePath,
      coverImagePath: metadata.coverImagePath,
      wordCount: totalTokens,
    };
  }

  /**
   * Insère les termes d'un livre par batch pour de meilleures performances
   */
  private insertTermsBatch(
    bookId: number,
    termCounts: Map<string, number>,
    positions?: Map<string, number[]>
  ): void {
    const BATCH_SIZE = 500; // Insérer 500 termes à la fois
    const terms = Array.from(termCounts.entries());

    withTransaction(() => {
      for (let i = 0; i < terms.length; i += BATCH_SIZE) {
        const batch = terms.slice(i, i + BATCH_SIZE);

        // Construire une requête multi-row INSERT pour l'index inversé
        const indexPlaceholders = batch.map(() => "(?, ?, ?, ?)").join(", ");
        const indexValues: any[] = [];
        for (const [term, count] of batch) {
          const termPositions = positions?.get(term) || [];
          const positionsJson = this.serializePositions(termPositions);
          indexValues.push(term, bookId, count, positionsJson);
        }

        this.db
          .prepare(
            `INSERT INTO inverted_index (term, book_id, term_frequency, positions) VALUES ${indexPlaceholders}`
          )
          .run(...indexValues);

        // Mettre à jour les statistiques de termes
        for (const [term, count] of batch) {
          this.stmtUpdateTermStats.run(term, count, count);
        }
      }
    });
  }

  /**
   * Met à jour les métadonnées de la bibliothèque en se basant sur toutes les données de la DB
   * Utile après avoir indexé des livres individuellement
   */
  public updateLibraryMetadataFromDB(): void {
    // Compter tous les livres et leurs mots
    const booksResult = this.db
      .prepare(
        "SELECT COUNT(*) as count, SUM(word_count) as total_words FROM books"
      )
      .get() as { count: number; total_words: number | null };

    const totalBooks = booksResult.count;
    const totalWords = booksResult.total_words || 0;
    const avgDocLength = totalBooks > 0 ? totalWords / totalBooks : 0;

    const totalTermsResult = this.db
      .prepare("SELECT COUNT(*) as count FROM term_stats")
      .get() as { count: number };
    const totalTerms = totalTermsResult.count;

    const updateMeta = this.db.prepare(`
      UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?
    `);

    withTransaction(() => {
      updateMeta.run(totalBooks.toString(), "total_books");
      updateMeta.run(totalTerms.toString(), "total_terms");
      updateMeta.run(avgDocLength.toString(), "avg_doc_length");
      updateMeta.run(totalWords.toString(), "total_words");
      updateMeta.run(new Date().toISOString(), "last_indexed");
    });

    console.log(`Library stats updated from DB:`);
    console.log(`   - Total books: ${totalBooks}`);
    console.log(`   - Total unique terms: ${totalTerms}`);
    console.log(`   - Total words: ${totalWords}`);
    console.log(
      `   - Average document length: ${avgDocLength.toFixed(2)} words`
    );
  }

  /**
   * Récupère les statistiques de la bibliothèque
   */
  getLibraryStats() {
    const stats = this.db
      .prepare("SELECT key, value FROM library_metadata")
      .all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(stats.map((s) => [s.key, s.value]));
  }
}
