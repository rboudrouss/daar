/**
 * Tests pour le Tokenizer (code réel)
 * Focus sur les comportements théoriques de la tokenization
 */

import { describe, it, expect } from "vitest";
import { Tokenizer } from "../../src/indexing/tokenizer";

describe("Tokenizer - Code réel", () => {
  describe("Tokenization de base", () => {
    it("devrait extraire les mots d'un texte simple", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("Hello world");

      expect(result.terms).toEqual(["hello", "world"]);
      expect(result.totalTokens).toBe(2);
    });

    it("devrait gérer la ponctuation", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("Hello, world! How are you?");

      expect(result.terms).toEqual(["hello", "world", "how", "are", "you"]);
    });

    it("devrait gérer les nombres", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("I have 123 apples and 456 oranges");

      expect(result.terms).toContain("123");
      expect(result.terms).toContain("456");
    });

    it("devrait gérer les caractères accentués", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("café résumé naïve");

      expect(result.terms).toEqual(["café", "résumé", "naïve"]);
    });
  });

  describe("Normalisation de la casse", () => {
    it("devrait convertir en minuscules par défaut", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("Hello WORLD");

      expect(result.terms).toEqual(["hello", "world"]);
    });

    it("devrait préserver la casse si caseSensitive=true", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: true,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("Hello WORLD");

      expect(result.terms).toEqual(["Hello", "WORLD"]);
    });
  });

  describe("Filtrage par longueur minimale", () => {
    it("devrait filtrer les mots trop courts", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 2,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("I am a developer");

      expect(result.terms).toEqual(["am", "developer"]);
      expect(result.terms).not.toContain("i");
      expect(result.terms).not.toContain("a");
    });

    it("devrait garder tous les mots si minWordLength=1", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("I am a developer");

      expect(result.terms).toEqual(["i", "am", "a", "developer"]);
    });
  });

  describe("Suppression des stop words", () => {
    it("devrait supprimer les stop words", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: true,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("the cat and the dog");

      expect(result.terms).toEqual(["cat", "dog"]);
      expect(result.terms).not.toContain("the");
      expect(result.terms).not.toContain("and");
    });

    it("devrait garder les stop words si removeStopWords=false", () => {
      const tokenizer = new Tokenizer({
        removeStopWords: false,
        minWordLength: 1,
        caseSensitive: false,
        keepPositions: false,
      });

      const result = tokenizer.tokenize("the cat and the dog");

      expect(result.terms).toEqual(["the", "cat", "and", "the", "dog"]);
    });
  });
});
