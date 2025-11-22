import { describe, expect, it } from "vitest";
import {
  parseRegex,
  nfaFromSyntaxTree,
  matchNfa,
  findAllMatchesNfa,
  dfaFromNfa,
  matchDfa,
  findAllMatchesDfa,
  matchNfaWithDfaCache,
  findAllMatchesNfaWithDfaCache,
  Match,
} from "../../src";

/**
 * Wrapper for NFA matching algorithm
 */
const nfaAlgorithm: MatchingAlgorithm = {
  name: "NFA",
  match: (pattern: string, text: string) => {
    const tree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(tree);
    return matchNfa(nfa, text);
  },
  findAll: (pattern: string, text: string) => {
    const tree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(tree);
    return findAllMatchesNfa(nfa, text);
  },
};

/**
 * Wrapper for DFA matching algorithm
 */
const dfaAlgorithm: MatchingAlgorithm = {
  name: "DFA",
  match: (pattern: string, text: string) => {
    const tree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    return matchDfa(dfa, text);
  },
  findAll: (pattern: string, text: string) => {
    const tree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    return findAllMatchesDfa(dfa, text);
  },
};

/**
 * Wrapper for NFA with DFA cache matching algorithm
 */
const nfaWithDfaCacheAlgorithm: MatchingAlgorithm = {
  name: "NFA with DFA Cache",
  match: (pattern: string, text: string) => {
    const tree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(tree);
    return matchNfaWithDfaCache(nfa, text);
  },
  findAll: (pattern: string, text: string) => {
    const tree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(tree);
    return findAllMatchesNfaWithDfaCache(nfa, text);
  },
};

// Run the shared test suite for each algorithm
describe("Matching Algorithms - Shared Test Suite", () => {
  // Test NFA
  testMatchingAlgorithm(nfaAlgorithm);
  testFindAllMatches(nfaAlgorithm);

  // Test DFA
  testMatchingAlgorithm(dfaAlgorithm);
  testFindAllMatches(dfaAlgorithm);

  // Test NFA with DFA Cache
  testMatchingAlgorithm(nfaWithDfaCacheAlgorithm);
  testFindAllMatches(nfaWithDfaCacheAlgorithm);
});

// Test equivalence between algorithms
describe("Algorithm Equivalence Tests", () => {
  const testCases = [
    {
      pattern: "a",
      texts: ["a", "b", "abc", ""],
    },
    {
      pattern: "abc",
      texts: ["abc", "ab", "abcd", "xyz"],
    },
    {
      pattern: "a|b",
      texts: ["a", "b", "c", "ab"],
    },
    {
      pattern: "a*",
      texts: ["", "a", "aa", "aaa", "b"],
    },
    {
      pattern: "a.c",
      texts: ["abc", "axc", "a1c", "ac", "abbc"],
    },
    {
      pattern: ".*",
      texts: ["", "a", "abc", "123xyz"],
    },
    {
      pattern: "(a|b)*",
      texts: ["", "a", "b", "ab", "ba", "aabb", "c"],
    },
    {
      pattern: "(a|b)*abb",
      texts: ["abb", "aabb", "babb", "aaabb", "ab", "a", ""],
    },
    {
      pattern: "(.*)abc",
      texts: ["abc", "xyzabc", "123abc", "ab"],
    },
    {
      pattern: "a(.*)b",
      texts: ["ab", "axb", "axxxb", "a123b", "a", "b"],
    },
    {
      pattern: "(.*)(abc)(.*)",
      texts: ["abc", "xyzabc", "abcxyz", "xyzabcdef", "ab"],
    },
    {
      pattern: "(cat|dog|bird)",
      texts: ["cat", "dog", "bird", "I have a cat and a dog but no bird"],
    },
  ];

  testAlgorithmEquivalence(nfaAlgorithm, dfaAlgorithm, testCases);
  testAlgorithmEquivalence(nfaAlgorithm, nfaWithDfaCacheAlgorithm, testCases);
  testAlgorithmEquivalence(dfaAlgorithm, nfaWithDfaCacheAlgorithm, testCases);
});

// =============================================================================
//                             TESTS
// =============================================================================

/**
 * Interface for a matching algorithm that can be tested
 */
export interface MatchingAlgorithm {
  name: string;
  match: (pattern: string, text: string) => boolean;
  findAll?: (pattern: string, text: string) => Match[];
}

/**
 * Shared test suite for exact matching (returns boolean)
 * Tests that all matching algorithms should pass
 */
export function testMatchingAlgorithm(algorithm: MatchingAlgorithm) {
  describe(`${algorithm.name} - Basic Matching`, () => {
    it("should match single character", () => {
      expect(algorithm.match("a", "a")).toBe(true);
      expect(algorithm.match("a", "b")).toBe(false);
      expect(algorithm.match("a", "")).toBe(false);
      expect(algorithm.match("a", "aa")).toBe(false);
    });

    it("should match concatenation", () => {
      expect(algorithm.match("abc", "abc")).toBe(true);
      expect(algorithm.match("abc", "ab")).toBe(false);
      expect(algorithm.match("abc", "abcd")).toBe(false);
      expect(algorithm.match("abc", "xyz")).toBe(false);
    });

    it("should match alternation", () => {
      expect(algorithm.match("a|b", "a")).toBe(true);
      expect(algorithm.match("a|b", "b")).toBe(true);
      expect(algorithm.match("a|b", "c")).toBe(false);
      expect(algorithm.match("a|b", "ab")).toBe(false);
    });

    it("should match star operator - zero occurrences", () => {
      expect(algorithm.match("a*", "")).toBe(true);
      expect(algorithm.match("a*b", "b")).toBe(true);
    });

    it("should match star operator - multiple occurrences", () => {
      expect(algorithm.match("a*", "a")).toBe(true);
      expect(algorithm.match("a*", "aa")).toBe(true);
      expect(algorithm.match("a*", "aaa")).toBe(true);
      expect(algorithm.match("a*b", "ab")).toBe(true);
      expect(algorithm.match("a*b", "aaab")).toBe(true);
    });

    it("should match dot wildcard", () => {
      expect(algorithm.match(".", "a")).toBe(true);
      expect(algorithm.match(".", "b")).toBe(true);
      expect(algorithm.match(".", "1")).toBe(true);
      expect(algorithm.match(".", "")).toBe(false);
      expect(algorithm.match(".", "ab")).toBe(false);
    });

    it("should match dot with concatenation", () => {
      expect(algorithm.match("a.c", "abc")).toBe(true);
      expect(algorithm.match("a.c", "axc")).toBe(true);
      expect(algorithm.match("a.c", "a1c")).toBe(true);
      expect(algorithm.match("a.c", "ac")).toBe(false);
      expect(algorithm.match("a.c", "abbc")).toBe(false);
    });

    it("should match dot star", () => {
      expect(algorithm.match(".*", "")).toBe(true);
      expect(algorithm.match(".*", "a")).toBe(true);
      expect(algorithm.match(".*", "abc")).toBe(true);
      expect(algorithm.match(".*", "123xyz")).toBe(true);
    });
  });

  describe(`${algorithm.name} - Complex Patterns`, () => {
    it("should match grouped alternation", () => {
      expect(algorithm.match("(a|b)c", "ac")).toBe(true);
      expect(algorithm.match("(a|b)c", "bc")).toBe(true);
      expect(algorithm.match("(a|b)c", "cc")).toBe(false);
    });

    it("should match grouped star", () => {
      expect(algorithm.match("(ab)*", "")).toBe(true);
      expect(algorithm.match("(ab)*", "ab")).toBe(true);
      expect(algorithm.match("(ab)*", "abab")).toBe(true);
      expect(algorithm.match("(ab)*", "aba")).toBe(false);
    });

    it("should match alternation with star", () => {
      expect(algorithm.match("(a|b)*", "")).toBe(true);
      expect(algorithm.match("(a|b)*", "a")).toBe(true);
      expect(algorithm.match("(a|b)*", "b")).toBe(true);
      expect(algorithm.match("(a|b)*", "ab")).toBe(true);
      expect(algorithm.match("(a|b)*", "ba")).toBe(true);
      expect(algorithm.match("(a|b)*", "aabb")).toBe(true);
      expect(algorithm.match("(a|b)*", "c")).toBe(false);
    });

    it("should match complex pattern with all operators", () => {
      expect(algorithm.match("(a|b)*abb", "abb")).toBe(true);
      expect(algorithm.match("(a|b)*abb", "aabb")).toBe(true);
      expect(algorithm.match("(a|b)*abb", "babb")).toBe(true);
      expect(algorithm.match("(a|b)*abb", "aaabb")).toBe(true);
      expect(algorithm.match("(a|b)*abb", "ab")).toBe(false);
      expect(algorithm.match("(a|b)*abb", "a")).toBe(false);
    });

    it("should match pattern with dot star prefix", () => {
      expect(algorithm.match("(.*)abc", "abc")).toBe(true);
      expect(algorithm.match("(.*)abc", "xyzabc")).toBe(true);
      expect(algorithm.match("(.*)abc", "123abc")).toBe(true);
      expect(algorithm.match("(.*)abc", "ab")).toBe(false);
    });

    it("should match pattern with dot star suffix", () => {
      expect(algorithm.match("abc(.*)", "abc")).toBe(true);
      expect(algorithm.match("abc(.*)", "abcxyz")).toBe(true);
      expect(algorithm.match("abc(.*)", "abc123")).toBe(true);
      expect(algorithm.match("abc(.*)", "ab")).toBe(false);
    });

    it("should match pattern with dot star infix", () => {
      expect(algorithm.match("a(.*)b", "ab")).toBe(true);
      expect(algorithm.match("a(.*)b", "axb")).toBe(true);
      expect(algorithm.match("a(.*)b", "axxxb")).toBe(true);
      expect(algorithm.match("a(.*)b", "a123b")).toBe(true);
      expect(algorithm.match("a(.*)b", "a")).toBe(false);
      expect(algorithm.match("a(.*)b", "b")).toBe(false);
    });

    it("should match full pattern (.*)(abc)(.*)", () => {
      expect(algorithm.match("(.*)(abc)(.*)", "abc")).toBe(true);
      expect(algorithm.match("(.*)(abc)(.*)", "xyzabc")).toBe(true);
      expect(algorithm.match("(.*)(abc)(.*)", "abcxyz")).toBe(true);
      expect(algorithm.match("(.*)(abc)(.*)", "xyzabcdef")).toBe(true);
      expect(algorithm.match("(.*)(abc)(.*)", "ab")).toBe(false);
    });
  });

  describe(`${algorithm.name} - Edge Cases`, () => {
    it("should handle empty regex (empty group)", () => {
      expect(algorithm.match("()", "")).toBe(true);
      expect(algorithm.match("()", "a")).toBe(false);
    });

    it("should handle very long strings", () => {
      const longString = "x".repeat(1000) + "abc";
      expect(algorithm.match("(.*)(abc)", longString)).toBe(true);
    });

    it("should handle multiple stars", () => {
      expect(algorithm.match("a*b*c*", "")).toBe(true);
      expect(algorithm.match("a*b*c*", "abc")).toBe(true);
      expect(algorithm.match("a*b*c*", "aabbcc")).toBe(true);
      expect(algorithm.match("a*b*c*", "aaabbbccc")).toBe(true);
    });

    it("should handle nested groups", () => {
      expect(algorithm.match("((a|b)*c)*", "")).toBe(true);
      expect(algorithm.match("((a|b)*c)*", "c")).toBe(true);
      expect(algorithm.match("((a|b)*c)*", "ac")).toBe(true);
      expect(algorithm.match("((a|b)*c)*", "bcac")).toBe(true);
    });
  });
}

/**
 * Shared test suite for finding all matches
 * Tests that all findAll algorithms should pass
 */
export function testFindAllMatches(algorithm: MatchingAlgorithm) {
  if (!algorithm.findAll) {
    return; // Skip if algorithm doesn't support findAll
  }

  describe(`${algorithm.name} - Find All Matches`, () => {
    it("should find simple literal matches", () => {
      const matches = algorithm.findAll!("test", "this is a test line");

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].text).toBe("test");
      expect(matches[0].start).toBe(10);
      expect(matches[0].end).toBe(14);
    });

    it("should find multiple non-overlapping matches", () => {
      const matches = algorithm.findAll!("ab", "ab ab ab");

      expect(matches.length).toBe(3);
      expect(matches[0].start).toBe(0);
      expect(matches[1].start).toBe(3);
      expect(matches[2].start).toBe(6);
    });

    it("should find matches with wildcards", () => {
      const matches = algorithm.findAll!("a(.)c", "abc axc a1c");

      expect(matches.length).toBe(3);
      expect(matches[0].text).toBe("abc");
      expect(matches[1].text).toBe("axc");
      expect(matches[2].text).toBe("a1c");
    });

    it("should find matches with star operator", () => {
      const matches = algorithm.findAll!("a(.*)b", "ab axxxb");

      expect(matches.length).toBeGreaterThan(0);
    });

    it("should find matches with alternation", () => {
      const matches = algorithm.findAll!(
        "(cat|dog|bird)",
        "I have a cat and a dog but no bird"
      );

      expect(matches.length).toBe(3);
    });

    it("should return empty array when no matches", () => {
      const matches = algorithm.findAll!("xyz", "abc def ghi");

      expect(matches.length).toBe(0);
    });

    it("should handle empty string", () => {
      const matches = algorithm.findAll!("test", "");

      expect(matches.length).toBe(0);
    });

    it("should find matches at start of string", () => {
      const matches = algorithm.findAll!("abc", "abc def");

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(0);
    });

    it("should find matches at end of string", () => {
      const matches = algorithm.findAll!("abc", "def abc");

      expect(matches.length).toBe(1);
      expect(matches[0].end).toBe(7);
    });
  });
}

/**
 * Helper to compare two algorithms produce the same results
 */
export function testAlgorithmEquivalence(
  algorithm1: MatchingAlgorithm,
  algorithm2: MatchingAlgorithm,
  testCases: Array<{ pattern: string; texts: string[] }>
) {
  describe(`${algorithm1.name} vs ${algorithm2.name} - Equivalence`, () => {
    it("should produce same match results", () => {
      for (const { pattern, texts } of testCases) {
        for (const text of texts) {
          const result1 = algorithm1.match(pattern, text);
          const result2 = algorithm2.match(pattern, text);
          expect(result2).toBe(result1);
        }
      }
    });

    if (algorithm1.findAll && algorithm2.findAll) {
      it("should produce same findAll results", () => {
        for (const { pattern, texts } of testCases) {
          for (const text of texts) {
            const matches1 = algorithm1.findAll!(pattern, text);
            const matches2 = algorithm2.findAll!(pattern, text);

            expect(matches2.length).toBe(matches1.length);
            for (let i = 0; i < matches1.length; i++) {
              expect(matches2[i].start).toBe(matches1[i].start);
              expect(matches2[i].end).toBe(matches1[i].end);
              expect(matches2[i].text).toBe(matches1[i].text);
            }
          }
        }
      });
    }
  });
}
