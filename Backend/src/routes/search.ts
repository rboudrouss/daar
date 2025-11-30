/**
 * Routes API pour la recherche
 */

import { Hono } from "hono";
import { SearchEngine } from "../search/search-engine.js";
import type { SearchParams, SearchResponse, SearchResult, Book, BookSuggestion } from "../utils/types.js";

const app = new Hono();

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SNIPPET_COUNT = 3;
const DEFAULT_SNIPPET_LENGTH = 150;
const DEFAULT_FUZZY_DISTANCE = 2;

// ============================================================================
// Helper Types
// ============================================================================

type SearchField = "title" | "author" | "content";

interface BasicSearchParams {
  query: string | undefined;
  limit: number;
  offset: number;
  withSuggestions: boolean;
}

interface AdvancedSearchOptions {
  highlight: boolean;
  fuzzy: boolean;
  fuzzyDistance: number;
}

interface SearchFilters {
  author: string | undefined;
  minWordCount: number | undefined;
  maxWordCount: number | undefined;
  minPageRank: number | undefined;
  searchFields: SearchField[] | undefined;
}

// ============================================================================
// URL Transformation Helpers
// ============================================================================

/** Transform file paths to API URLs for a book */
function transformBookToUrls(book: Book): Book {
  return {
    ...book,
    filePath: `/api/books/${book.id}/text`,
    coverImagePath: book.coverImagePath ? `/api/books/${book.id}/cover` : undefined,
  };
}

/** Transform search results to use API URLs */
function transformSearchResults(results: SearchResult[]): SearchResult[] {
  return results.map((result) => ({
    ...result,
    book: transformBookToUrls(result.book),
  }));
}

/** Transform suggestions to use API URLs */
function transformSuggestions(suggestions: BookSuggestion[]): BookSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    book: transformBookToUrls(suggestion.book),
  }));
}

// ============================================================================
// Search Engine Singleton
// ============================================================================

let searchEngine: SearchEngine | null = null;

function getSearchEngine(): SearchEngine {
  if (!searchEngine) {
    searchEngine = new SearchEngine();
  }
  return searchEngine;
}

// ============================================================================
// Query Parameter Parsing
// ============================================================================

/** Parse basic search parameters from request */
function parseBasicParams(c: { req: { query: (key: string) => string | undefined } }): BasicSearchParams {
  return {
    query: c.req.query("q"),
    limit: parseInt(c.req.query("limit") || String(DEFAULT_SEARCH_LIMIT)),
    offset: parseInt(c.req.query("offset") || "0"),
    withSuggestions: c.req.query("suggestions") === "true",
  };
}

/** Parse advanced search options from request */
function parseAdvancedOptions(c: { req: { query: (key: string) => string | undefined } }): AdvancedSearchOptions {
  return {
    highlight: c.req.query("highlight") === "true",
    fuzzy: c.req.query("fuzzy") === "true",
    fuzzyDistance: parseInt(c.req.query("fuzzyDistance") || String(DEFAULT_FUZZY_DISTANCE)),
  };
}

/** Parse search filters from request */
function parseSearchFilters(c: { req: { query: (key: string) => string | undefined } }): SearchFilters {
  const fieldsParam = c.req.query("fields");

  return {
    author: c.req.query("author"),
    minWordCount: c.req.query("minWordCount") ? parseInt(c.req.query("minWordCount")!) : undefined,
    maxWordCount: c.req.query("maxWordCount") ? parseInt(c.req.query("maxWordCount")!) : undefined,
    minPageRank: c.req.query("minPageRank") ? parseFloat(c.req.query("minPageRank")!) : undefined,
    searchFields: fieldsParam ? (fieldsParam.split(",") as SearchField[]) : undefined,
  };
}

/** Build SearchParams from parsed components */
function buildSearchParams(
  query: string,
  basic: BasicSearchParams,
  advanced: AdvancedSearchOptions,
  filters: SearchFilters
): SearchParams {
  return {
    query,
    limit: basic.limit,
    offset: basic.offset,
    highlight: advanced.highlight,
    fuzzy: advanced.fuzzy,
    fuzzyDistance: advanced.fuzzyDistance,
    author: filters.author,
    minWordCount: filters.minWordCount,
    maxWordCount: filters.maxWordCount,
    minPageRank: filters.minPageRank,
    searchFields: filters.searchFields,
    snippetCount: DEFAULT_SNIPPET_COUNT,
    snippetLength: DEFAULT_SNIPPET_LENGTH,
  };
}

/** Execute search and build response */
function executeSearch(
  engine: SearchEngine,
  params: SearchParams,
  withSuggestions: boolean,
  startTime: number
): SearchResponse {
  const results = engine.search(params);
  const suggestions = withSuggestions ? engine.getSuggestions(results) : undefined;

  return {
    results: transformSearchResults(results),
    total: results.length,
    query: params.query,
    executionTimeMs: Date.now() - startTime,
    suggestions,
  };
}

// ============================================================================
// Search Routes
// ============================================================================

/** GET /api/search - Recherche simple par mot-clé avec options avancées */
app.get("/", async (c) => {
  const basic = parseBasicParams(c);

  if (!basic.query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const advanced = parseAdvancedOptions(c);
  const filters = parseSearchFilters(c);
  const params = buildSearchParams(basic.query, basic, advanced, filters);

  const startTime = Date.now();
  const engine = getSearchEngine();
  const response = executeSearch(engine, params, basic.withSuggestions, startTime);

  return c.json(response);
});

/** GET /api/search/advanced - Recherche avancée par RegEx */
app.get("/advanced", async (c) => {
  const regex = c.req.query("regex");
  const limit = parseInt(c.req.query("limit") || String(DEFAULT_SEARCH_LIMIT));
  const offset = parseInt(c.req.query("offset") || "0");
  const caseSensitive = c.req.query("caseSensitive") === "true";
  const withSuggestions = c.req.query("suggestions") === "true";

  if (!regex) {
    return c.json({ error: 'Query parameter "regex" is required' }, 400);
  }

  const startTime = Date.now();
  const params: SearchParams = { query: regex, limit, offset, useRegex: true, caseSensitive };

  try {
    const engine = getSearchEngine();
    const results = engine.searchRegex(params);
    const suggestions = withSuggestions ? engine.getSuggestions(results) : undefined;

    const response: SearchResponse = {
      results: transformSearchResults(results),
      total: results.length,
      query: regex,
      executionTimeMs: Date.now() - startTime,
      suggestions,
    };

    return c.json(response);
  } catch (error) {
    return c.json({ error: "Invalid regex pattern", details: (error as Error).message }, 400);
  }
});

// ============================================================================
// Suggestions & Recommendations Routes
// ============================================================================

const DEFAULT_SUGGESTION_LIMIT = 10;

/** GET /api/search/suggestions - Récupère les suggestions pour un livre spécifique */
app.get("/suggestions", async (c) => {
  const bookIdStr = c.req.query("bookId");
  const limit = parseInt(c.req.query("limit") || String(DEFAULT_SUGGESTION_LIMIT));

  if (!bookIdStr) {
    return c.json({ error: 'Query parameter "bookId" is required' }, 400);
  }

  const bookId = parseInt(bookIdStr);
  const engine = getSearchEngine();

  // Access database through engine (internal API)
  const db = (engine as unknown as { db: { prepare: (sql: string) => { get: (id: number) => unknown } } }).db;
  const book = db.prepare(`
    SELECT b.id, b.title, b.author, b.file_path, b.cover_image_path, b.word_count,
           COALESCE(bc.click_count, 0) as click_count
    FROM books b
    LEFT JOIN book_clicks bc ON b.id = bc.book_id
    WHERE b.id = ?
  `).get(bookId) as {
    id: number;
    title: string;
    author: string;
    file_path: string;
    cover_image_path: string | null;
    word_count: number;
    click_count: number;
  } | undefined;

  if (!book) {
    return c.json({ error: "Book not found" }, 404);
  }

  const fakeResults: SearchResult[] = [{
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      filePath: book.file_path,
      coverImagePath: book.cover_image_path ?? undefined,
      wordCount: book.word_count,
      clickCount: book.click_count,
    },
    score: 1.0,
  }];

  const suggestions = engine.getSuggestions(fakeResults, limit);

  return c.json({
    bookId,
    suggestions: transformSuggestions(suggestions),
    total: suggestions.length,
  });
});

/** GET /api/search/recommendations - Recommandations basées sur l'historique de clics */
app.get("/recommendations", async (c) => {
  const limit = parseInt(c.req.query("limit") || String(DEFAULT_SUGGESTION_LIMIT));

  const engine = getSearchEngine();
  const recommendations = engine.getRecommendations(limit);

  return c.json({
    recommendations,
    total: recommendations.length,
  });
});

// ============================================================================
// Similar Books Route
// ============================================================================

/** GET /api/search/similar/:bookId - Trouve des livres similaires par sémantique */
app.get("/similar/:bookId", async (c) => {
  const bookId = parseInt(c.req.param("bookId"));
  const limit = parseInt(c.req.query("limit") || String(DEFAULT_SUGGESTION_LIMIT));

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
