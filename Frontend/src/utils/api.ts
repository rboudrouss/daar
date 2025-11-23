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
  clickCount?: number;
}

export interface TextSnippet {
  text: string; // Texte avec <mark>...</mark> autour des termes
  position: number; // Position dans le document
  matchedTerms: string[]; // Termes matchés dans ce snippet
}

export interface SearchResult {
  book: Book;
  score: number;
  matchedTerms?: string[];
  snippets?: TextSnippet[]; // Extraits de texte avec highlighting
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
 * Get all books with pagination
 */
export async function getAllBooks(limit: number = 50, offset: number = 0, sortBy: string = "id", order: string = "asc"): Promise<{ books: Book[], total: number }> {
  const response = await fetch(`${API_BASE_URL}/api/books?limit=${limit}&offset=${offset}&sortBy=${sortBy}&order=${order}`);

  if (!response.ok) {
    throw new Error(`Failed to get books: ${response.statusText}`);
  }

  const data = await response.json();
  return { books: data.books, total: data.total };
}

/**
 * Get popular books sorted by click count
 */
export async function getPopularBooks(limit: number = 10): Promise<Book[]> {
  const response = await fetch(`${API_BASE_URL}/api/books?limit=${limit}&sortBy=click_count&order=desc`);

  if (!response.ok) {
    throw new Error(`Failed to get popular books: ${response.statusText}`);
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
  return data;
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

/**
 * Get the book text URL for a book
 */
export function getBookTextUrl(bookId: number): string {
  return `${API_BASE_URL}/api/books/${bookId}/text`;
}

/**
 * Track a click on a book (for recommendations)
 */
export async function trackBookClick(bookId: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}/click`, {
      method: "POST",
    });

    if (!response.ok) {
      console.error(`Failed to track click for book ${bookId}`);
    }
  } catch (error) {
    console.error(`Error tracking click for book ${bookId}:`, error);
  }
}

/**
 * Get recommendations based on popular books
 */
export async function getRecommendations(
  limit: number = 50
): Promise<SuggestionResult[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/search/recommendations?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get recommendations: ${response.statusText}`);
  }

  const data = await response.json();
  return data.recommendations;
}
