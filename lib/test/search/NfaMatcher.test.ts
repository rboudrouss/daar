/**
 * Tests pour la classe NfaMatcher avec cache DFA persistant
 */

import { describe, it, expect } from "vitest";
import { NfaMatcher, parseRegex, nfaFromSyntaxTree } from "../../src";

describe("NfaMatcher", () => {
  describe("match()", () => {
    it("devrait matcher des chaînes simples", () => {
      const syntaxTree = parseRegex("abc");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      expect(matcher.match("abc")).toBe(true);
      expect(matcher.match("ab")).toBe(false);
      expect(matcher.match("abcd")).toBe(false);
      expect(matcher.match("xyz")).toBe(false);
    });

    it("devrait réutiliser le cache entre plusieurs appels", () => {
      const syntaxTree = parseRegex("a+b*");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      // Premier appel - construit le cache
      expect(matcher.match("aaa")).toBe(true);
      const stats1 = matcher.getStats();

      // Deuxième appel - réutilise et étend le cache
      expect(matcher.match("aaabbb")).toBe(true);
      const stats2 = matcher.getStats();

      // Le cache devrait avoir plus d'états après le deuxième appel
      expect(stats2.statesCreated).toBeGreaterThanOrEqual(stats1.statesCreated);

      // Troisième appel - réutilise complètement le cache
      expect(matcher.match("a")).toBe(true);
      const stats3 = matcher.getStats();

      // Le nombre d'états ne devrait pas augmenter
      expect(stats3.statesCreated).toBe(stats2.statesCreated);
    });

    it("devrait matcher avec alternation", () => {
      const syntaxTree = parseRegex("cat|dog");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      expect(matcher.match("cat")).toBe(true);
      expect(matcher.match("dog")).toBe(true);
      expect(matcher.match("bird")).toBe(false);
    });

    it("devrait matcher avec le point (.)", () => {
      const syntaxTree = parseRegex("a.c");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      expect(matcher.match("abc")).toBe(true);
      expect(matcher.match("axc")).toBe(true);
      expect(matcher.match("ac")).toBe(false);
    });

    it("devrait matcher avec l'étoile (*)", () => {
      const syntaxTree = parseRegex("ab*c");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      expect(matcher.match("ac")).toBe(true);
      expect(matcher.match("abc")).toBe(true);
      expect(matcher.match("abbc")).toBe(true);
      expect(matcher.match("abbbc")).toBe(true);
    });

    it("devrait matcher avec le plus (+)", () => {
      const syntaxTree = parseRegex("ab+c");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      expect(matcher.match("ac")).toBe(false);
      expect(matcher.match("abc")).toBe(true);
      expect(matcher.match("abbc")).toBe(true);
      expect(matcher.match("abbbc")).toBe(true);
    });

    it("devrait matcher avec le point d'interrogation (?)", () => {
      const syntaxTree = parseRegex("ab?c");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      expect(matcher.match("ac")).toBe(true);
      expect(matcher.match("abc")).toBe(true);
      expect(matcher.match("abbc")).toBe(false);
    });
  });

  describe("findAllMatches()", () => {
    it("devrait trouver toutes les occurrences dans une ligne", () => {
      const syntaxTree = parseRegex("cat");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      const matches = matcher.findAllMatches("the cat and the cat");
      expect(matches).toHaveLength(2);
      expect(matches[0].text).toBe("cat");
      expect(matches[0].start).toBe(4);
      expect(matches[1].text).toBe("cat");
      expect(matches[1].start).toBe(16);
    });

    it("devrait trouver des matches avec regex complexe", () => {
      const syntaxTree = parseRegex("a+");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      const matches = matcher.findAllMatches("aaa b aa c a");
      expect(matches).toHaveLength(3);
      expect(matches[0].text).toBe("aaa");
      expect(matches[1].text).toBe("aa");
      expect(matches[2].text).toBe("a");
    });
  });

  describe("getStats()", () => {
    it("devrait retourner des statistiques sur le cache", () => {
      const syntaxTree = parseRegex("a+b*");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      matcher.match("aaabbb");
      const stats = matcher.getStats();

      expect(stats.statesCreated).toBeGreaterThan(0);
      expect(stats.totalTransitions).toBeGreaterThan(0);
    });
  });

  describe("clearCache()", () => {
    it("devrait réinitialiser le cache", () => {
      const syntaxTree = parseRegex("a+");
      const nfa = nfaFromSyntaxTree(syntaxTree);
      const matcher = new NfaMatcher(nfa);

      matcher.match("aaa");
      const statsBefore = matcher.getStats();
      expect(statsBefore.statesCreated).toBeGreaterThan(0);

      matcher.clearCache();
      const statsAfter = matcher.getStats();
      expect(statsAfter.statesCreated).toBe(0);
      expect(statsAfter.totalTransitions).toBe(0);
    });
  });
});
