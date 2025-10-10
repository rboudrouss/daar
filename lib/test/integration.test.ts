import { describe, it, expect } from "vitest";
import {
  parseRegex,
  nfaFromSyntaxTree,
  dfaFromNfa,
  minimizeDfa,
  matchDfa,
} from "../src/index";

describe("Regex Matching - Basic Patterns", () => {
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

describe("Regex Matching - Wildcard (Dot)", () => {
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

  it("should match patterns with dot in the middle", () => {
    const regex = parseRegex("a.c");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "axc")).toBe(true);
    expect(matchDfa(dfa, "a1c")).toBe(true);
    expect(matchDfa(dfa, "ac")).toBe(false);
    expect(matchDfa(dfa, "abbc")).toBe(false);
  });
});

describe("Regex Matching - Star Operator", () => {
  it("should match zero or more occurrences", () => {
    const regex = parseRegex("ab*c");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "ac")).toBe(true);
    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "abbc")).toBe(true);
    expect(matchDfa(dfa, "abbbc")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(false);
  });

  it("should handle multiple star operators", () => {
    const regex = parseRegex("a*b*");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "")).toBe(true);
    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "b")).toBe(true);
    expect(matchDfa(dfa, "aa")).toBe(true);
    expect(matchDfa(dfa, "bb")).toBe(true);
    expect(matchDfa(dfa, "aabb")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(true);
    expect(matchDfa(dfa, "ba")).toBe(false);
  });
});

describe("Regex Matching - Alternation (Or)", () => {
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
    expect(matchDfa(dfa, "abcdef")).toBe(false);
  });
});

describe("Regex Matching - Complex Patterns", () => {
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

  it("should match patterns with alternation and star", () => {
    const regex = parseRegex("(a|b)*");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "")).toBe(true);
    expect(matchDfa(dfa, "a")).toBe(true);
    expect(matchDfa(dfa, "b")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(true);
    expect(matchDfa(dfa, "ba")).toBe(true);
    expect(matchDfa(dfa, "aabbba")).toBe(true);
    expect(matchDfa(dfa, "c")).toBe(false);
    expect(matchDfa(dfa, "abc")).toBe(false);
  });
});

describe("Regex Matching - Bug Fix: Fallback Transitions", () => {
  // This is the specific bug that was fixed: patterns like (.*)(abc)(.*)
  // where the DFA needs fallback transitions to retry pattern matching

  it("should match string containing pattern with leading wildcard", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // The bug case: "jdioaabczd" contains "abc" but was returning false
    expect(matchDfa(dfa, "jdioaabczd")).toBe(true);
    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "xyzabc")).toBe(true);
    expect(matchDfa(dfa, "abcxyz")).toBe(true);
    expect(matchDfa(dfa, "xyzabcxyz")).toBe(true);
    expect(matchDfa(dfa, "ab")).toBe(false);
    expect(matchDfa(dfa, "xyz")).toBe(false);
  });

  it("should match with minimized DFA as well", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(matchDfa(minDfa, "jdioaabczd")).toBe(true);
    expect(matchDfa(minDfa, "abc")).toBe(true);
    expect(matchDfa(minDfa, "xyzabc")).toBe(true);
  });

  it("should handle pattern retry when partial match fails", () => {
    // Test case where we see 'a' twice before matching 'abc'
    const regex = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "aabc")).toBe(true);
    expect(matchDfa(dfa, "xaabc")).toBe(true);
    expect(matchDfa(dfa, "aaaabc")).toBe(true);
  });

  it("should handle overlapping pattern attempts", () => {
    const regex = parseRegex("(.*)(aba)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // "ababa" should match: the first "aba" fails to complete, but retries succeed
    // EDGE CASE: This reveals a limitation with greedy .* matching
    expect(matchDfa(dfa, "ababa")).toBe(true);
    expect(matchDfa(dfa, "aba")).toBe(true);
    expect(matchDfa(dfa, "xababa")).toBe(true);
  });

  it("should match patterns with multiple potential starting points", () => {
    const regex = parseRegex("(.*)(test)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "test")).toBe(true);
    expect(matchDfa(dfa, "ttest")).toBe(true);
    expect(matchDfa(dfa, "tttest")).toBe(true);
    expect(matchDfa(dfa, "tetest")).toBe(true);
    // EDGE CASE: "testest" reveals limitation with backtracking in greedy matching
    expect(matchDfa(dfa, "testest")).toBe(true);
  });
});

describe("Regex Matching - Edge Cases", () => {
  it("should handle empty regex", () => {
    // EDGE CASE: Parser currently throws error for empty regex
    // This test documents the current behavior
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

  it("should handle patterns at the end of string", () => {
    const regex = parseRegex("(.*)(end)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "end")).toBe(true);
    expect(matchDfa(dfa, "theend")).toBe(true);
    expect(matchDfa(dfa, "endx")).toBe(false);
  });
});

describe("DFA Minimization", () => {
  it("should produce equivalent results after minimization", () => {
    const regex = parseRegex("(a|b)*abb");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    const testCases = ["abb", "aabb", "babb", "aaabb", "ababb", "ab", "a", ""];

    testCases.forEach((testCase) => {
      expect(matchDfa(dfa, testCase)).toBe(matchDfa(minDfa, testCase));
    });
  });

  it("should minimize DFA with fewer states", () => {
    const regex = parseRegex("(a|b)*abb");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    // Minimized DFA should have fewer or equal states
    expect(minDfa.states.length).toBeLessThanOrEqual(dfa.states.length);
  });
});
