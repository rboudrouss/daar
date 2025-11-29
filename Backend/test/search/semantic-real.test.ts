/**
 * Tests pour la recherche sémantique (code réel avec mock DB)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SemanticSearch } from "../../src/search/semantic";

describe("SemanticSearch - Code réel avec mock DB", () => {
  let mockDb: any;
  let semanticSearch: SemanticSearch;

  beforeEach(() => {
    // Mock de la base de données
    mockDb = {
      prepare: vi.fn((query: string) => {
        // Mock pour récupérer les termes d'un livre avec TF-IDF
        if (query.includes("inverted_index")) {
          return {
            all: (bookId: number) => {
              if (bookId === 1) {
                return [
                  {
                    term: "rare",
                    term_frequency: 10,
                    document_frequency: 2,
                    total_books: 100,
                  },
                  {
                    term: "word",
                    term_frequency: 5,
                    document_frequency: 50,
                    total_books: 100,
                  },
                ];
              } else if (bookId === 2) {
                return [
                  {
                    term: "rare",
                    term_frequency: 8,
                    document_frequency: 2,
                    total_books: 100,
                  },
                  {
                    term: "other",
                    term_frequency: 3,
                    document_frequency: 30,
                    total_books: 100,
                  },
                ];
              } else if (bookId === 3) {
                return [
                  {
                    term: "different",
                    term_frequency: 5,
                    document_frequency: 10,
                    total_books: 100,
                  },
                ];
              }
              return [];
            },
          };
        }

        // Mock pour récupérer tous les livres
        if (query.includes("SELECT id FROM books")) {
          return {
            all: (bookId: number) => {
              return [{ id: 2 }, { id: 3 }];
            },
          };
        }

        return { all: () => [], get: () => undefined };
      }),
    };

    semanticSearch = new SemanticSearch(mockDb);
  });

  describe("Similarité TF-IDF", () => {
    it("devrait trouver des livres similaires basés sur TF-IDF", () => {
      const similar = semanticSearch.findSimilarBooks(1, 10, 0);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0]).toHaveProperty("bookId");
      expect(similar[0]).toHaveProperty("similarity");
    });

    it("devrait retourner les résultats triés par similarité décroissante", () => {
      const similar = semanticSearch.findSimilarBooks(1, 10, 0);

      for (let i = 1; i < similar.length; i++) {
        expect(similar[i].similarity).toBeLessThanOrEqual(
          similar[i - 1].similarity
        );
      }
    });

    it("devrait filtrer par similarité minimale", () => {
      const similar = semanticSearch.findSimilarBooks(1, 10, 0.5);

      for (const result of similar) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.5);
      }
    });

    it("devrait respecter la limite de résultats", () => {
      const similar = semanticSearch.findSimilarBooks(1, 1, 0);

      expect(similar.length).toBeLessThanOrEqual(1);
    });

    it("devrait donner une similarité plus élevée aux livres partageant des termes rares", () => {
      const similar = semanticSearch.findSimilarBooks(1, 10, 0);

      // Le livre 2 partage "rare" avec le livre 1, devrait avoir une bonne similarité
      const book2 = similar.find((s) => s.bookId === 2);
      const book3 = similar.find((s) => s.bookId === 3);

      if (book2 && book3) {
        expect(book2.similarity).toBeGreaterThan(book3.similarity);
      }
    });
  });

  describe("Cache", () => {
    it("devrait permettre de nettoyer le cache", () => {
      semanticSearch.findSimilarBooks(1, 10, 0);
      expect(() => semanticSearch.clearCache()).not.toThrow();
    });
  });
});
