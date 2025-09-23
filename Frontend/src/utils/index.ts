export interface Book {
  Language: string;
  Title: string;
  Author: string;
  link: string;
}

export function filterBooks(db: Book[], query: string) {
  if (!query) return db;
  const lowerQuery = query.toLowerCase();
  return db.filter(
    (book) =>
      book.Title.toLowerCase().includes(lowerQuery) ||
      book.Author.toLowerCase().includes(lowerQuery) ||
      book.Language.toLowerCase().includes(lowerQuery)
  );
}
