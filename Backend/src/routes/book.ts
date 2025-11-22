/**
 * Routes API pour les livres
 */

import { Hono } from 'hono';
import { getDatabase } from '../db/connection';
import type { Book } from '../utils/types';

const app = new Hono();

/**
 * GET /api/books
 * Liste tous les livres
 */
app.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const sortBy = c.req.query('sortBy') || 'id'; // id, title, author, pagerank
  const order = c.req.query('order') || 'asc'; // asc, desc

  const db = getDatabase();

  let query = `
    SELECT b.id, b.title, b.author, b.file_path, b.word_count, b.created_at
    FROM books b
  `;

  // Ajouter le tri par PageRank si demandé
  if (sortBy === 'pagerank') {
    query += `
      LEFT JOIN pagerank p ON b.id = p.book_id
      ORDER BY p.score ${order === 'desc' ? 'DESC' : 'ASC'}
    `;
  } else {
    const validColumns = ['id', 'title', 'author', 'word_count'];
    const column = validColumns.includes(sortBy) ? sortBy : 'id';
    query += ` ORDER BY b.${column} ${order === 'desc' ? 'DESC' : 'ASC'}`;
  }

  query += ` LIMIT ? OFFSET ?`;

  const results = db.prepare(query).all(limit, offset) as any[];

  const books: Book[] = results.map(r => ({
    id: r.id,
    title: r.title,
    author: r.author,
    filePath: r.file_path,
    wordCount: r.word_count,
    createdAt: r.created_at,
  }));

  // Compter le total
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number };

  return c.json({
    books,
    total: totalResult.count,
    limit,
    offset,
  });
});

