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
import { getGutenbergBatchSize } from "../utils/const";
import { getAllConfig, updateConfig } from "../utils/config";

const app = new Hono();

// Appliquer le middleware d'authentification à toutes les routes admin
app.use("*", adminAuth);

/**
 * POST /api/admin/import-gutenberg
 * Importe N livres depuis Project Gutenberg avec téléchargement parallèle
 * Body: { count: number, autoJaccard?: boolean, parallelDownloads?: number }
 */
app.post("/import-gutenberg", async (c) => {
  try {
    const body = await c.req.json();
    const count = parseInt(body.count || "10");
    const autoJaccard = body.autoJaccard !== false; // Par défaut: true
    const parallelDownloads = parseInt(body.parallelDownloads || "5"); // 5 téléchargements parallèles par défaut

    if (count <= 0 || count > 1000) {
      return c.json({ error: "Count must be between 1 and 1000" }, 400);
    }

    if (parallelDownloads < 1 || parallelDownloads > 10) {
      return c.json(
        { error: "parallelDownloads must be between 1 and 10" },
        400
      );
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
    console.log(`   Parallel downloads: ${parallelDownloads}`);
    console.log(`   Auto Jaccard update: ${autoJaccard}\n`);

    const failedIds: number[] = [];
    const indexer = new BookIndexer();
    const newlyIndexedBookIds: number[] = [];

    // Générer la liste des IDs à télécharger
    const bookIds: number[] = [];
    for (let i = 0; i < count; i++) {
      bookIds.push(lastGutenbergId + 1 + i);
    }

    // Traiter par batches
    const batchSize = getGutenbergBatchSize();
    const batches: number[][] = [];
    for (let i = 0; i < bookIds.length; i += batchSize) {
      batches.push(bookIds.slice(i, i + batchSize));
    }

    console.log(
      `Processing ${bookIds.length} books in ${batches.length} batches of ${batchSize}`
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

      // Télécharger les livres en parallèle
      console.log(
        `\nDownloading ${batch.length} books with ${parallelDownloads} parallel connections...`
      );

      const downloadPromises: Promise<{
        bookId: number;
        book: any;
      }>[] = [];

      for (const bookId of batch) {
        const metadata = metadataMap.get(bookId) || null;
        downloadPromises.push(
          downloadGutenbergBook(bookId, metadata).then((book) => ({
            bookId,
            book,
          }))
        );
      }

      // Télécharger par chunks parallèles
      const downloadResults: Array<{ bookId: number; book: any }> = [];
      for (let i = 0; i < downloadPromises.length; i += parallelDownloads) {
        const chunk = downloadPromises.slice(i, i + parallelDownloads);
        const chunkResults = await Promise.all(chunk);
        downloadResults.push(...chunkResults);

        console.log(
          `   Downloaded ${Math.min(i + parallelDownloads, downloadPromises.length)}/${downloadPromises.length} books...`
        );
      }

      // Indexer les livres téléchargés
      console.log(`\nIndexing ${downloadResults.length} books...`);
      for (const { bookId, book } of downloadResults) {
        processedCount++;

        if (book) {
          console.log(
            `[${processedCount}/${count}] Indexing: ${book.title}...`
          );

          try {
            const indexedBook = indexer.indexBook({
              title: book.title,
              author: book.author,
              filePath: book.textFilePath,
              coverImagePath: book.coverImagePath,
            });
            newlyIndexedBookIds.push(indexedBook.id);
            console.log(`Successfully indexed: ${book.title}`);
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

    const successCount = newlyIndexedBookIds.length;

    // Mise à jour incrémentale du graphe de Jaccard si demandé
    let jaccardEdges = 0;
    if (autoJaccard && successCount > 0) {
      console.log(
        `\nUpdating Jaccard graph incrementally for ${successCount} new books...`
      );
      try {
        const calculator = new JaccardCalculator();
        jaccardEdges = calculator.addBooksToJaccardGraph(
          newlyIndexedBookIds,
          (progress) => {
            console.log(
              `   ${progress.currentBook}/${progress.totalBooks} - ${progress.message} (${progress.percentage.toFixed(1)}%)`
            );
          }
        );
        console.log(`Jaccard graph updated with ${jaccardEdges} total edges`);
      } catch (error) {
        console.error("Failed to update Jaccard graph:", error);
      }
    }

    return c.json({
      success: true,
      imported: successCount,
      failed: failedIds.length,
      failedIds,
      lastGutenbergId: newLastId,
      jaccardEdges: autoJaccard ? jaccardEdges : undefined,
      message: `Successfully imported ${successCount} books from Gutenberg${autoJaccard ? ` and updated Jaccard graph (${jaccardEdges} edges)` : ""}`,
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

    console.log(`Successfully reindexed ${reindexedCount} books`);

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

    console.log("Library statistics updated successfully");

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

/**
 * GET /api/admin/config
 * Get all configuration values
 */
app.get("/config", async (c) => {
  try {
    const config = getAllConfig();
    return c.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Error getting configuration:", error);
    return c.json(
      {
        error: "Failed to get configuration",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * PUT /api/admin/config
 * Update configuration values
 * Body: { key: string, value: string | number | boolean }
 */
app.put("/config", async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return c.json({ error: "Missing required fields: key and value" }, 400);
    }

    // Update the configuration
    updateConfig(key, value);

    console.log(`Configuration updated: ${key} = ${value}`);

    return c.json({
      success: true,
      message: `Configuration '${key}' updated successfully`,
      key,
      value,
    });
  } catch (error) {
    console.error("Error updating configuration:", error);
    return c.json(
      {
        error: "Failed to update configuration",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/admin/add-book
 * Add a single book manually with file uploads
 * Body: FormData with title, author (optional), textFile (required), coverImage (optional)
 */
app.post("/add-book", async (c) => {
  try {
    const body = await c.req.parseBody();

    // Extract fields
    const title = body["title"] as string;
    const author = (body["author"] as string) || "Unknown Author";
    const textFile = body["textFile"];
    const coverImage = body["coverImage"];
    const autoJaccard = body["autoJaccard"] !== "false"; // Default true

    // Validate required fields
    if (!title || !title.trim()) {
      return c.json({ error: "Title is required" }, 400);
    }

    if (!textFile || !(textFile instanceof File)) {
      return c.json({ error: "Text file is required" }, 400);
    }

    // Validate file types
    if (!textFile.name.endsWith(".txt")) {
      return c.json(
        { error: "Text file must be a .txt file" },
        400
      );
    }

    if (
      coverImage &&
      coverImage instanceof File &&
      !["image/jpeg", "image/jpg", "image/png"].includes(coverImage.type)
    ) {
      return c.json(
        { error: "Cover image must be a JPEG or PNG file" },
        400
      );
    }

    console.log(`\nAdding book manually: ${title} by ${author}`);

    const { existsSync, mkdirSync, writeFileSync } = await import("fs");
    const { join } = await import("path");

    // Create directories if they don't exist
    const booksDir = "./data/books";
    const coversDir = "./data/covers";

    if (!existsSync(booksDir)) {
      mkdirSync(booksDir, { recursive: true });
    }
    if (!existsSync(coversDir)) {
      mkdirSync(coversDir, { recursive: true });
    }

    // Generate unique filename based on timestamp
    const timestamp = Date.now();
    const textFilename = `manual-${timestamp}.txt`;
    const textFilePath = join(booksDir, textFilename);

    // Save text file
    const textArrayBuffer = await textFile.arrayBuffer();
    const textBuffer = Buffer.from(textArrayBuffer);
    writeFileSync(textFilePath, textBuffer);

    console.log(`Saved text file: ${textFilePath}`);

    // Save cover image if provided
    let coverImagePath: string | undefined;
    if (coverImage && coverImage instanceof File) {
      const ext = coverImage.name.split(".").pop() || "jpg";
      const coverFilename = `manual-${timestamp}.${ext}`;
      coverImagePath = join(coversDir, coverFilename);

      const coverArrayBuffer = await coverImage.arrayBuffer();
      const coverBuffer = Buffer.from(coverArrayBuffer);
      writeFileSync(coverImagePath, coverBuffer);

      console.log(`Saved cover image: ${coverImagePath}`);
    }

    // Index the book
    const indexer = new BookIndexer();
    console.log(`Indexing book: ${title}...`);

    const indexedBook = indexer.indexBook({
      title: title.trim(),
      author: author.trim(),
      filePath: textFilePath,
      coverImagePath,
    });

    console.log(`Successfully indexed book: ${title} (ID: ${indexedBook.id})`);

    // Update library metadata
    indexer.updateLibraryMetadataFromDB();

    // Update Jaccard graph incrementally if requested
    let jaccardEdges = 0;
    if (autoJaccard) {
      console.log(`\nUpdating Jaccard graph incrementally for new book...`);
      try {
        const calculator = new JaccardCalculator();
        jaccardEdges = calculator.addBooksToJaccardGraph([indexedBook.id]);
        console.log(`Jaccard graph updated with ${jaccardEdges} total edges`);
      } catch (error) {
        console.error("Failed to update Jaccard graph:", error);
      }
    }

    return c.json({
      success: true,
      book: {
        id: indexedBook.id,
        title: indexedBook.title,
        author: indexedBook.author,
        wordCount: indexedBook.wordCount,
      },
      jaccardEdges: autoJaccard ? jaccardEdges : undefined,
      message: `Successfully added book: ${title}${autoJaccard ? ` and updated Jaccard graph (${jaccardEdges} edges)` : ""}`,
    });
  } catch (error) {
    console.error("Error adding book:", error);
    return c.json(
      {
        error: "Failed to add book",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default app;
