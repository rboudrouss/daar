/**
 * Tests pour BookIndexer (code réel avec mock DB)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock de la DB avant d'importer BookIndexer
const mockDb = {
  prepare: vi.fn((query: string) => {
    // Mock pour INSERT INTO books
    if (query.includes("INSERT INTO books")) {
      return {
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      };
    }

    // Mock pour INSERT INTO inverted_index
    if (query.includes("INSERT INTO inverted_index")) {
      return {
        run: vi.fn(),
      };
    }

    // Mock pour INSERT INTO term_stats
    if (query.includes("INSERT INTO term_stats")) {
      return {
        run: vi.fn(),
      };
    }

    // Mock pour DELETE FROM inverted_index
    if (query.includes("DELETE FROM inverted_index")) {
      return {
        run: vi.fn(),
      };
    }

    // Mock pour UPDATE term_stats
    if (query.includes("UPDATE term_stats")) {
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

import { BookIndexer } from "../../src/indexing/indexer";
import { Tokenizer } from "../../src/indexing/tokenizer";

describe("BookIndexer - Code réel avec mock DB", () => {
  let indexer: BookIndexer;
  let testFilePath: string;
  const testContent =
    "The quick brown fox jumps over the lazy dog. The fox is very quick and clever.";

  beforeEach(() => {
    indexer = new BookIndexer();

    // Créer un fichier de test temporaire
    testFilePath = path.join("/tmp", `test-book-${Date.now()}.txt`);
    fs.writeFileSync(testFilePath, testContent, "utf-8");
  });

  afterEach(() => {
    // Nettoyer le fichier de test
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe("Indexation d'un livre", () => {
    it("devrait indexer un livre avec métadonnées", () => {
      // Créer un fichier frais pour ce test
      const freshFilePath = path.join("/tmp", `test-index-${Date.now()}.txt`);
      fs.writeFileSync(freshFilePath, testContent, "utf-8");

      try {
        const book = indexer.indexBook({
          title: "Test Book",
          author: "Test Author",
          filePath: freshFilePath,
        });

        expect(book).toBeDefined();
        expect(book.id).toBe(1);
        expect(book.title).toBe("Test Book");
        expect(book.author).toBe("Test Author");
      } finally {
        if (fs.existsSync(freshFilePath)) {
          fs.unlinkSync(freshFilePath);
        }
      }
    });

    it("devrait compter les mots correctement", () => {
      // Créer un fichier frais pour ce test
      const freshFilePath = path.join("/tmp", `test-count-${Date.now()}.txt`);
      fs.writeFileSync(freshFilePath, testContent, "utf-8");

      try {
        const book = indexer.indexBook({
          title: "Test Book",
          author: "Test Author",
          filePath: freshFilePath,
        });

        expect(book.wordCount).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(freshFilePath)) {
          fs.unlinkSync(freshFilePath);
        }
      }
    });

    it("devrait gérer les couvertures optionnelles", () => {
      // Créer un fichier frais pour ce test
      const freshFilePath = path.join("/tmp", `test-cover-${Date.now()}.txt`);
      fs.writeFileSync(freshFilePath, testContent, "utf-8");

      try {
        const book = indexer.indexBook({
          title: "Test Book",
          author: "Test Author",
          filePath: freshFilePath,
          coverImagePath: "/path/to/cover.jpg",
        });

        expect(book.coverImagePath).toBe("/path/to/cover.jpg");
      } finally {
        if (fs.existsSync(freshFilePath)) {
          fs.unlinkSync(freshFilePath);
        }
      }
    });
  });

  describe("Réindexation d'un livre", () => {
    it("devrait réindexer un livre existant", () => {
      // Créer un nouveau fichier pour ce test
      const reindexFilePath = path.join("/tmp", `test-reindex-${Date.now()}.txt`);
      fs.writeFileSync(reindexFilePath, testContent, "utf-8");

      try {
        expect(() => {
          indexer.reindexBook(1, reindexFilePath);
        }).not.toThrow();
      } finally {
        // Nettoyer
        if (fs.existsSync(reindexFilePath)) {
          fs.unlinkSync(reindexFilePath);
        }
      }
    });
  });

  describe("Tokenizer personnalisé", () => {
    it("devrait accepter un tokenizer personnalisé", () => {
      const customTokenizer = new Tokenizer({
        removeStopWords: true,
        minWordLength: 3,
      });

      const customIndexer = new BookIndexer(customTokenizer);

      expect(customIndexer).toBeDefined();
    });
  });

  describe("Gestion des erreurs", () => {
    it("devrait gérer les fichiers inexistants", () => {
      expect(() => {
        indexer.indexBook({
          title: "Test Book",
          author: "Test Author",
          filePath: "/nonexistent/file.txt",
        });
      }).toThrow();
    });
  });
});

