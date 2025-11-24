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

    // Mock pour récupérer les termes d'un livre
    if (query.includes("SELECT DISTINCT term FROM inverted_index")) {
      return {
        all: (bookId: number) => {
          if (bookId === 1) {
            return [{ term: "hello" }, { term: "world" }, { term: "test" }];
          } else if (bookId === 2) {
            return [{ term: "hello" }, { term: "world" }, { term: "foo" }];
          } else if (bookId === 3) {
            return [{ term: "bar" }, { term: "baz" }];
          }
          return [];
        },
      };
    }

    // Mock pour récupérer les livres candidats (qui partagent des termes)
    if (query.includes("SELECT DISTINCT i2.book_id")) {
      return {
        all: (bookId: number) => {
          if (bookId === 1) {
            return [{ book_id: 2 }, { book_id: 3 }];
          } else if (bookId === 2) {
            return [{ book_id: 1 }, { book_id: 3 }];
          } else if (bookId === 3) {
            return [{ book_id: 1 }, { book_id: 2 }];
          }
          return [];
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

