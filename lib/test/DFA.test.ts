import { describe, it, expect } from "vitest";
import { dfaFromNfa, minimizeDfa } from "../src/DFA";
import { nfaFromSyntaxTree } from "../src/NFA";
import { parseRegex } from "../src/RegexParser";
import { matchDfa } from "../src/index";
import { DOT, EPSILON } from "../src/utils";

describe("DFA - Construction from NFA", () => {
  it("should construct DFA for single character", () => {
    const tree = parseRegex("a");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
    expect(dfa.start).toBe(0);
    expect(dfa.accepts.length).toBeGreaterThan(0);
    expect(dfa.transitions).toBeDefined();
  });

  it("should construct DFA for concatenation", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
    expect(dfa.accepts.length).toBeGreaterThan(0);
  });

  it("should construct DFA for alternation", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
    expect(dfa.accepts.length).toBeGreaterThan(0);
  });

  it("should construct DFA for star operator", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
    // Start state should be accepting for a*
    expect(dfa.accepts).toContain(dfa.start);
  });

  it("should construct DFA for dot", () => {
    const tree = parseRegex(".");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
    // Should have DOT transition
    const hasDotTransition = Object.values(dfa.transitions).some(
      (trans) => trans[DOT] !== undefined
    );
    expect(hasDotTransition).toBe(true);
  });

  it("should construct DFA for complex pattern", () => {
    const tree = parseRegex("(a|b)*abb");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
    expect(dfa.accepts.length).toBeGreaterThan(0);
  });
});

describe("DFA - Epsilon Closure", () => {
  it("should handle epsilon transitions correctly", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // Start state should be accepting because of epsilon closure
    expect(dfa.accepts).toContain(dfa.start);
  });

  it("should handle epsilon closure in alternation", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // Should have transitions for both 'a' and 'b' from start
    expect(dfa.transitions[dfa.start]).toHaveProperty("a");
    expect(dfa.transitions[dfa.start]).toHaveProperty("b");
  });

  it("should handle nested epsilon closures", () => {
    const tree = parseRegex("(a*)*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.accepts).toContain(dfa.start);
  });
});

describe("DFA - Fallback Transitions", () => {
  it("should add fallback transitions for wildcard patterns", () => {
    const tree = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // Should have DOT transitions for fallback
    let hasDotTransitions = false;
    for (const state of dfa.states) {
      if (dfa.transitions[state]?.[DOT] !== undefined) {
        hasDotTransitions = true;
        break;
      }
    }
    expect(hasDotTransitions).toBe(true);
  });

  it("should handle fallback for pattern matching retry", () => {
    const tree = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // Test the specific case that required fallback transitions
    expect(matchDfa(dfa, "jdioaabczd")).toBe(true);
  });

  it("should add character transitions from fallback state", () => {
    const tree = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // States should have transitions for pattern start characters
    const dotFallbackState = dfa.transitions[0]?.[DOT];
    if (dotFallbackState !== undefined) {
      // Fallback state should have 'a' transition
      expect(dfa.transitions[dotFallbackState]).toHaveProperty("a");
    }
  });

  it("should match string with pattern in the middle - original bug case", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // This was the original failing case
    expect(matchDfa(dfa, "jdioaabczd")).toBe(true);
  });

  it("should work with minimized DFA", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(matchDfa(minDfa, "jdioaabczd")).toBe(true);
  });

  it("should handle repeated starting characters", () => {
    const regex = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // Multiple 'a's before 'abc'
    expect(matchDfa(dfa, "aabc")).toBe(true);
    expect(matchDfa(dfa, "aaabc")).toBe(true);
    expect(matchDfa(dfa, "aaaabc")).toBe(true);
  });

  it("should handle pattern at different positions", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // Pattern at start
    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "abcxyz")).toBe(true);

    // Pattern in middle
    expect(matchDfa(dfa, "xyzabcxyz")).toBe(true);

    // Pattern at end
    expect(matchDfa(dfa, "xyzabc")).toBe(true);
  });

  it("should handle partial matches that fail", () => {
    const regex = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // Strings with 'ab' but not 'abc'
    expect(matchDfa(dfa, "ab")).toBe(false);
    expect(matchDfa(dfa, "xyzab")).toBe(false);
    expect(matchDfa(dfa, "ababab")).toBe(false);

    // But these should match
    expect(matchDfa(dfa, "abc")).toBe(true);
    expect(matchDfa(dfa, "ababc")).toBe(true);
  });

  it("should handle different patterns with wildcards", () => {
    // Test with different patterns to ensure fix is general
    const patterns = ["(.*)(test)", "(.*)(xyz)", "(.*)(hello)"];

    patterns.forEach((pattern) => {
      const regex = parseRegex(pattern);
      const nfa = nfaFromSyntaxTree(regex);
      const dfa = dfaFromNfa(nfa);

      // Extract the literal part (remove (.*) and parentheses)
      const literal = pattern.replace("(.*)", "").replace(/[()]/g, "");

      // Should match when literal is at the end (greedy .* consumes everything before)
      expect(matchDfa(dfa, literal)).toBe(true);
      expect(matchDfa(dfa, "x" + literal)).toBe(true);
      // Note: literal + 'x' would fail due to greedy matching - .* consumes everything
    });
  });

  it("should handle complex patterns with multiple wildcards", () => {
    const regex = parseRegex("(.*)(a)(.*)(b)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // Should match strings containing both 'a' and 'b' (in that order)
    expect(matchDfa(dfa, "ab")).toBe(true);
    expect(matchDfa(dfa, "aXb")).toBe(true);
    expect(matchDfa(dfa, "XaXbX")).toBe(true);
    expect(matchDfa(dfa, "aaabbb")).toBe(true);

    // Should not match if 'b' comes before 'a'
    expect(matchDfa(dfa, "ba")).toBe(false);
    expect(matchDfa(dfa, "b")).toBe(false);
    expect(matchDfa(dfa, "a")).toBe(false);
  });

  it("should handle edge case with single character after wildcard", () => {
    const regex = parseRegex("(.*)(x)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "x")).toBe(true);
    expect(matchDfa(dfa, "xx")).toBe(true);
    expect(matchDfa(dfa, "xxx")).toBe(true);
    expect(matchDfa(dfa, "abcx")).toBe(true);
    expect(matchDfa(dfa, "xabcx")).toBe(true);
  });

  it("should verify DFA has fallback transitions", () => {
    const regex = parseRegex("(.*)(abc)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    // Check that states have DOT transitions (fallback)
    // This is a structural test to ensure the fix is in place
    let hasDotTransitions = false;

    for (const stateId of dfa.states) {
      const transitions = dfa.transitions[stateId];
      if (transitions && transitions[DOT] !== undefined) {
        hasDotTransitions = true;
        break;
      }
    }

    expect(hasDotTransitions).toBe(true);
  });

  it("should handle the exact execution trace from the bug", () => {
    const regex = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);

    const testString = "jdioaabczd";

    expect(matchDfa(dfa, testString)).toBe(true);

    const minDfa = minimizeDfa(dfa);
    expect(matchDfa(minDfa, testString)).toBe(true);
  });
});

describe("DFA - State Minimization", () => {
  it("should minimize simple DFA", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.states.length).toBeLessThanOrEqual(dfa.states.length);
    expect(minDfa.states.length).toBeGreaterThan(0);
  });

  it("should preserve language after minimization", () => {
    const tree = parseRegex("(a|b)*abb");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    const testCases = ["abb", "aabb", "babb", "aaabb", "ab", "a", ""];
    testCases.forEach((test) => {
      expect(matchDfa(dfa, test)).toBe(matchDfa(minDfa, test));
    });
  });

  it("should minimize DFA with equivalent states", () => {
    const tree = parseRegex("a*b*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.states.length).toBeLessThanOrEqual(dfa.states.length);
  });

  it("should handle minimization of complex patterns", () => {
    const tree = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(matchDfa(minDfa, "jdioaabczd")).toBe(true);
    expect(matchDfa(minDfa, "abc")).toBe(true);
    expect(matchDfa(minDfa, "xyz")).toBe(false);
  });

  it("should maintain accept states after minimization", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.accepts.length).toBeGreaterThan(0);
  });

  it("should maintain start state after minimization", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.start).toBeDefined();
    expect(minDfa.states).toContain(minDfa.start);
  });
});

describe("DFA - Structure Validation", () => {
  it("should have valid state IDs", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    dfa.states.forEach((state) => {
      expect(typeof state).toBe("number");
    });
  });

  it("should have start state in states array", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states).toContain(dfa.start);
  });

  it("should have accept states in states array", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    dfa.accepts.forEach((accept) => {
      expect(dfa.states).toContain(accept);
    });
  });

  it("should have deterministic transitions", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // Each state-symbol pair should have at most one target
    for (const state of dfa.states) {
      const trans = dfa.transitions[state] || {};
      for (const symbol in trans) {
        expect(typeof trans[symbol]).toBe("number");
      }
    }
  });

  it("should not have epsilon transitions", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    // DFA should not have epsilon transitions
    for (const state of dfa.states) {
      const trans = dfa.transitions[state] || {};
      expect(trans[EPSILON]).toBeUndefined();
    }
  });

  it("should have sequential state IDs starting from 0", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states[0]).toBe(0);
    for (let i = 0; i < dfa.states.length; i++) {
      expect(dfa.states[i]).toBe(i);
    }
  });
});

describe("DFA - Edge Cases", () => {
  it("should handle empty string pattern", () => {
    const tree = parseRegex("()");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.accepts).toContain(dfa.start);
  });

  it("should handle pattern with only star", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.accepts).toContain(dfa.start);
  });

  it("should handle pattern with only dot-star", () => {
    const tree = parseRegex(".*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.accepts).toContain(dfa.start);
  });

  it("should handle very long patterns", () => {
    const tree = parseRegex("a".repeat(10));
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(dfa.states.length).toBeGreaterThan(0);
  });

  it("should handle deeply nested patterns", () => {
    const tree = parseRegex("((((a))))");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);

    expect(matchDfa(dfa, "a")).toBe(true);
  });
});

describe("DFA - Minimization Edge Cases", () => {
  it("should handle minimization of already minimal DFA", () => {
    const tree = parseRegex("a");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.states.length).toBeGreaterThan(0);
  });

  it("should handle minimization with single state", () => {
    const tree = parseRegex(".*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.states.length).toBeGreaterThan(0);
  });

  it("should handle minimization with all accepting states", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);

    expect(minDfa.accepts.length).toBeGreaterThan(0);
  });
});
