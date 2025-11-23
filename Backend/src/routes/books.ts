/**
 * Routes API pour les livres
 */

import { Hono } from "hono";
import { getDatabase } from "../db/connection";
import type { Book, LibraryStats } from "../utils/types";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, extname } from "path";

const app = new Hono();

/**
 * GET /api/books
 * Liste tous les livres
 */
app.get("/", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const sortBy = c.req.query("sortBy") || "id"; // id, title, author, pagerank
  const order = c.req.query("order") || "asc"; // asc, desc

  const db = getDatabase();

  let query = `
    SELECT b.id, b.title, b.author, b.file_path, b.cover_image_path, b.word_count, b.created_at
    FROM books b
  `;

  // Ajouter le tri par PageRank si demandé
  if (sortBy === "pagerank") {
    query += `
      LEFT JOIN pagerank p ON b.id = p.book_id
      ORDER BY p.score ${order === "desc" ? "DESC" : "ASC"}
    `;
  } else {
    const validColumns = ["id", "title", "author", "word_count"];
    const column = validColumns.includes(sortBy) ? sortBy : "id";
    query += ` ORDER BY b.${column} ${order === "desc" ? "DESC" : "ASC"}`;
  }

  query += ` LIMIT ? OFFSET ?`;

  const results = db.prepare(query).all(limit, offset) as any[];

  const books: Book[] = results.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author,
    filePath: r.file_path,
    coverImagePath: r.cover_image_path,
    wordCount: r.word_count,
    createdAt: r.created_at,
  }));

  // Compter le total
  const totalResult = db
    .prepare("SELECT COUNT(*) as count FROM books")
    .get() as { count: number };

  return c.json({
    books,
    total: totalResult.count,
    limit,
    offset,
  });
});

/**
 * GET /api/books/stats
 * Récupère les statistiques de la bibliothèque
 */
app.get("/stats", async (c) => {
  const db = getDatabase();

  const meta = db
    .prepare("SELECT key, value FROM library_metadata")
    .all() as Array<{ key: string; value: string }>;
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

/**
 * GET /api/books/:id
 * Récupère un livre par son ID
 */
app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const book = db
    .prepare(
      `
    SELECT b.id, b.title, b.author, b.file_path, b.cover_image_path, b.word_count, b.created_at,
           p.score as pagerank_score
    FROM books b
    LEFT JOIN pagerank p ON b.id = p.book_id
    WHERE b.id = ?
  `
    )
    .get(id) as any;

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  return c.json({
    id: book.id,
    title: book.title,
    author: book.author,
    filePath: book.file_path,
    coverImagePath: book.cover_image_path,
    wordCount: book.word_count,
    createdAt: book.created_at,
    pageRankScore: book.pagerank_score,
  });
});

/**
 * POST /api/books/:id/click
 * Enregistre un clic sur un livre (pour les suggestions populaires)
 */
app.post("/:id/click", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  // Vérifier que le livre existe
  const book = db.prepare("SELECT id FROM books WHERE id = ?").get(id);

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  // Incrémenter le compteur de clics
  db.prepare(
    `
    INSERT INTO book_clicks (book_id, click_count, last_clicked)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(book_id) DO UPDATE SET
      click_count = click_count + 1,
      last_clicked = CURRENT_TIMESTAMP
  `
  ).run(id);

  return c.json({ success: true });
});

/**
 * POST /api/books/:id/cover
 * Upload une image de couverture pour un livre
 */
app.post("/:id/cover", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  // Vérifier que le livre existe
  const book = db.prepare("SELECT id FROM books WHERE id = ?").get(id);

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  try {
    const body = await c.req.parseBody();
    const file = body["cover"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No cover image provided" }, 400);
    }

    const coversDir = "./data/covers";
    if (!existsSync(coversDir)) {
      mkdirSync(coversDir, { recursive: true });
    }

    const ext = extname(file.name) || ".jpg";
    const filename = `book-${id}${ext}`;
    const filepath = join(coversDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(filepath, buffer);

    db.prepare("UPDATE books SET cover_image_path = ? WHERE id = ?").run(
      filepath,
      id
    );

    return c.json({
      success: true,
      coverImagePath: filepath,
    });
  } catch (error) {
    console.error("Error uploading cover:", error);
    return c.json({ error: "Failed to upload cover image" }, 500);
  }
});

/**
 * GET /api/books/:id/cover
 * Récupère l'image de couverture d'un livre
 */
app.get("/:id/cover", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = getDatabase();

  const book = db
    .prepare("SELECT cover_image_path FROM books WHERE id = ?")
    .get(id) as { cover_image_path: string | null } | undefined;

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  if (!book.cover_image_path || !existsSync(book.cover_image_path)) {
    return c.json({ error: "Cover image not found" }, 404);
  }

  try {
    const imageBuffer = readFileSync(book.cover_image_path);

    const ext = extname(book.cover_image_path).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "image/jpeg";

    return c.body(imageBuffer, 200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
    });
  } catch (error) {
    console.error("Error reading cover image:", error);
    return c.json({ error: "Failed to read cover image" }, 500);
  }
});

export default app;
