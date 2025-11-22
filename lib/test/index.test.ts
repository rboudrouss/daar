import { describe, it, expect } from "vitest";
import {
  parseRegex,
  nfaFromSyntaxTree,
  dfaFromNfa,
  matchDfa,
  minimizeDfa,
  kmpSearch,
  DOT,
} from "../src";

describe("matchDfa - Basic Matching", () => {
  it("should match simple character sequences", () => {
    const regex = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(false);
    expect(matchDfa(dfa, "abcd")).toBe(false);
    expect(matchDfa(dfa, "xyz")).toBe(false);
  });

  it("should match single characters", () => {
    const regex = parseRegex("a");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "b")).toBe(false);
    expect(matchDfa(dfa, "aa")).toBe(false);
    expect(matchDfa(dfa, "")).toBe(false);
  });

  it("should match empty string with star operator", () => {
    const regex = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "")).toBe(true);
    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "aa")).toBe(true);
    expect(matchDfa(dfa, "aaa")).toBe(true);
    expect(matchDfa(dfa, "b")).toBe(false);
  });
});

describe("matchDfa - Wildcard Patterns", () => {
  it("should match any single character with dot", () => {
    const regex = parseRegex(".");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "b")).toBe(true);
    expect(matchDfa(dfa, "z")).toBe(true);
    expect(matchDfa(dfa, "1")).toBe(true);
    expect(matchDfa(dfa, "")).toBe(false);
    expect(matchDfa(dfa, "ab")).toBe(false);
  });

  it("should match any string with .*", () => {
    const regex = parseRegex(".*");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "")).toBe(true);
    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "hello world")).toBe(true);
  });

  it("should use DOT transition when specific character not found", () => {
    const regex = parseRegex(".*");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // Should match any character using DOT transition
    expect(matchDfa(dfa, "xyz")).toBe(true);
    expect(matchDfa(dfa, "123")).toBe(true);
    expect(matchDfa(dfa, "!@#")).toBe(true);
  });
});

describe("matchDfa - Alternation", () => {
  it("should match either alternative", () => {
    const regex = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "b")).toBe(true);
    expect(matchDfa(dfa, "c")).toBe(false);
    expect(matchDfa(dfa, "ab")).toBe(false);
  });

  it("should match complex alternations", () => {
    const regex = parseRegex("abc|def");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "def")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(false);
    expect(matchDfa(dfa, "de")).toBe(false);
  });
});

describe("matchDfa - Complex Patterns", () => {
  it("should match patterns with concatenation and star", () => {
    const regex = parseRegex("(ab)*");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(true);
    expect(matchDfa(dfa, "abab")).toBe(true);
    expect(matchDfa(dfa, "ababab")).toBe(true);
    expect(matchDfa(dfa, "a")).toBe(false);
    expect(matchDfa(dfa, "aba")).toBe(false);
  });

  it("should match string containing pattern with leading wildcard", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "jdioaabczd")).toBe(true);
    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "xyzabc")).toBe(true);
    expect(matchDfa(dfa, "abcxyz")).toBe(true);
    expect(matchDfa(dfa, "xyzabcxyz")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(false);
    expect(matchDfa(dfa, "xyz")).toBe(false);
  });
});

describe("matchDfa - Edge Cases", () => {
  it("should handle empty string pattern", () => {
    const regex = parseRegex("()");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "")).toBe(true);
    expect(matchDfa(dfa, "a")).toBe(false);
  });

  it("should handle very long strings", () => {
    const regex = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    const longString = "x".repeat(1000) + "abc";
    expect(matchDfa(dfa, longString)).toBe(true);
  });

  it("should return false when no transition exists", () => {
    const regex = parseRegex("a");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "b")).toBe(false);
  });

  it("should work with minimized DFA", () => {
    const regex = parseRegex("(a|b)*abb");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(matchDfa(minDfa, "abb")).toBe(true);
    expect(matchDfa(minDfa, "aabb")).toBe(true);
    expect(matchDfa(minDfa, "ab")).toBe(false);
  });
});

describe("kmpSearch - Basic Search", () => {
  it("should find single occurrence", () => {
    const result = kmpSearch("abc", "xyzabcdef");
    expect(result).toEqual([3]);
  });

  it("should find multiple occurrences", () => {
    const result = kmpSearch("ab", "ababab");
    expect(result).toEqual([0, 2, 4]);
  });

  it("should return empty array when pattern not found", () => {
    const result = kmpSearch("xyz", "abcdef");
    expect(result).toEqual([]);
  });

  it("should find pattern at start", () => {
    const result = kmpSearch("abc", "abcdef");
    expect(result).toEqual([0]);
  });

  it("should find pattern at end", () => {
    const result = kmpSearch("def", "abcdef");
    expect(result).toEqual([3]);
  });

  it("should handle single character pattern", () => {
    const result = kmpSearch("a", "banana");
    expect(result).toEqual([1, 3, 5]);
  });

  it("should handle pattern same as text", () => {
    const result = kmpSearch("abc", "abc");
    expect(result).toEqual([0]);
  });
});

describe("kmpSearch - Overlapping Patterns", () => {
  it("should find overlapping occurrences", () => {
    const result = kmpSearch("aa", "aaaa");
    expect(result).toEqual([0, 1, 2]);
  });

  it("should handle pattern with repeated prefix", () => {
    const result = kmpSearch("aba", "ababa");
    expect(result).toEqual([0, 2]);
  });

  it("should handle complex overlapping", () => {
    const result = kmpSearch("abab", "ababababab");
    expect(result).toEqual([0, 2, 4, 6]);
  });
});

describe("kmpSearch - Edge Cases", () => {
  it("should handle empty text", () => {
    const result = kmpSearch("abc", "");
    expect(result).toEqual([]);
  });

  it("should handle pattern longer than text", () => {
    const result = kmpSearch("abcdef", "abc");
    expect(result).toEqual([]);
  });

  it("should handle single character text and pattern", () => {
    const result = kmpSearch("a", "a");
    expect(result).toEqual([0]);
  });

  it("should handle repeated characters", () => {
    const result = kmpSearch("aaa", "aaaaaaa");
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("should handle long text", () => {
    const text = "x".repeat(1000) + "abc" + "y".repeat(1000);
    const result = kmpSearch("abc", text);
    expect(result).toEqual([1000]);
  });

  it("should handle special characters", () => {
    const result = kmpSearch("!@#", "xyz!@#def");
    expect(result).toEqual([3]);
  });

  it("should handle numeric strings", () => {
    const result = kmpSearch("123", "0123456789");
    expect(result).toEqual([1]);
  });
});

describe("kmpSearch - LPS Array Correctness", () => {
  it("should handle pattern with no repeating prefix", () => {
    const result = kmpSearch("abcd", "xyzabcdxyz");
    expect(result).toEqual([3]);
  });

  it("should handle pattern with repeating prefix", () => {
    const result = kmpSearch("aaab", "aaaabaaab");
    expect(result).toEqual([1, 5]);
  });

  it("should handle pattern that is all same character", () => {
    const result = kmpSearch("aaa", "baaab");
    expect(result).toEqual([1]);
  });
});

describe("Exports - Module Integration", () => {
  it("should export all necessary functions", () => {
    expect(matchDfa).toBeDefined();
    expect(kmpSearch).toBeDefined();
  });

  it("should export constants", () => {
    expect(DOT).toBeDefined();
  });

  it("should allow full regex workflow", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const result = matchDfa(dfa, "abc");

    expect(result).toBe(true);
  });
});
