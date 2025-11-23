/**
 * API client for the Backend Library Search Engine
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface Book {
  id: number;
  title: string;
  author: string;
  filePath: string;
  coverImagePath?: string;
  wordCount: number;
  createdAt: string;
  pageRank?: number;
}

export interface SearchResult {
  book: Book;
  score: number;
  matchedTerms: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  executionTime: number;
}

export interface BookStats {
  totalBooks: number;
  totalWords: number;
  avgDocLength: number;
  totalTerms: number;
  jaccardEdges: number;
  pageRankCalculated: boolean;
  lastIndexed: string;
}

export interface SuggestionResult {
  book: Book;
  similarity: number;
  reason: string;
}

/**
 * Search for books using BM25 algorithm
 */
export async function searchBooks(
  query: string,
  limit: number = 20
): Promise<SearchResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Advanced search using regex patterns
 */
export async function advancedSearch(
  regex: string,
  limit: number = 20
): Promise<SearchResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/search/advanced?regex=${encodeURIComponent(regex)}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Advanced search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get book recommendations based on Jaccard similarity
 */
export async function getBookSuggestions(
  bookId: number,
  limit: number = 10
): Promise<SuggestionResult[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/search/suggestions?bookId=${bookId}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get suggestions: ${response.statusText}`);
  }

  const data = await response.json();
  return data.suggestions;
}

/**
 * Get all books
 */
export async function getAllBooks(): Promise<Book[]> {
  const response = await fetch(`${API_BASE_URL}/api/books`);

  if (!response.ok) {
    throw new Error(`Failed to get books: ${response.statusText}`);
  }

  const data = await response.json();
  return data.books;
}

/**
 * Get a single book by ID
 */
export async function getBookById(id: number): Promise<Book> {
  const response = await fetch(`${API_BASE_URL}/api/books/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to get book: ${response.statusText}`);
  }

  const data = await response.json();
  return data.book;
}

/**
 * Get library statistics
 */
export async function getStats(): Promise<BookStats> {
  const response = await fetch(`${API_BASE_URL}/api/books/stats`);

  if (!response.ok) {
    throw new Error(`Failed to get stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the cover image URL for a book
 */
export function getCoverImageUrl(bookId: number): string {
  return `${API_BASE_URL}/api/books/${bookId}/cover`;
}
