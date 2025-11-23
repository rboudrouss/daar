// Re-export types from API
export type {
  Book,
  SearchResult,
  SearchResponse,
  BookStats,
  SuggestionResult,
  TextSnippet,
} from "./api";

// Legacy Book interface for backward compatibility
export interface LegacyBook {
  Language: string;
  Title: string;
  Author: string;
  link: string;
}

export function filterBooks(db: LegacyBook[], query: string) {
  if (!query) return db;
  const lowerQuery = query.toLowerCase();
  return db.filter(
    (book) =>
      book.Title.toLowerCase().includes(lowerQuery) ||
      book.Author.toLowerCase().includes(lowerQuery) ||
      book.Language.toLowerCase().includes(lowerQuery)
  );
}
