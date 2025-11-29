/**
 * Tests pour la recherche floue (code réel)
 * Focus sur les comportements théoriques de l'algorithme
 */

import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  findSimilarTerms,
  FuzzyMatcher,
} from "../../src/search/fuzzy";

describe("Levenshtein Distance - Code réel", () => {
  describe("Cas de base", () => {
    it("devrait retourner 0 pour deux chaînes identiques", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
      expect(levenshteinDistance("", "")).toBe(0);
      expect(levenshteinDistance("test", "test")).toBe(0);
    });

    it("devrait retourner la longueur de la chaîne non vide si l'autre est vide", () => {
      expect(levenshteinDistance("", "hello")).toBe(5);
      expect(levenshteinDistance("world", "")).toBe(5);
      expect(levenshteinDistance("", "")).toBe(0);
    });

    it("devrait calculer correctement une substitution simple", () => {
      expect(levenshteinDistance("cat", "bat")).toBe(1);
      expect(levenshteinDistance("hello", "hallo")).toBe(1);
    });

    it("devrait calculer correctement une insertion simple", () => {
      expect(levenshteinDistance("cat", "cats")).toBe(1);
      expect(levenshteinDistance("hello", "hellos")).toBe(1);
    });

    it("devrait calculer correctement une suppression simple", () => {
      expect(levenshteinDistance("cats", "cat")).toBe(1);
      expect(levenshteinDistance("hello", "hell")).toBe(1);
    });
  });

  describe("Cas complexes", () => {
    it("devrait gérer plusieurs opérations", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    });

    it("devrait gérer des mots complètement différents", () => {
      expect(levenshteinDistance("abc", "xyz")).toBe(3);
    });

    it("devrait gérer des chaînes de longueurs très différentes", () => {
      expect(levenshteinDistance("a", "abcdef")).toBe(5);
      expect(levenshteinDistance("abcdef", "a")).toBe(5);
    });
  });

  describe("Propriétés mathématiques", () => {
    it("devrait être symétrique (d(a,b) = d(b,a))", () => {
      const pairs = [
        ["hello", "world"],
        ["cat", "dog"],
        ["test", "testing"],
      ];

      for (const [a, b] of pairs) {
        expect(levenshteinDistance(a, b)).toBe(levenshteinDistance(b, a));
      }
    });

    it("devrait toujours être non-négatif", () => {
      const testCases = [
        ["", ""],
        ["a", "b"],
        ["hello", "world"],
        ["test", ""],
      ];

      for (const [a, b] of testCases) {
        expect(levenshteinDistance(a, b)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe("findSimilarTerms - Code réel", () => {
  it("devrait trouver des termes similaires avec distance <= maxDistance", () => {
    const query = "color";
    const terms = ["colour", "colors", "colored", "dolor", "cool"];

    const results = findSimilarTerms(query, terms, 2);

    // Vérifier que tous les résultats ont une distance <= 2
    for (const result of results) {
      expect(result.distance).toBeLessThanOrEqual(2);
    }

    // Vérifier que les résultats sont triés par distance
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distance).toBeGreaterThanOrEqual(
        results[i - 1].distance
      );
    }
  });

  it("devrait retourner un tableau vide si aucun terme n'est similaire", () => {
    const query = "xyz";
    const terms = ["abc", "def", "ghi"];

    const results = findSimilarTerms(query, terms, 1);

    expect(results).toEqual([]);
  });
});

describe("FuzzyMatcher - Code réel", () => {
  it("devrait trouver des correspondances exactes quand fuzzy=false", () => {
    const matcher = new FuzzyMatcher();
    const availableTerms = ["hello", "world", "test"];

    const matches = matcher.findMatchingTerms("hello", availableTerms, false);

    expect(matches).toEqual(["hello"]);
  });

  it("devrait trouver des correspondances floues quand fuzzy=true", () => {
    const matcher = new FuzzyMatcher();
    const availableTerms = ["hello", "hallo", "hullo", "world"];

    const matches = matcher.findMatchingTerms("hello", availableTerms, true, 1);

    expect(matches).toContain("hello");
    expect(matches).toContain("hallo");
    expect(matches).toContain("hullo");
    expect(matches).not.toContain("world");
  });

  it("devrait utiliser le cache pour les requêtes répétées", () => {
    const matcher = new FuzzyMatcher();
    const availableTerms = ["hello", "hallo", "world"];

    const matches1 = matcher.findMatchingTerms(
      "hello",
      availableTerms,
      true,
      1
    );
    const matches2 = matcher.findMatchingTerms(
      "hello",
      availableTerms,
      true,
      1
    );

    expect(matches1).toEqual(matches2);
  });
});
