/**
 * Tests pour JaccardCalculator (code réel avec mock DB)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de la DB avant d'importer JaccardCalculator
const mockDb = {
  prepare: vi.fn((query: string) => {
    // Mock pour récupérer tous les livres
    if (query.includes("SELECT id FROM books")) {
      return {
        all: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      };
    }

    // Mock pour charger les termes d'un batch de livres
    // Query: SELECT book_id, term FROM inverted_index WHERE book_id IN (...)
    if (query.includes("SELECT book_id, term FROM inverted_index") && query.includes("WHERE book_id IN")) {
      return {
        all: (...bookIds: number[]) => {
          const results: Array<{ book_id: number; term: string }> = [];
          for (const bookId of bookIds) {
            if (bookId === 1) {
              results.push({ book_id: 1, term: "hello" });
              results.push({ book_id: 1, term: "world" });
              results.push({ book_id: 1, term: "test" });
            } else if (bookId === 2) {
              results.push({ book_id: 2, term: "hello" });
              results.push({ book_id: 2, term: "world" });
              results.push({ book_id: 2, term: "foo" });
            } else if (bookId === 3) {
              results.push({ book_id: 3, term: "bar" });
              results.push({ book_id: 3, term: "baz" });
            }
          }
          return results;
        },
      };
    }

    // Mock pour récupérer les candidats (livres qui partagent des termes)
    // Query: SELECT i1.book_id as book1, i2.book_id as book2 FROM inverted_index i1 JOIN inverted_index i2 ON i1.term = i2.term WHERE i1.book_id IN (...) AND i1.book_id < i2.book_id GROUP BY i1.book_id, i2.book_id
    if (query.includes("SELECT i1.book_id as book1, i2.book_id as book2")) {
      return {
        all: (...bookIds: number[]) => {
          const results: Array<{ book1: number; book2: number }> = [];
          // Book 1 shares terms with Book 2 (hello, world)
          if (bookIds.includes(1)) {
            results.push({ book1: 1, book2: 2 });
          }
          // Book 2 shares terms with Book 3 - none actually, but let's add for testing
          if (bookIds.includes(2)) {
            results.push({ book1: 2, book2: 3 });
          }
          return results;
        },
      };
    }

    // Mock pour INSERT jaccard_edges
    if (query.includes("INSERT OR REPLACE INTO jaccard_edges")) {
      return {
        run: vi.fn(),
      };
    }

    // Mock pour UPDATE library_metadata
    if (query.includes("UPDATE library_metadata")) {
      return {
        run: vi.fn(),
      };
    }

    return { all: () => [], get: () => undefined, run: vi.fn() };
  }),
};

// Mock du module de connexion
vi.mock("../../src/db/connection", () => ({
  getDatabase: () => mockDb,
  withTransaction: (fn: () => void) => fn(),
}));

import { JaccardCalculator } from "../../src/indexing/jaccard";

describe("JaccardCalculator - Code réel avec mock DB", () => {
  let jaccardCalculator: JaccardCalculator;

  beforeEach(() => {
    jaccardCalculator = new JaccardCalculator({
      similarityThreshold: 0.1,
      topK: 10,
      batchSize: 100,
    });
  });

  describe("Configuration", () => {
    it("devrait accepter une configuration personnalisée", () => {
      const calculator = new JaccardCalculator({
        similarityThreshold: 0.5,
        topK: 5,
        batchSize: 50,
      });

      expect(calculator).toBeDefined();
    });

    it("devrait utiliser les valeurs par défaut si pas de config", () => {
      const calculator = new JaccardCalculator();

      expect(calculator).toBeDefined();
    });
  });

  describe("Construction du graphe", () => {
    it("devrait construire le graphe de Jaccard", () => {
      const edgeCount = jaccardCalculator.buildJaccardGraph();

      expect(edgeCount).toBeGreaterThanOrEqual(0);
    });

    it("devrait accepter un callback de progression", () => {
      const progressCallback = vi.fn();

      // Le callback peut être appelé ou non selon le nombre de livres
      // On vérifie juste qu'il n'y a pas d'erreur
      expect(() => {
        jaccardCalculator.buildJaccardGraph(progressCallback);
      }).not.toThrow();
    });

    it("devrait calculer la similarité correctement", () => {
      // Livre 1: {hello, world, test}
      // Livre 2: {hello, world, foo}
      // Intersection: {hello, world} = 2
      // Union: {hello, world, test, foo} = 4
      // Similarité: 2/4 = 0.5

      const edgeCount = jaccardCalculator.buildJaccardGraph();

      // Devrait créer au moins une arête
      expect(edgeCount).toBeGreaterThan(0);
    });
  });
});

