/**
 * Routes API pour la recherche
 */

import { Hono } from "hono";
import { SearchEngine } from "../search/search-engine.js";
import {
  SearchParams,
  SearchResponse,
  SearchResult,
  Book,
  BookSuggestion,
} from "../utils/types.js";

const app = new Hono();

/**
 * Transforme les chemins de fichiers en URLs
 */
function transformBookToUrls(book: Book): Book {
  return {
    ...book,
    filePath: `/api/books/${book.id}/text`,
    coverImagePath: book.coverImagePath
      ? `/api/books/${book.id}/cover`
      : undefined,
  };
}

/**
 * Transforme les résultats de recherche pour utiliser des URLs
 */
function transformSearchResults(results: SearchResult[]): SearchResult[] {
  return results.map((result) => ({
    ...result,
    book: transformBookToUrls(result.book),
  }));
}

/**
 * Transforme les suggestions pour utiliser des URLs
 */
function transformSuggestions(
  suggestions: BookSuggestion[]
): BookSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    book: transformBookToUrls(suggestion.book),
  }));
}

// Lazy initialization du SearchEngine
let searchEngine: SearchEngine | null = null;
function getSearchEngine(): SearchEngine {
  if (!searchEngine) {
    searchEngine = new SearchEngine();
  }
  return searchEngine;
}

/**
 * GET /api/search?q=query&limit=20&offset=0&highlight=true&fuzzy=true&author=...
 * Recherche simple par mot-clé avec toutes les options avancées
 */
app.get("/", async (c) => {
  const query = c.req.query("q");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");
  const withSuggestions = c.req.query("suggestions") === "true";

  // Nouvelles options
  const highlight = c.req.query("highlight") === "true";
  const fuzzy = c.req.query("fuzzy") === "true";
  const fuzzyDistance = parseInt(c.req.query("fuzzyDistance") || "2");

  // Filtres
  const author = c.req.query("author");
  const minWordCount = c.req.query("minWordCount")
    ? parseInt(c.req.query("minWordCount")!)
    : undefined;
  const maxWordCount = c.req.query("maxWordCount")
    ? parseInt(c.req.query("maxWordCount")!)
    : undefined;
  const minPageRank = c.req.query("minPageRank")
    ? parseFloat(c.req.query("minPageRank")!)
    : undefined;

  // Multi-champs
  const searchFieldsParam = c.req.query("fields");
  const searchFields = searchFieldsParam
    ? (searchFieldsParam.split(",") as ("title" | "author" | "content")[])
    : undefined;

  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const startTime = Date.now();

  const params: SearchParams = {
    query,
    limit,
    offset,
    highlight,
    fuzzy,
    fuzzyDistance,
    author,
    minWordCount,
    maxWordCount,
    minPageRank,
    searchFields,
    snippetCount: 3,
    snippetLength: 150,
  };

  const engine = getSearchEngine();
  const results = engine.search(params);
  const suggestions = withSuggestions
    ? engine.getSuggestions(results)
    : undefined;

  const executionTimeMs = Date.now() - startTime;

  const response: SearchResponse = {
    results: transformSearchResults(results),
    total: results.length,
    query,
    executionTimeMs,
    suggestions,
  };

  return c.json(response);
});

/**
 * GET /api/search/advanced?regex=pattern&limit=20
 * Recherche avancée par RegEx
 */
app.get("/advanced", async (c) => {
  const regex = c.req.query("regex");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");
  const caseSensitive = c.req.query("caseSensitive") === "true";
  const withSuggestions = c.req.query("suggestions") === "true";

  if (!regex) {
    return c.json({ error: 'Query parameter "regex" is required' }, 400);
  }

  const startTime = Date.now();

  const params: SearchParams = {
    query: regex,
    limit,
    offset,
    useRegex: true,
    caseSensitive,
  };

  try {
    const engine = getSearchEngine();
    const results = engine.searchRegex(params);
    const suggestions = withSuggestions
      ? engine.getSuggestions(results)
      : undefined;

    const executionTimeMs = Date.now() - startTime;

    const response: SearchResponse = {
      results: transformSearchResults(results),
      total: results.length,
      query: regex,
      executionTimeMs,
      suggestions,
    };

    return c.json(response);
  } catch (error) {
    return c.json(
      { error: "Invalid regex pattern", details: (error as Error).message },
      400
    );
  }
});

/**
 * GET /api/search/suggestions?bookId=123&limit=10
 * Récupère les suggestions pour un livre spécifique
 */
app.get("/suggestions", async (c) => {
  const bookIdStr = c.req.query("bookId");
  const limit = parseInt(c.req.query("limit") || "10");

  if (!bookIdStr) {
    return c.json({ error: 'Query parameter "bookId" is required' }, 400);
  }

  const bookId = parseInt(bookIdStr);

  // Créer un résultat de recherche fictif avec ce livre
  const engine = getSearchEngine();
  const db = (engine as any).db;
  const book = db
    .prepare(
      `
    SELECT id, title, author, file_path, cover_image_path, word_count FROM books WHERE id = ?
  `
    )
    .get(bookId);

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  const fakeResults = [
    {
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        filePath: book.file_path,
        coverImagePath: book.cover_image_path,
        wordCount: book.word_count,
      },
      score: 1.0,
    },
  ];

  const suggestions = engine.getSuggestions(fakeResults, limit);

  return c.json({
    bookId,
    suggestions: transformSuggestions(suggestions),
    total: suggestions.length,
  });
});

/**
 * GET /api/search/recommendations?userId=123&limit=10
 * Recommandations basées sur l'historique de clics
 */
app.get("/recommendations", async (c) => {
  const userId = c.req.query("userId");
  const limit = parseInt(c.req.query("limit") || "10");

  const engine = getSearchEngine();
  const recommendations = engine.getRecommendations(userId, limit);

  return c.json({
    userId: userId || "global",
    recommendations,
    total: recommendations.length,
  });
});

/**
 * GET /api/search/similar/:bookId?limit=10
 * Trouve des livres similaires par sémantique (TF-IDF cosine similarity)
 */
app.get("/similar/:bookId", async (c) => {
  const bookId = parseInt(c.req.param("bookId"));
  const limit = parseInt(c.req.query("limit") || "10");

  if (isNaN(bookId)) {
    return c.json({ error: "Invalid bookId" }, 400);
  }

  const engine = getSearchEngine();
  const similar = engine.findSimilarBooks(bookId, limit);

  return c.json({
    bookId,
    similar,
    total: similar.length,
  });
});

export default app;
