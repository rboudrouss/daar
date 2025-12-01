/**
 * Routes API pour l'administration
 */

import { Hono } from "hono";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getDatabase } from "../db/connection";
import type { GutendexMetadata } from "../utils/gutenberg";
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

// ============================================================================
// Constants
// ============================================================================

const PATHS = {
  BOOKS_DIR: "./data/books",
  COVERS_DIR: "./data/covers",
} as const;

const LIMITS = {
  GUTENBERG_COUNT: { MIN: 1, MAX: 1000 },
  PARALLEL_DOWNLOADS: { MIN: 1, MAX: 10 },
} as const;

// ============================================================================
// Helper Types
// ============================================================================

interface ImportGutenbergParams {
  count: number;
  autoJaccard: boolean;
  parallelDownloads: number;
}

interface JaccardPagerankResult {
  jaccardEdges: number;
  pagerankScores: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse and validate import parameters from request body
 */
function parseImportParams(body: Record<string, unknown>): ImportGutenbergParams {
  return {
    count: parseInt(String(body.count || "10")),
    autoJaccard: body.autoJaccard !== false,
    parallelDownloads: parseInt(String(body.parallelDownloads || "5")),
  };
}

/**
 * Validate import parameters and return error message if invalid
 */
function validateImportParams(params: ImportGutenbergParams): string | null {
  const { count, parallelDownloads } = params;
  const { GUTENBERG_COUNT, PARALLEL_DOWNLOADS } = LIMITS;

  if (count < GUTENBERG_COUNT.MIN || count > GUTENBERG_COUNT.MAX) {
    return `Count must be between ${GUTENBERG_COUNT.MIN} and ${GUTENBERG_COUNT.MAX}`;
  }

  if (parallelDownloads < PARALLEL_DOWNLOADS.MIN || parallelDownloads > PARALLEL_DOWNLOADS.MAX) {
    return `parallelDownloads must be between ${PARALLEL_DOWNLOADS.MIN} and ${PARALLEL_DOWNLOADS.MAX}`;
  }

  return null;
}

/**
 * Get the last Gutenberg ID from the database
 */
function getLastGutenbergId(): number {
  const db = getDatabase();
  const result = db
    .prepare("SELECT value FROM library_metadata WHERE key = 'last_gutenberg_id'")
    .get() as { value: string } | undefined;
  return parseInt(result?.value || "0");
}

/**
 * Update the last Gutenberg ID in the database
 */
function updateLastGutenbergId(newId: number): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE library_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_gutenberg_id'"
  ).run(newId.toString());
}

/**
 * Split an array into batches of a given size
 */
function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Download books in parallel with controlled concurrency
 */
async function downloadBooksInParallel(
  batch: number[],
  metadataMap: Map<number, GutendexMetadata>,
  parallelDownloads: number
): Promise<Array<{ bookId: number; book: unknown }>> {
  const downloadPromises = batch.map((bookId) => {
    const metadata = metadataMap.get(bookId);
    return downloadGutenbergBook(bookId, metadata).then((book) => ({ bookId, book }));
  });

  const results: Array<{ bookId: number; book: unknown }> = [];
  for (let i = 0; i < downloadPromises.length; i += parallelDownloads) {
    const chunk = downloadPromises.slice(i, i + parallelDownloads);
    const chunkResults = await Promise.all(chunk);
    results.push(...chunkResults);
    console.log(`   Downloaded ${Math.min(i + parallelDownloads, downloadPromises.length)}/${downloadPromises.length} books...`);
  }

  return results;
}

/**
 * Update Jaccard graph and PageRank scores for newly indexed books
 */
function updateJaccardAndPagerank(bookIds: number[]): JaccardPagerankResult {
  const calculator = new JaccardCalculator();

  // Check if Jaccard graph already exists
  const db = getDatabase();
  const existingEdges = db.prepare("SELECT COUNT(*) as count FROM jaccard_edges").get() as { count: number };
  const hasExistingGraph = existingEdges.count > 0;

  let jaccardEdges: number;

  if (hasExistingGraph) {
    // Incremental update for existing graph
    console.log(`\nUpdating Jaccard graph incrementally for ${bookIds.length} new books...`);
    jaccardEdges = calculator.addBooksToJaccardGraph(bookIds, (progress) => {
      console.log(`   ${progress.currentBook}/${progress.totalBooks} - ${progress.message} (${progress.percentage.toFixed(1)}%)`);
    });
    console.log(`Jaccard graph updated with ${jaccardEdges} total edges`);
  } else {
    // First time: build full graph
    console.log(`\nBuilding Jaccard graph for the first time...`);
    jaccardEdges = calculator.buildJaccardGraph((progress) => {
      console.log(`   ${progress.currentBook}/${progress.totalBooks} - ${progress.currentPhase} - ${progress.message} (${progress.percentage.toFixed(1)}%)`);
    });
    console.log(`Jaccard graph built with ${jaccardEdges} total edges`);
  }

  console.log(`\nRecalculating PageRank...`);
  const pagerankCalculator = new PageRankCalculator();
  const scores = pagerankCalculator.calculatePageRank();
  console.log(`PageRank recalculated for ${scores.length} books`);

  return { jaccardEdges, pagerankScores: scores.length };
}

/**
 * Create a standardized error response
 */
function createErrorResponse(error: unknown, defaultMessage: string) {
  return {
    error: defaultMessage,
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Ensure directories exist for file storage
 */
function ensureDirectoriesExist(): void {
  if (!existsSync(PATHS.BOOKS_DIR)) {
    mkdirSync(PATHS.BOOKS_DIR, { recursive: true });
  }
  if (!existsSync(PATHS.COVERS_DIR)) {
    mkdirSync(PATHS.COVERS_DIR, { recursive: true });
  }
}

/**
 * POST /api/admin/import-gutenberg
 * Importe N livres depuis Project Gutenberg avec téléchargement parallèle
 * Body: { count: number, autoJaccard?: boolean, parallelDownloads?: number }
 */
app.post("/import-gutenberg", async (c) => {
  try {
    const body = await c.req.json();
    const params = parseImportParams(body);

    // Validate parameters
    const validationError = validateImportParams(params);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    const { count, autoJaccard, parallelDownloads } = params;
    const lastGutenbergId = getLastGutenbergId();

    console.log(`\nStarting Gutenberg import from ID ${lastGutenbergId + 1}...`);
    console.log(`   Parallel downloads: ${parallelDownloads}`);
    console.log(`   Auto Jaccard update: ${autoJaccard}\n`);

    // Generate book IDs to download
    const bookIds = Array.from({ length: count }, (_, i) => lastGutenbergId + 1 + i);
    const batches = createBatches(bookIds, getGutenbergBatchSize());

    console.log(`Processing ${bookIds.length} books in ${batches.length} batches`);

    const failedIds: number[] = [];
    const newlyIndexedBookIds: number[] = [];
    const indexer = new BookIndexer();
    let processedCount = 0;

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n[Batch ${batchIndex + 1}/${batches.length}] Processing ${batch.length} books (IDs: ${batch[0]}-${batch[batch.length - 1]})...`);

      // Fetch metadata and download books
      const metadataMap = await fetchGutendexMetadataBatch(batch);
      console.log(`Received metadata for ${metadataMap.size}/${batch.length} books`);

      const downloadResults = await downloadBooksInParallel(batch, metadataMap, parallelDownloads);

      // Index downloaded books
      console.log(`\nIndexing ${downloadResults.length} books...`);
      for (const { bookId, book } of downloadResults) {
        processedCount++;

        if (!book) {
          failedIds.push(bookId);
          console.log(`Failed to download book ${bookId}`);
          continue;
        }

        try {
          const typedBook = book as { title: string; author: string; textFilePath: string; coverImagePath?: string };
          console.log(`[${processedCount}/${count}] Indexing: ${typedBook.title}...`);

          const indexedBook = indexer.indexBook({
            title: typedBook.title,
            author: typedBook.author,
            filePath: typedBook.textFilePath,
            coverImagePath: typedBook.coverImagePath,
          });
          newlyIndexedBookIds.push(indexedBook.id);
          console.log(`Successfully indexed: ${typedBook.title}`);
        } catch (error) {
          const typedBook = book as { title: string };
          console.error(`Failed to index ${typedBook.title}:`, error);
          failedIds.push(bookId);
        }
      }

      // Pause between batches (except for the last one)
      if (batchIndex < batches.length - 1) {
        console.log(`\nBatch ${batchIndex + 1} complete. Waiting 1s before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update last Gutenberg ID and library metadata
    const newLastId = lastGutenbergId + count;
    updateLastGutenbergId(newLastId);

    console.log("\nUpdating library metadata...");
    indexer.updateLibraryMetadataFromDB();

    const successCount = newlyIndexedBookIds.length;

    // Update Jaccard graph and PageRank if requested
    let jaccardResult: JaccardPagerankResult = { jaccardEdges: 0, pagerankScores: 0 };
    if (autoJaccard && successCount > 0) {
      try {
        jaccardResult = updateJaccardAndPagerank(newlyIndexedBookIds);
      } catch (error) {
        console.error("Failed to update Jaccard graph or PageRank:", error);
      }
    }

    return c.json({
      success: true,
      imported: successCount,
      failed: failedIds.length,
      failedIds,
      lastGutenbergId: newLastId,
      jaccardEdges: autoJaccard ? jaccardResult.jaccardEdges : undefined,
      pagerankScores: autoJaccard ? jaccardResult.pagerankScores : undefined,
      message: `Successfully imported ${successCount} books from Gutenberg${autoJaccard ? ` and updated Jaccard graph (${jaccardResult.jaccardEdges} edges) and PageRank (${jaccardResult.pagerankScores} scores)` : ""}`,
    });
  } catch (error) {
    console.error("Error importing from Gutenberg:", error);
    return c.json(createErrorResponse(error, "Failed to import books from Gutenberg"), 500);
  }
});

// ============================================================================
// Jaccard & PageRank Routes
// ============================================================================

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

    const calculator = new JaccardCalculator({ similarityThreshold: threshold });
    const edgeCount = calculator.buildJaccardGraph((progress) => {
      console.log(`   ${progress.currentBook}/${progress.totalBooks} - ${progress.currentPhase} - ${progress.message} (${progress.percentage.toFixed(1)}%)`);
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
    return c.json(createErrorResponse(error, "Failed to rebuild Jaccard graph"), 500);
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

    console.log(`\nCalculating PageRank (max iterations: ${iterations}, damping: ${dampingFactor})...`);

    const calculator = new PageRankCalculator({
      maxIterations: iterations,
      damping: dampingFactor,
    });

    const scores = calculator.calculatePageRank((progress) => {
      console.log(`   ${progress.currentBook}/${progress.totalBooks} - ${progress.currentPhase} - ${progress.message} (${progress.percentage.toFixed(1)}%)`);
    });

    console.log(`Successfully calculated PageRank scores for ${scores.length} books`);

    return c.json({
      success: true,
      booksProcessed: scores.length,
      maxIterations: iterations,
      dampingFactor,
      message: `Successfully calculated PageRank scores for ${scores.length} books`,
    });
  } catch (error) {
    console.error("Error calculating PageRank:", error);
    return c.json(createErrorResponse(error, "Failed to calculate PageRank"), 500);
  }
});

// ============================================================================
// Indexing Routes
// ============================================================================

/**
 * POST /api/admin/reindex
 * Réindexe tous les livres (met à jour les positions de caractères)
 */
app.post("/reindex", async (c) => {
  try {
    const db = getDatabase();
    console.log("\nReindexing all books...");

    const books = db.prepare("SELECT id, title, file_path FROM books").all() as Array<{
      id: number;
      title: string;
      file_path: string;
    }>;
    console.log(`Found ${books.length} books to reindex`);

    // Clear old index
    console.log("Deleting old index...");
    db.prepare("DELETE FROM inverted_index").run();
    db.prepare("DELETE FROM term_stats").run();

    // Reindex all books
    const indexer = new BookIndexer();
    let reindexedCount = 0;

    for (const book of books) {
      try {
        indexer.reindexBook(book.id, book.file_path);
        reindexedCount++;

        if (reindexedCount % 10 === 0) {
          console.log(`Progress: ${reindexedCount}/${books.length} books reindexed`);
        }
      } catch (error) {
        console.error(`Failed to reindex book ${book.id} (${book.title}):`, error);
      }
    }

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
    return c.json(createErrorResponse(error, "Failed to reindex books"), 500);
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
    return c.json(createErrorResponse(error, "Failed to update library statistics"), 500);
  }
});

// ============================================================================
// Configuration Routes
// ============================================================================

/** GET /api/admin/config - Get all configuration values */
app.get("/config", async (c) => {
  try {
    const config = getAllConfig();
    return c.json({ success: true, config });
  } catch (error) {
    console.error("Error getting configuration:", error);
    return c.json(createErrorResponse(error, "Failed to get configuration"), 500);
  }
});

/** PUT /api/admin/config - Update configuration values */
app.put("/config", async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return c.json({ error: "Missing required fields: key and value" }, 400);
    }

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
    return c.json(createErrorResponse(error, "Failed to update configuration"), 500);
  }
});

// ============================================================================
// Manual Book Addition Routes
// ============================================================================

const ALLOWED_COVER_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;

interface AddBookFormData {
  title: string;
  author: string;
  textFile: File;
  coverImage?: File;
  autoJaccard: boolean;
}

/**
 * Parse and validate add-book form data
 */
function parseAddBookFormData(body: Record<string, unknown>): { data?: AddBookFormData; error?: string } {
  const title = body["title"] as string;
  const author = (body["author"] as string) || "Unknown Author";
  const textFile = body["textFile"];
  const coverImage = body["coverImage"];
  const autoJaccard = body["autoJaccard"] !== "false";

  if (!title?.trim()) {
    return { error: "Title is required" };
  }

  if (!textFile || !(textFile instanceof File)) {
    return { error: "Text file is required" };
  }

  if (!textFile.name.endsWith(".txt")) {
    return { error: "Text file must be a .txt file" };
  }

  if (coverImage && coverImage instanceof File && !ALLOWED_COVER_TYPES.includes(coverImage.type as typeof ALLOWED_COVER_TYPES[number])) {
    return { error: "Cover image must be a JPEG or PNG file" };
  }

  return {
    data: {
      title: title.trim(),
      author: author.trim(),
      textFile: textFile as File,
      coverImage: coverImage instanceof File ? coverImage : undefined,
      autoJaccard,
    },
  };
}

/**
 * Save uploaded file to disk
 */
async function saveUploadedFile(file: File, directory: string, filename: string): Promise<string> {
  const filePath = join(directory, filename);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * POST /api/admin/add-book
 * Add a single book manually with file uploads
 */
app.post("/add-book", async (c) => {
  try {
    const body = await c.req.parseBody();
    const { data, error } = parseAddBookFormData(body);

    if (error || !data) {
      return c.json({ error }, 400);
    }

    console.log(`\nAdding book manually: ${data.title} by ${data.author}`);

    // Ensure directories exist
    ensureDirectoriesExist();

    // Generate unique filenames
    const timestamp = Date.now();
    const textFilePath = await saveUploadedFile(data.textFile, PATHS.BOOKS_DIR, `manual-${timestamp}.txt`);
    console.log(`Saved text file: ${textFilePath}`);

    // Save cover image if provided
    let coverImagePath: string | undefined;
    if (data.coverImage) {
      const ext = data.coverImage.name.split(".").pop() || "jpg";
      coverImagePath = await saveUploadedFile(data.coverImage, PATHS.COVERS_DIR, `manual-${timestamp}.${ext}`);
      console.log(`Saved cover image: ${coverImagePath}`);
    }

    // Index the book
    const indexer = new BookIndexer();
    console.log(`Indexing book: ${data.title}...`);

    const indexedBook = indexer.indexBook({
      title: data.title,
      author: data.author,
      filePath: textFilePath,
      coverImagePath,
    });

    console.log(`Successfully indexed book: ${data.title} (ID: ${indexedBook.id})`);
    indexer.updateLibraryMetadataFromDB();

    // Update Jaccard graph and PageRank if requested
    let jaccardResult: JaccardPagerankResult = { jaccardEdges: 0, pagerankScores: 0 };
    if (data.autoJaccard) {
      try {
        jaccardResult = updateJaccardAndPagerank([indexedBook.id]);
      } catch (error) {
        console.error("Failed to update Jaccard graph or PageRank:", error);
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
      jaccardEdges: data.autoJaccard ? jaccardResult.jaccardEdges : undefined,
      pagerankScores: data.autoJaccard ? jaccardResult.pagerankScores : undefined,
      message: `Successfully added book: ${data.title}${data.autoJaccard ? ` and updated Jaccard graph (${jaccardResult.jaccardEdges} edges) and PageRank (${jaccardResult.pagerankScores} scores)` : ""}`,
    });
  } catch (error) {
    console.error("Error adding book:", error);
    return c.json(createErrorResponse(error, "Failed to add book"), 500);
  }
});

export default app;
