/**
 * Système d'indexation des livres
 */

import { readFileSync } from 'fs';
import { getDatabase, withTransaction } from '../db/connection.js';
import { Tokenizer } from './tokenizer.js';
import { BookMetadata, Book, IndexingProgress } from '../utils/types.js';

/**
 * Indexeur de livres
 */
export class BookIndexer {
  private tokenizer: Tokenizer;
  private db;

  constructor(tokenizer?: Tokenizer) {
    this.tokenizer = tokenizer || new Tokenizer();
    this.db = getDatabase();
  }

  /**
   * Indexe un seul livre
   */
  indexBook(metadata: BookMetadata): Book {
    console.log(`Indexing: ${metadata.title}`);

    // 1. Lire le contenu du fichier
    const content = readFileSync(metadata.filePath, 'utf-8');

    // 2. Tokenizer le contenu
    const { terms, positions, totalTokens } = this.tokenizer.tokenize(content);

    // 3. Insérer le livre dans la DB
    const insertBook = this.db.prepare(`
      INSERT INTO books (title, author, file_path, word_count)
      VALUES (?, ?, ?, ?)
    `);

    const result = insertBook.run(
      metadata.title,
      metadata.author,
      metadata.filePath,
      totalTokens
    );

    const bookId = result.lastInsertRowid as number;

    // 4. Compter les occurrences de chaque terme
    const termCounts = this.tokenizer.countTerms(terms);

    // 5. Insérer dans l'index inversé (dans une transaction)
    const insertIndex = this.db.prepare(`
      INSERT INTO inverted_index (term, book_id, term_frequency, positions)
      VALUES (?, ?, ?, ?)
    `);

    const updateTermStats = this.db.prepare(`
      INSERT INTO term_stats (term, document_frequency, total_frequency)
      VALUES (?, 1, ?)
      ON CONFLICT(term) DO UPDATE SET
        document_frequency = document_frequency + 1,
        total_frequency = total_frequency + ?
    `);

    withTransaction(() => {
      for (const [term, count] of termCounts.entries()) {
        const termPositions = positions?.get(term) || [];
        const positionsJson = JSON.stringify(termPositions);

        insertIndex.run(term, bookId, count, positionsJson);
        updateTermStats.run(term, count, count);
      }
    });

    console.log(`Indexed: ${metadata.title} (${totalTokens} words, ${termCounts.size} unique terms)`);

    return {
      id: bookId,
      title: metadata.title,
      author: metadata.author,
      filePath: metadata.filePath,
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

    for (let i = 0; i < total; i++) {
      const metadata = metadataList[i];

      if (onProgress) {
        onProgress({
          currentBook: i + 1,
          totalBooks: total,
          currentPhase: 'indexing',
          message: `Indexing ${metadata.title}`,
          percentage: ((i + 1) / total) * 100,
        });
      }

      try {
        const book = this.indexBook(metadata);
        books.push(book);
      } catch (error) {
        console.error(`Error indexing ${metadata.title}:`, error);
      }
    }

    // Mettre à jour les métadonnées de la bibliothèque
    this.updateLibraryMetadata(books);

    console.log(`\nIndexation complete: ${books.length}/${total} books indexed\n`);

    return books;
  }

  /**
   * Met à jour les métadonnées de la bibliothèque
   */
  private updateLibraryMetadata(books: Book[]): void {
    const totalBooks = books.length;
    const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0);
    const avgDocLength = totalBooks > 0 ? totalWords / totalBooks : 0;

    const totalTermsResult = this.db.prepare('SELECT COUNT(*) as count FROM term_stats').get() as { count: number };
    const totalTerms = totalTermsResult.count;

    const updateMeta = this.db.prepare(`
      UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?
    `);

    withTransaction(() => {
      updateMeta.run(totalBooks.toString(), 'total_books');
      updateMeta.run(totalTerms.toString(), 'total_terms');
      updateMeta.run(avgDocLength.toString(), 'avg_doc_length');
      updateMeta.run(totalWords.toString(), 'total_words');
      updateMeta.run(new Date().toISOString(), 'last_indexed');
    });

    console.log(`Library stats updated:`);
    console.log(`   - Total books: ${totalBooks}`);
    console.log(`   - Total unique terms: ${totalTerms}`);
    console.log(`   - Average document length: ${avgDocLength.toFixed(2)} words`);
  }

  /**
   * Récupère les statistiques de la bibliothèque
   */
  getLibraryStats() {
    const stats = this.db.prepare('SELECT key, value FROM library_metadata').all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(stats.map(s => [s.key, s.value]));
  }
}

