/**
 * Routes API pour les livres
 */

import { Hono } from "hono";
import { getDatabase } from "../db/connection";
import type { Book, LibraryStats } from "../utils/types";
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from "fs";
import { join, extname } from "path";
import { stream } from "hono/streaming";

const app = new Hono();

// ============================================================================
// Constants
// ============================================================================

const COVERS_DIR = "./data/covers";
const VALID_SORT_COLUMNS = ["id", "title", "author", "word_count"] as const;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// ============================================================================
// Helper Types
// ============================================================================

interface BookListParams {
  limit: number;
  offset: number;
  sortBy: string;
  order: "asc" | "desc";
}

interface BookRow {
  id: number;
  title: string;
  author: string;
  file_path: string;
  cover_image_path: string | null;
  word_count: number;
  created_at: string;
  click_count: number;
  pagerank_score?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse list query parameters with defaults
 */
function parseListParams(c: { req: { query: (key: string) => string | undefined } }): BookListParams {
  return {
    limit: parseInt(c.req.query("limit") || "50"),
    offset: parseInt(c.req.query("offset") || "0"),
    sortBy: c.req.query("sortBy") || "id",
    order: (c.req.query("order") || "asc") as "asc" | "desc",
  };
}

/**
 * Build the ORDER BY clause for book queries
 */
function buildOrderByClause(sortBy: string, order: string): { join: string; orderBy: string } {
  const orderDirection = order === "desc" ? "DESC" : "ASC";

  if (sortBy === "pagerank") {
    return {
      join: "LEFT JOIN pagerank p ON b.id = p.book_id",
      orderBy: `ORDER BY p.score ${orderDirection}`,
    };
  }

  if (sortBy === "click_count") {
    return {
      join: "",
      orderBy: `ORDER BY bc.click_count ${orderDirection}`,
    };
  }

  const column = VALID_SORT_COLUMNS.includes(sortBy as typeof VALID_SORT_COLUMNS[number]) ? sortBy : "id";
  return {
    join: "",
    orderBy: `ORDER BY b.${column} ${orderDirection}`,
  };
}

/**
 * Transform a database row to a Book object with API URLs
 */
function transformBookRow(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    filePath: `/api/books/${row.id}/text`,
    coverImagePath: row.cover_image_path ? `/api/books/${row.id}/cover` : undefined,
    wordCount: row.word_count,
    createdAt: row.created_at,
    clickCount: row.click_count,
  };
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "image/jpeg";
}

// ============================================================================
// List & Stats Routes
// ============================================================================

/** GET /api/books - Liste tous les livres */
app.get("/", async (c) => {
  const { limit, offset, sortBy, order } = parseListParams(c);
  const db = getDatabase();

  const { join: extraJoin, orderBy } = buildOrderByClause(sortBy, order);

  const query = `
    SELECT b.id, b.title, b.author, b.file_path, b.cover_image_path, b.word_count, b.created_at,
           COALESCE(bc.click_count, 0) as click_count
    FROM books b
    LEFT JOIN book_clicks bc ON b.id = bc.book_id
    ${extraJoin}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const results = db.prepare(query).all(limit, offset) as BookRow[];
  const books = results.map(transformBookRow);

  const totalResult = db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number };

  return c.json({ books, total: totalResult.count, limit, offset });
});

/** GET /api/books/stats - Récupère les statistiques de la bibliothèque */
app.get("/stats", async (c) => {
  const db = getDatabase();

  const meta = db.prepare("SELECT key, value FROM library_metadata").all() as Array<{ key: string; value: string }>;
  const metaObj = Object.fromEntries(meta.map((m) => [m.key, m.value]));

  const stats: LibraryStats = {
    totalBooks: parseInt(metaObj.total_books || "0"),
    totalTerms: parseInt(metaObj.total_terms || "0"),
    avgDocLength: parseFloat(metaObj.avg_doc_length || "0"),
    totalWords: parseInt(metaObj.total_words || "0"),
    jaccardEdges: parseInt(metaObj.jaccard_edges || "0"),
    pageRankCalculated: metaObj.pagerank_calculated === "true",
  };

  return c.json(stats);
});

// ============================================================================
// Single Book Routes
// ============================================================================

/** GET /api/books/:id - Récupère un livre par son ID */
app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const book = db.prepare(`
    SELECT b.id, b.title, b.author, b.file_path, b.cover_image_path, b.word_count, b.created_at,
           p.score as pagerank_score,
           COALESCE(bc.click_count, 0) as click_count
    FROM books b
    LEFT JOIN pagerank p ON b.id = p.book_id
    LEFT JOIN book_clicks bc ON b.id = bc.book_id
    WHERE b.id = ?
  `).get(id) as (BookRow & { pagerank_score?: number }) | undefined;

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  return c.json({
    id: book.id,
    title: book.title,
    author: book.author,
    filePath: `/api/books/${book.id}/text`,
    coverImagePath: book.cover_image_path ? `/api/books/${book.id}/cover` : undefined,
    wordCount: book.word_count,
    createdAt: book.created_at,
    pageRank: book.pagerank_score,
    clickCount: book.click_count,
  });
});

// ============================================================================
// Click Tracking
// ============================================================================

/** POST /api/books/:id/click - Enregistre un clic sur un livre */
app.post("/:id/click", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const bookExists = db.prepare("SELECT id FROM books WHERE id = ?").get(id);
  if (!bookExists) {
    return c.json({ error: "Book not found" }, 404);
  }

  db.prepare(`
    INSERT INTO book_clicks (book_id, click_count, last_clicked)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(book_id) DO UPDATE SET
      click_count = click_count + 1,
      last_clicked = CURRENT_TIMESTAMP
  `).run(id);

  const result = db.prepare("SELECT click_count FROM book_clicks WHERE book_id = ?").get(id) as { click_count: number } | undefined;

  return c.json({ success: true, clickCount: result?.click_count || 1 });
});

// ============================================================================
// Cover Image Routes
// ============================================================================

/** POST /api/books/:id/cover - Upload une image de couverture */
app.post("/:id/cover", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const bookExists = db.prepare("SELECT id FROM books WHERE id = ?").get(id);
  if (!bookExists) {
    return c.json({ error: "Book not found" }, 404);
  }

  try {
    const body = await c.req.parseBody();
    const file = body["cover"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No cover image provided" }, 400);
    }

    if (!existsSync(COVERS_DIR)) {
      mkdirSync(COVERS_DIR, { recursive: true });
    }

    const ext = extname(file.name) || ".jpg";
    const filename = `book-${id}${ext}`;
    const filepath = join(COVERS_DIR, filename);

    const arrayBuffer = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(arrayBuffer));

    db.prepare("UPDATE books SET cover_image_path = ? WHERE id = ?").run(filepath, id);

    return c.json({ success: true, coverImagePath: filepath });
  } catch (error) {
    console.error("Error uploading cover:", error);
    return c.json({ error: "Failed to upload cover image" }, 500);
  }
});

/** GET /api/books/:id/cover - Récupère l'image de couverture */
app.get("/:id/cover", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const book = db.prepare("SELECT cover_image_path FROM books WHERE id = ?").get(id) as { cover_image_path: string | null } | undefined;

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  if (!book.cover_image_path || !existsSync(book.cover_image_path)) {
    return c.json({ error: "Cover image not found" }, 404);
  }

  try {
    const imageBuffer = readFileSync(book.cover_image_path);
    const contentType = getMimeType(book.cover_image_path);

    return c.body(imageBuffer, 200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
    });
  } catch (error) {
    console.error("Error reading cover image:", error);
    return c.json({ error: "Failed to read cover image" }, 500);
  }
});

// ============================================================================
// Book Text Streaming
// ============================================================================

const STREAM_CHUNK_SIZE = 64 * 1024; // 64KB chunks

/** GET /api/books/:id/text - Stream le contenu d'un livre */
app.get("/:id/text", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const book = db.prepare("SELECT file_path FROM books WHERE id = ?").get(id) as { file_path: string | null } | undefined;

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  if (!book.file_path || !existsSync(book.file_path)) {
    return c.json({ error: "Book text not found" }, 404);
  }

  try {
    return stream(c, async (streamWriter) => {
      const fileStream = createReadStream(book.file_path!, {
        encoding: "utf-8",
        highWaterMark: STREAM_CHUNK_SIZE,
      });

      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("Cache-Control", "public, max-age=3600");

      for await (const chunk of fileStream) {
        await streamWriter.write(chunk);
      }
    });
  } catch (error) {
    console.error("Error streaming book text:", error);
    return c.json({ error: "Failed to stream book text" }, 500);
  }
});

export default app;
