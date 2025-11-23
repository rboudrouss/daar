/**
 * Routes API pour l'administration
 */

import { Hono } from "hono";
import { getDatabase } from "../db/connection";
import { adminAuth } from "../middleware/auth";
import {
  downloadGutenbergBook,
  fetchGutendexMetadataBatch,
} from "../utils/gutenberg";
import { BookIndexer } from "../indexing/indexer";
import { JaccardCalculator } from "../indexing/jaccard";
import { PageRankCalculator } from "../indexing/pagerank";
import { GUTENBERG_BATCH_SIZE } from "../utils/const";

const app = new Hono();

// Appliquer le middleware d'authentification à toutes les routes admin
app.use("*", adminAuth);

/**
 * POST /api/admin/import-gutenberg
 * Importe N livres depuis Project Gutenberg
 * Body: { count: number }
 */
app.post("/import-gutenberg", async (c) => {
  try {
    const body = await c.req.json();
    const count = parseInt(body.count || "10");

    if (count <= 0 || count > 1000) {
      return c.json({ error: "Count must be between 1 and 1000" }, 400);
    }

    const db = getDatabase();

    // Récupérer le dernier ID Gutenberg
    const lastIdResult = db
      .prepare(
        "SELECT value FROM library_metadata WHERE key = 'last_gutenberg_id'"
      )
      .get() as { value: string } | undefined;

    let lastGutenbergId = parseInt(lastIdResult?.value || "0");

    console.log(
      `\nStarting Gutenberg import from ID ${lastGutenbergId + 1}...`
    );

    const failedIds: number[] = [];
    let successCount = 0;
    const indexer = new BookIndexer();

    // Générer la liste des IDs à télécharger
    const bookIds: number[] = [];
    for (let i = 0; i < count; i++) {
      bookIds.push(lastGutenbergId + 1 + i);
    }

    // Traiter par batches
    const batches: number[][] = [];
    for (let i = 0; i < bookIds.length; i += GUTENBERG_BATCH_SIZE) {
      batches.push(bookIds.slice(i, i + GUTENBERG_BATCH_SIZE));
    }

    console.log(
      `Processing ${bookIds.length} books in ${batches.length} batches of ${GUTENBERG_BATCH_SIZE}`
    );

    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(
        `\n[Batch ${batchIndex + 1}/${batches.length}] Fetching metadata for ${batch.length} books (IDs: ${batch[0]}-${batch[batch.length - 1]})...`
      );

      // Récupérer les métadonnées du batch
      const metadataMap = await fetchGutendexMetadataBatch(batch);
      console.log(
        `Received metadata for ${metadataMap.size}/${batch.length} books`
      );

      // Télécharger et indexer chaque livre du batch
      for (const bookId of batch) {
        processedCount++;
        console.log(
          `\n[${processedCount}/${count}] Processing book ${bookId}...`
        );

        const metadata = metadataMap.get(bookId) || null;
        const book = await downloadGutenbergBook(bookId, metadata);

        if (book) {
          console.log(`Successfully downloaded: ${book.title}`);

          // Indexer immédiatement après le téléchargement
          try {
            console.log(`Indexing: ${book.title}...`);
            indexer.indexBook({
              title: book.title,
              author: book.author,
              filePath: book.textFilePath,
              coverImagePath: book.coverImagePath,
            });
            successCount++;
            console.log(`✓ Successfully indexed: ${book.title}`);
          } catch (error) {
            console.error(`Failed to index ${book.title}:`, error);
            failedIds.push(bookId);
          }
        } else {
          failedIds.push(bookId);
          console.log(`Failed to download book ${bookId}`);
        }
      }

      // Pause entre les batches (sauf pour le dernier)
      if (batchIndex < batches.length - 1) {
        console.log(
          `\nBatch ${batchIndex + 1} complete. Waiting 1s before next batch...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mettre à jour le dernier ID Gutenberg
    const newLastId = lastGutenbergId + count;
    db.prepare(
      "UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_gutenberg_id'"
    ).run(newLastId.toString());

    // Mettre à jour les statistiques de la bibliothèque
    console.log("\nUpdating library metadata...");
    indexer.updateLibraryMetadataFromDB();

    return c.json({
      success: true,
      imported: successCount,
      failed: failedIds.length,
      failedIds,
      lastGutenbergId: newLastId,
      message: `Successfully imported ${successCount} books from Gutenberg`,
    });
  } catch (error) {
    console.error("Error importing from Gutenberg:", error);
    return c.json(
      {
        error: "Failed to import books from Gutenberg",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/admin/rebuild-jaccard
 * Reconstruit le graphe de Jaccard
 * Body: { threshold?: number }
 */
app.post("/rebuild-jaccard", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const threshold = parseFloat(body.threshold || "0.1");

    console.log(`\nRebuilding Jaccard graph with threshold ${threshold}...`);

    const calculator = new JaccardCalculator({
      similarityThreshold: threshold,
    });
    const edgeCount = calculator.buildJaccardGraph((progress) => {
      console.log(
        `   ${progress.currentBook}/${progress.totalBooks} - ${progress.currentPhase} - ${progress.message} (${progress.percentage.toFixed(1)}%)`
      );
    });

    console.log(`Successfully built Jaccard graph with ${edgeCount} edges`);

    return c.json({
      success: true,
      edges: edgeCount,
      threshold,
      message: `Successfully rebuilt Jaccard graph with ${edgeCount} edges`,
    });
  } catch (error) {
    console.error("Error rebuilding Jaccard graph:", error);
    return c.json(
      {
        error: "Failed to rebuild Jaccard graph",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/admin/calculate-pagerank
 * Calcule les scores PageRank
 * Body: { iterations?: number, dampingFactor?: number }
 */
app.post("/calculate-pagerank", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const iterations = parseInt(body.iterations || "100");
    const dampingFactor = parseFloat(body.dampingFactor || "0.85");

    console.log(
      `\nCalculating PageRank (max iterations: ${iterations}, damping: ${dampingFactor})...`
    );

    const calculator = new PageRankCalculator({
      maxIterations: iterations,
      damping: dampingFactor,
    });
    const scores = calculator.calculatePageRank((progress) => {
      console.log(
        `   ${progress.currentBook}/${progress.totalBooks} - ${progress.currentPhase} - ${progress.message} (${progress.percentage.toFixed(1)}%)`
      );
    });

    console.log(
      `Successfully calculated PageRank scores for ${scores.length} books`
    );

    return c.json({
      success: true,
      booksProcessed: scores.length,
      maxIterations: iterations,
      dampingFactor,
      message: `Successfully calculated PageRank scores for ${scores.length} books`,
    });
  } catch (error) {
    console.error("Error calculating PageRank:", error);
    return c.json(
      {
        error: "Failed to calculate PageRank",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/admin/reindex
 * Réindexe tous les livres (met à jour les positions de caractères)
 */
app.post("/reindex", async (c) => {
  try {
    const db = getDatabase();

    console.log("\nReindexing all books...");

    // Récupérer tous les livres
    const books = db.prepare("SELECT * FROM books").all() as Array<{
      id: number;
      title: string;
      author: string;
      file_path: string;
      cover_image_path: string;
    }>;

    console.log(`Found ${books.length} books to reindex`);

    // Supprimer l'ancien index
    console.log("Deleting old index...");
    db.prepare("DELETE FROM inverted_index").run();
    db.prepare("DELETE FROM term_stats").run();

    // Réindexer tous les livres
    const indexer = new BookIndexer();
    let reindexedCount = 0;

    for (const book of books) {
      try {
        indexer.reindexBook(book.id, book.file_path);
        reindexedCount++;

        if (reindexedCount % 10 === 0) {
          console.log(
            `Progress: ${reindexedCount}/${books.length} books reindexed`
          );
        }
      } catch (error) {
        console.error(
          `Failed to reindex book ${book.id} (${book.title}):`,
          error
        );
      }
    }

    // Mettre à jour les statistiques de la bibliothèque
    console.log("\nUpdating library metadata...");
    indexer.updateLibraryMetadataFromDB();

    console.log(`✓ Successfully reindexed ${reindexedCount} books`);

    return c.json({
      success: true,
      booksReindexed: reindexedCount,
      message: `Successfully reindexed ${reindexedCount} books`,
    });
  } catch (error) {
    console.error("Error reindexing books:", error);
    return c.json(
      {
        error: "Failed to reindex books",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/admin/update-stats
 * Met à jour les statistiques de la bibliothèque (total_books, total_words, etc.)
 */
app.post("/update-stats", async (c) => {
  try {
    console.log("\nUpdating library statistics...");

    const indexer = new BookIndexer();
    indexer.updateLibraryMetadataFromDB();

    console.log("✓ Library statistics updated successfully");

    return c.json({
      success: true,
      message: "Library statistics updated successfully",
    });
  } catch (error) {
    console.error("Error updating library statistics:", error);
    return c.json(
      {
        error: "Failed to update library statistics",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default app;
