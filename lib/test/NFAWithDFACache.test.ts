import { describe, it, expect } from "vitest";
import { matchNfaWithDfaCache, findAllMatchesNfaWithDfaCache } from "../src/NFAWithDFACache";
import { parseRegex } from "../src/RegexParser";
import { nfaFromSyntaxTree, matchNfa, findAllMatchesNfa } from "../src";

describe("NFA with DFA Cache - Basic Matching", () => {
  it("should match single character", () => {
    const tree = parseRegex("a");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfaWithDfaCache(nfa, "a")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "b")).toBe(false);
    expect(matchNfaWithDfaCache(nfa, "")).toBe(false);
    expect(matchNfaWithDfaCache(nfa, "aa")).toBe(false);
  });

  it("should match concatenation", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfaWithDfaCache(nfa, "abc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "ab")).toBe(false);
    expect(matchNfaWithDfaCache(nfa, "abcd")).toBe(false);
    expect(matchNfaWithDfaCache(nfa, "xyz")).toBe(false);
  });

  it("should match alternation", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfaWithDfaCache(nfa, "a")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "b")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "c")).toBe(false);
    expect(matchNfaWithDfaCache(nfa, "ab")).toBe(false);
  });

  it("should match star quantifier", () => {
    const tree = parseRegex("ab*c");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfaWithDfaCache(nfa, "ac")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "abc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "abbc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "abbbc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "ab")).toBe(false);
  });

  it("should match dot wildcard", () => {
    const tree = parseRegex("a.c");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfaWithDfaCache(nfa, "abc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "adc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "axc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "ac")).toBe(false);
    expect(matchNfaWithDfaCache(nfa, "abbc")).toBe(false);
  });

  it("should match complex pattern with .*", () => {
    const tree = parseRegex("a.*c");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfaWithDfaCache(nfa, "ac")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "abc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "axyzc")).toBe(true);
    expect(matchNfaWithDfaCache(nfa, "ab")).toBe(false);
  });
});

describe("NFA with DFA Cache - Find All Matches", () => {
  it("should find simple literal matches", () => {
    const tree = parseRegex("test");
    const nfa = nfaFromSyntaxTree(tree);
    const line = "this is a test line";

    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("test");
    expect(matches[0].start).toBe(10);
    expect(matches[0].end).toBe(14);
  });

  it("should find multiple non-overlapping matches", () => {
    const tree = parseRegex("ab");
    const nfa = nfaFromSyntaxTree(tree);
    const line = "ab ab ab";

    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(matches.length).toBe(3);
    expect(matches[0].start).toBe(0);
    expect(matches[1].start).toBe(3);
    expect(matches[2].start).toBe(6);
  });

  it("should find matches with wildcards", () => {
    const tree = parseRegex("a.c");
    const nfa = nfaFromSyntaxTree(tree);
    const line = "abc adc aec";

    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(matches.length).toBe(3);
    expect(matches[0].text).toBe("abc");
    expect(matches[1].text).toBe("adc");
    expect(matches[2].text).toBe("aec");
  });

  it("should find matches with star quantifier", () => {
    const tree = parseRegex("ab*c");
    const nfa = nfaFromSyntaxTree(tree);
    const line = "ac abc abbc abbbc";

    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(matches.length).toBe(4);
    expect(matches[0].text).toBe("ac");
    expect(matches[1].text).toBe("abc");
    expect(matches[2].text).toBe("abbc");
    expect(matches[3].text).toBe("abbbc");
  });

  it("should find longest matches with .*", () => {
    const tree = parseRegex("a.*c");
    const nfa = nfaFromSyntaxTree(tree);
    const line = "abc axyzc";

    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    // Should find the longest match from 'a' to the last 'c'
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].start).toBe(0);
  });
});

describe("NFA with DFA Cache - Consistency with NFA", () => {
  it("should produce same results as regular NFA for simple patterns", () => {
    const patterns = ["a", "abc", "a|b", "ab*c", "a.c"];

    for (const pattern of patterns) {
      const tree = parseRegex(pattern);
      const nfa = nfaFromSyntaxTree(tree);
      const testStrings = ["a", "b", "abc", "ac", "abbc", "xyz"];

      for (const str of testStrings) {
        const nfaResult = matchNfa(nfa, str);
        const cacheResult = matchNfaWithDfaCache(nfa, str);
        expect(cacheResult).toBe(nfaResult);
      }
    }
  });

  it("should produce same matches as regular NFA", () => {
    const patterns = ["test", "ab", "a.c", "ab*c"];

    for (const pattern of patterns) {
      const tree = parseRegex(pattern);
      const nfa = nfaFromSyntaxTree(tree);
      const line = "test ab abc adc abbc test";

      const nfaMatches = findAllMatchesNfa(nfa, line);
      const cacheMatches = findAllMatchesNfaWithDfaCache(nfa, line);

      expect(cacheMatches.length).toBe(nfaMatches.length);
      for (let i = 0; i < cacheMatches.length; i++) {
        expect(cacheMatches[i].start).toBe(nfaMatches[i].start);
        expect(cacheMatches[i].end).toBe(nfaMatches[i].end);
        expect(cacheMatches[i].text).toBe(nfaMatches[i].text);
      }
    }
  });

  it("should handle complex patterns like (.*)(abc)(.*)", () => {
    const tree = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(tree);

    const testString = "xyzabcdef";
    const nfaResult = matchNfa(nfa, testString);
    const cacheResult = matchNfaWithDfaCache(nfa, testString);

    expect(cacheResult).toBe(nfaResult);
    expect(cacheResult).toBe(true);
  });

  it("should handle alternations correctly", () => {
    const tree = parseRegex("(cat|dog|bird)");
    const nfa = nfaFromSyntaxTree(tree);
    const line = "I have a cat and a dog but no bird";

    const nfaMatches = findAllMatchesNfa(nfa, line);
    const cacheMatches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(cacheMatches.length).toBe(nfaMatches.length);
    expect(cacheMatches.length).toBe(3);
  });
});

describe("NFA with DFA Cache - Performance Characteristics", () => {
  it("should handle repeated patterns efficiently", () => {
    const tree = parseRegex("a*b");
    const nfa = nfaFromSyntaxTree(tree);

    // This should reuse cached DFA states
    const line = "aaab aaab aaab aaab";
    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(matches.length).toBe(4);
    expect(matches.every(m => m.text === "aaab")).toBe(true);
  });

  it("should handle large input efficiently", () => {
    const tree = parseRegex("test");
    const nfa = nfaFromSyntaxTree(tree);

    // Create a large input
    const line = "test ".repeat(1000);
    const matches = findAllMatchesNfaWithDfaCache(nfa, line);

    expect(matches.length).toBe(1000);
  });
});

