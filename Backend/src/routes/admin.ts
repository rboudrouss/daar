/**
 * Routes API pour l'administration
 */

import { Hono } from "hono";
import { getDatabase } from "../db/connection";
import { adminAuth } from "../middleware/auth";
import { downloadGutenbergBook } from "../utils/gutenberg";
import { BookIndexer } from "../indexing/indexer";
import { JaccardCalculator } from "../indexing/jaccard";
import { PageRankCalculator } from "../indexing/pagerank";
import type { BookMetadata } from "../utils/types";

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

    if (count <= 0 || count > 100) {
      return c.json({ error: "Count must be between 1 and 100" }, 400);
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
      `\n📚 Starting Gutenberg import from ID ${lastGutenbergId + 1}...`
    );

    const importedBooks: BookMetadata[] = [];
    const failedIds: number[] = [];
    let successCount = 0;

    // Télécharger les livres
    for (let i = 0; i < count; i++) {
      const bookId = lastGutenbergId + 1 + i;

      console.log(
        `\n[${i + 1}/${count}] Downloading Gutenberg book ${bookId}...`
      );

      const book = await downloadGutenbergBook(bookId);

      if (book) {
        importedBooks.push({
          title: book.title,
          author: book.author,
          filePath: book.textFilePath,
          coverImagePath: book.coverImagePath,
        });
        successCount++;
        console.log(`✓ Successfully downloaded: ${book.title}`);
      } else {
        failedIds.push(bookId);
        console.log(`✗ Failed to download book ${bookId}`);
      }
    }

    // Indexer les livres téléchargés
    if (importedBooks.length > 0) {
      console.log(`\n📖 Indexing ${importedBooks.length} books...`);

      const indexer = new BookIndexer();
      const indexedBooks = indexer.indexBooks(importedBooks);

      console.log(`✓ Successfully indexed ${indexedBooks.length} books`);
    }

    // Mettre à jour le dernier ID Gutenberg
    const newLastId = lastGutenbergId + count;
    db.prepare(
      "UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_gutenberg_id'"
    ).run(newLastId.toString());

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

    console.log(`\n🔗 Rebuilding Jaccard graph with threshold ${threshold}...`);

    const calculator = new JaccardCalculator({
      similarityThreshold: threshold,
    });
    const edgeCount = calculator.buildJaccardGraph();

    console.log(`✓ Successfully built Jaccard graph with ${edgeCount} edges`);

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
      `\n📊 Calculating PageRank (max iterations: ${iterations}, damping: ${dampingFactor})...`
    );

    const calculator = new PageRankCalculator({
      maxIterations: iterations,
      damping: dampingFactor,
    });
    const scores = calculator.calculatePageRank();

    console.log(
      `✓ Successfully calculated PageRank scores for ${scores.length} books`
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

export default app;
