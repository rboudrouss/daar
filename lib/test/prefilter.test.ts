import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/RegexParser";
import { extractLiterals, canUsePrefilter } from "../src/LiteralExtractor";
import { boyerMooreSearch, boyerMooreContains } from "../src/BoyerMoore";
import { AhoCorasick } from "../src/AhoCorasick";

describe("LiteralExtractor", () => {
  it("should extract simple literal from char sequence", () => {
    const tree = parseRegex("abc");
    const literals = extractLiterals(tree);
    expect(literals).toContain("abc");
  });

  it("should extract literals from alternation", () => {
    const tree = parseRegex("(abc|def)");
    const literals = extractLiterals(tree);
    expect(literals).toContain("abc");
    expect(literals).toContain("def");
  });

  it("should extract literal from pattern with star", () => {
    const tree = parseRegex("(.*)(test)");
    const literals = extractLiterals(tree);
    expect(literals).toContain("test");
  });

  it("should extract multiple literals from complex pattern", () => {
    const tree = parseRegex("(abc|def)(xyz)");
    const literals = extractLiterals(tree);
    // Should extract concatenated literals
    expect(literals.length).toBeGreaterThan(0);
  });

  it("should return empty for pattern with only wildcards", () => {
    const tree = parseRegex("(.*)");
    const literals = extractLiterals(tree);
    expect(literals.length).toBe(0);
  });

  it("should determine if prefilter is possible (has literals)", () => {
    // Pure literal: has literals, prefilter possible (decision made by GrepMatcher)
    const tree1 = parseRegex("test");
    expect(canUsePrefilter(tree1)).toBe(true);

    // Pattern with only wildcards: no literals to extract
    const tree2 = parseRegex("(.*)");
    expect(canUsePrefilter(tree2)).toBe(false);

    // Single char literal: too short
    const tree3 = parseRegex("a");
    expect(canUsePrefilter(tree3)).toBe(false);

    // Alternation of literals: has literals, prefilter possible
    const tree4 = parseRegex("from|what|who");
    expect(canUsePrefilter(tree4)).toBe(true);

    // Complex pattern with literals: prefilter possible
    const tree5 = parseRegex("(.*)test(.*)");
    expect(canUsePrefilter(tree5)).toBe(true);

    // Pattern with literal segment: prefilter possible
    const tree6 = parseRegex("abc(.*)");
    expect(canUsePrefilter(tree6)).toBe(true);
  });
});

describe("BoyerMoore", () => {
  it("should find all occurrences of a pattern", () => {
    const text = "abcabcabc";
    const pattern = "abc";
    const matches = boyerMooreSearch(text, pattern);
    expect(matches).toEqual([0, 3, 6]);
  });

  it("should find pattern in middle of text", () => {
    const text = "hello world test hello";
    const pattern = "test";
    const matches = boyerMooreSearch(text, pattern);
    expect(matches).toEqual([12]);
  });

  it("should return empty array when pattern not found", () => {
    const text = "hello world";
    const pattern = "xyz";
    const matches = boyerMooreSearch(text, pattern);
    expect(matches).toEqual([]);
  });

  it("should handle overlapping patterns", () => {
    const text = "aaaa";
    const pattern = "aa";
    const matches = boyerMooreSearch(text, pattern);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("should check if pattern exists (contains)", () => {
    const text = "hello world test";
    expect(boyerMooreContains(text, "test")).toBe(true);
    expect(boyerMooreContains(text, "xyz")).toBe(false);
  });

  it("should handle empty pattern", () => {
    const text = "hello";
    const pattern = "";
    const matches = boyerMooreSearch(text, pattern);
    expect(matches).toEqual([]);
  });

  it("should handle pattern longer than text", () => {
    const text = "hi";
    const pattern = "hello";
    const matches = boyerMooreSearch(text, pattern);
    expect(matches).toEqual([]);
  });
});

describe("AhoCorasick", () => {
  it("should find single pattern", () => {
    const ac = new AhoCorasick(["test"]);
    const results = ac.search("hello test world");
    expect(results.length).toBe(1);
    expect(results[0].pattern).toBe("test");
    expect(results[0].position).toBe(6);
  });

  it("should find multiple patterns", () => {
    const ac = new AhoCorasick(["hello", "world"]);
    const results = ac.search("hello world");
    expect(results.length).toBe(2);
    expect(results[0].pattern).toBe("hello");
    expect(results[1].pattern).toBe("world");
  });

  it("should find overlapping patterns", () => {
    const ac = new AhoCorasick(["abc", "bcd"]);
    const results = ac.search("abcd");
    expect(results.length).toBe(2);
  });

  it("should check if any pattern exists (contains)", () => {
    const ac = new AhoCorasick(["test", "hello"]);
    expect(ac.contains("hello world")).toBe(true);
    expect(ac.contains("xyz")).toBe(false);
  });

  it("should find first pattern", () => {
    const ac = new AhoCorasick(["test", "hello"]);
    const result = ac.findFirst("hello world test");
    expect(result).not.toBeNull();
    expect(result?.pattern).toBe("hello");
  });

  it("should handle patterns with common prefixes", () => {
    const ac = new AhoCorasick(["test", "testing", "tester"]);
    const results = ac.search("testing");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should handle empty text", () => {
    const ac = new AhoCorasick(["test"]);
    const results = ac.search("");
    expect(results).toEqual([]);
  });

  it("should handle multiple occurrences of same pattern", () => {
    const ac = new AhoCorasick(["test"]);
    const results = ac.search("test test test");
    expect(results.length).toBe(3);
  });
});

describe("Integration: Prefilter with Regex Matching", () => {
  it("should use prefilter to speed up matching", () => {
    const tree = parseRegex("(.*)(test)(.*)");
    const literals = extractLiterals(tree);

    // Should extract "test" as a literal
    expect(literals).toContain("test");

    // Lines that don't contain "test" can be filtered out quickly
    const line1 = "hello world";
    const line2 = "hello test world";

    if (literals.length > 0) {
      const pattern = literals[0];
      expect(boyerMooreContains(line1, pattern)).toBe(false);
      expect(boyerMooreContains(line2, pattern)).toBe(true);
    }
  });

  it("should handle alternation patterns", () => {
    const tree = parseRegex("(abc|def)");
    const literals = extractLiterals(tree);

    expect(literals.length).toBeGreaterThan(0);

    // Should be able to prefilter with Aho-Corasick
    const ac = new AhoCorasick(literals);
    expect(ac.contains("hello abc world")).toBe(true);
    expect(ac.contains("hello def world")).toBe(true);
    expect(ac.contains("hello xyz world")).toBe(false);
  });
});
