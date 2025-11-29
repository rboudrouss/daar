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
   * Indexe un seul livre
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

    // Insérer dans l'index inversé (dans une transaction)
    withTransaction(() => {
      for (const [term, count] of termCounts.entries()) {
        const termPositions = positions?.get(term) || [];
        // Optimisation: sérialisation manuelle plus rapide que JSON.stringify
        const positionsJson = this.serializePositions(termPositions);

        this.stmtInsertIndex.run(term, bookId, count, positionsJson);
        this.stmtUpdateTermStats.run(term, count, count);
      }
    });

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
   * Indexe plusieurs livres
   */
  indexBooks(
    metadataList: BookMetadata[],
    onProgress?: (progress: IndexingProgress) => void
  ): Book[] {
    const books: Book[] = [];
    const total = metadataList.length;

    console.log(`\nStarting indexation of ${total} books...\n`);
    const startTime = Date.now();

    // Traiter tous les livres dans une seule grande transaction pour de meilleures performances
    withTransaction(() => {
      for (let i = 0; i < total; i++) {
        const metadata = metadataList[i];

        if (onProgress) {
          onProgress({
            currentBook: i + 1,
            totalBooks: total,
            currentPhase: "indexing",
            message: `Indexing ${metadata.title}`,
            percentage: ((i + 1) / total) * 100,
          });
        }

        try {
          // Lire et tokenizer
          const content = readFileSync(metadata.filePath, "utf-8");
          const { terms, positions, totalTokens } =
            this.tokenizer.tokenize(content);

          // Insérer le livre
          const result = this.stmtInsertBook.run(
            metadata.title,
            metadata.author,
            metadata.filePath,
            metadata.coverImagePath || null,
            totalTokens
          );

          const bookId = result.lastInsertRowid as number;
          const termCounts = this.tokenizer.countTerms(terms);

          // Insérer les termes (déjà dans la transaction globale)
          for (const [term, count] of termCounts.entries()) {
            const termPositions = positions?.get(term) || [];
            const positionsJson = this.serializePositions(termPositions);

            this.stmtInsertIndex.run(term, bookId, count, positionsJson);
            this.stmtUpdateTermStats.run(term, count, count);
          }

          books.push({
            id: bookId,
            title: metadata.title,
            author: metadata.author,
            filePath: metadata.filePath,
            coverImagePath: metadata.coverImagePath,
            wordCount: totalTokens,
          });

          console.log(
            `Indexed: ${metadata.title} (${totalTokens} words, ${termCounts.size} unique terms)`
          );
        } catch (error) {
          console.error(`Error indexing ${metadata.title}:`, error);
        }
      }
    });

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(
      `\nIndexation complete: ${books.length}/${total} books indexed in ${elapsed.toFixed(2)}s\n`
    );

    // Mettre à jour les métadonnées de la bibliothèque
    this.updateLibraryMetadata(books);

    return books;
  }

  /**
   * Met à jour les métadonnées de la bibliothèque
   */
  private updateLibraryMetadata(books: Book[]): void {
    const totalBooks = books.length;
    const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0);
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

    console.log(`Library stats updated:`);
    console.log(`   - Total books: ${totalBooks}`);
    console.log(`   - Total unique terms: ${totalTerms}`);
    console.log(
      `   - Average document length: ${avgDocLength.toFixed(2)} words`
    );
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
