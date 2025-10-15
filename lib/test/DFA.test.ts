import { describe, it, expect } from "vitest";
import { dfaFromNfa, minimizeDfa } from "../src/DFA";
import { nfaFromSyntaxTree } from "../src/NFA";
import { parseRegex } from "../src/RegexParser";
import { matchDfa } from "../src/index";
import { DOT, EPSILON } from "../src/utils";

/**
 * Tests for DFA construction, minimization, and internal structure.
 * For matching behavior tests, see matching-algorithms.test.ts
 */

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
