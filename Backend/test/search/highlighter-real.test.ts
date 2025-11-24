/**
 * Tests pour le Highlighter (code réel)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Highlighter } from "../../src/search/highlighter";
import * as fs from "fs";
import * as path from "path";

describe("Highlighter - Code réel", () => {
  let highlighter: Highlighter;
  let testFilePath: string;

  beforeEach(() => {
    highlighter = new Highlighter();

    // Créer un fichier de test temporaire
    testFilePath = path.join("/tmp", `test-book-${Date.now()}.txt`);
    const testContent =
      "The quick brown fox jumps over the lazy dog. The fox is very quick and clever.";
    fs.writeFileSync(testFilePath, testContent, "utf-8");
  });

  afterEach(() => {
    // Nettoyer le fichier de test
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe("Génération de snippets", () => {
    it("devrait générer des snippets avec highlighting", () => {
      const terms = ["fox", "quick"];
      const positions = new Map([
        ["fox", [16, 49]],
        ["quick", [4, 60]],
      ]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions
      );

      expect(snippets.length).toBeGreaterThan(0);
      expect(snippets[0].text).toContain("<mark>");
      expect(snippets[0].text).toContain("</mark>");
    });

    it("devrait inclure les termes matchés dans chaque snippet", () => {
      const terms = ["fox"];
      const positions = new Map([["fox", [16, 49]]]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions
      );

      expect(snippets[0].matchedTerms).toContain("fox");
    });

    it("devrait retourner un tableau vide si aucune position", () => {
      const terms = ["nonexistent"];
      const positions = new Map();

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions
      );

      expect(snippets).toEqual([]);
    });

    it("devrait retourner un tableau vide si le fichier n'existe pas", () => {
      const terms = ["fox"];
      const positions = new Map([["fox", [16]]]);

      const snippets = highlighter.generateSnippets(
        "/nonexistent/file.txt",
        terms,
        positions
      );

      expect(snippets).toEqual([]);
    });

    it("devrait fusionner des snippets proches", () => {
      const terms = ["quick", "brown"];
      const positions = new Map([
        ["quick", [4]],
        ["brown", [10]],
      ]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions,
        {
          snippetCount: 3,
          contextBefore: 5,
          contextAfter: 5,
        }
      );

      // Les deux termes sont proches, ils devraient être dans le même snippet
      expect(snippets.length).toBe(1);
      expect(snippets[0].text).toContain("<mark>quick</mark>");
      expect(snippets[0].text).toContain("<mark>brown</mark>");
    });

    it("devrait respecter la limite de snippets", () => {
      const terms = ["the"];
      const positions = new Map([["the", [0, 45]]]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions,
        {
          snippetCount: 1,
        }
      );

      expect(snippets.length).toBeLessThanOrEqual(1);
    });

    it("devrait ajouter des ellipses au début et à la fin", () => {
      const terms = ["fox"];
      const positions = new Map([["fox", [16]]]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions,
        {
          contextBefore: 5,
          contextAfter: 5,
        }
      );

      expect(snippets[0].text).toMatch(/^\.\.\./);
      expect(snippets[0].text).toMatch(/\.\.\.$/);
    });

    it("ne devrait pas ajouter d'ellipse si le snippet couvre tout le texte", () => {
      const terms = ["the"];
      const positions = new Map([["the", [0]]]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions,
        {
          contextBefore: 1000,
          contextAfter: 1000,
        }
      );

      expect(snippets[0].text).not.toMatch(/^\.\.\./);
    });

    it("devrait enregistrer la position du premier match", () => {
      const terms = ["fox"];
      const positions = new Map([["fox", [16, 49]]]);

      const snippets = highlighter.generateSnippets(
        testFilePath,
        terms,
        positions
      );

      expect(snippets[0].position).toBe(16);
    });
  });
});

