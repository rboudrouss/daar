import { describe, it, expect } from "vitest";
import { nfaFromSyntaxTree, matchNfa } from "../src/NFA";
import { parseRegex } from "../src/RegexParser";
import { EPSILON, DOT } from "../src/utils";

describe("NFA - Construction from Syntax Tree", () => {
  it("should construct NFA for single character", () => {
    const tree = parseRegex("a");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states).toHaveLength(2);
    expect(nfa.start).toBe(0);
    expect(nfa.accepts).toEqual([1]);
    expect(nfa.transitions[0]).toHaveProperty("a");
    expect(nfa.transitions[0]["a"]).toEqual([1]);
  });

  it("should construct NFA for dot", () => {
    const tree = parseRegex(".");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states).toHaveLength(2);
    expect(nfa.transitions[0]).toHaveProperty(DOT);
    expect(nfa.transitions[0][DOT]).toEqual([1]);
  });

  it("should construct NFA for star operator", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states.length).toBeGreaterThan(2);
    expect(nfa.accepts).toHaveLength(1);
    // Star should have epsilon transitions
    const hasEpsilon = Object.values(nfa.transitions).some(
      (trans) => trans[EPSILON] !== undefined
    );
    expect(hasEpsilon).toBe(true);
  });

  it("should construct NFA for concatenation", () => {
    const tree = parseRegex("ab");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states).toHaveLength(4);
    expect(nfa.accepts).toHaveLength(1);
  });

  it("should construct NFA for alternation", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states.length).toBeGreaterThan(4);
    expect(nfa.accepts).toHaveLength(1);
    // Alternation should have epsilon transitions from start
    expect(nfa.transitions[nfa.start]).toHaveProperty(EPSILON);
  });

  it("should construct NFA for complex pattern", () => {
    const tree = parseRegex("(a|b)*c");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states.length).toBeGreaterThan(0);
    expect(nfa.accepts).toHaveLength(1);
  });

  it("should construct NFA for empty string (empty parens)", () => {
    const tree = parseRegex("()");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states).toHaveLength(2);
    expect(nfa.transitions[0]).toHaveProperty(EPSILON);
  });
});

describe("NFA - Matching Simple Patterns", () => {
  it("should match single character", () => {
    const tree = parseRegex("a");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "b")).toBe(false);
    expect(matchNfa(nfa, "")).toBe(false);
    expect(matchNfa(nfa, "aa")).toBe(false);
  });

  it("should match concatenation", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "abc")).toBe(true);
    expect(matchNfa(nfa, "ab")).toBe(false);
    expect(matchNfa(nfa, "abcd")).toBe(false);
    expect(matchNfa(nfa, "xyz")).toBe(false);
  });

  it("should match alternation", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "b")).toBe(true);
    expect(matchNfa(nfa, "c")).toBe(false);
    expect(matchNfa(nfa, "ab")).toBe(false);
  });

  it("should match star operator - zero occurrences", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
  });

  it("should match star operator - multiple occurrences", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "aa")).toBe(true);
    expect(matchNfa(nfa, "aaa")).toBe(true);
    expect(matchNfa(nfa, "b")).toBe(false);
  });
});

describe("NFA - Matching Dot Patterns", () => {
  it("should match single dot", () => {
    const tree = parseRegex(".");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "b")).toBe(true);
    expect(matchNfa(nfa, "1")).toBe(true);
    expect(matchNfa(nfa, "")).toBe(false);
    expect(matchNfa(nfa, "ab")).toBe(false);
  });

  it("should match dot in concatenation", () => {
    const tree = parseRegex("a.c");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "abc")).toBe(true);
    expect(matchNfa(nfa, "axc")).toBe(true);
    expect(matchNfa(nfa, "a1c")).toBe(true);
    expect(matchNfa(nfa, "ac")).toBe(false);
  });

  it("should match dot with star", () => {
    const tree = parseRegex(".*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "abc")).toBe(true);
    expect(matchNfa(nfa, "12345")).toBe(true);
  });
});

describe("NFA - Matching Complex Patterns", () => {
  it("should match grouped star", () => {
    const tree = parseRegex("(ab)*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
    expect(matchNfa(nfa, "ab")).toBe(true);
    expect(matchNfa(nfa, "abab")).toBe(true);
    expect(matchNfa(nfa, "ababab")).toBe(true);
    expect(matchNfa(nfa, "a")).toBe(false);
    expect(matchNfa(nfa, "aba")).toBe(false);
  });

  it("should match alternation with star", () => {
    const tree = parseRegex("(a|b)*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "b")).toBe(true);
    expect(matchNfa(nfa, "ab")).toBe(true);
    expect(matchNfa(nfa, "ba")).toBe(true);
    expect(matchNfa(nfa, "aabbba")).toBe(true);
    expect(matchNfa(nfa, "c")).toBe(false);
  });

  it("should match complex nested pattern", () => {
    const tree = parseRegex("(a|b)*abb");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "abb")).toBe(true);
    expect(matchNfa(nfa, "aabb")).toBe(true);
    expect(matchNfa(nfa, "babb")).toBe(true);
    expect(matchNfa(nfa, "ab")).toBe(false);
  });

  it("should match pattern with multiple stars", () => {
    const tree = parseRegex("a*b*c*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
    expect(matchNfa(nfa, "abc")).toBe(true);
    expect(matchNfa(nfa, "aabbcc")).toBe(true);
    expect(matchNfa(nfa, "aaa")).toBe(true);
    expect(matchNfa(nfa, "bbb")).toBe(true);
    expect(matchNfa(nfa, "ccc")).toBe(true);
  });
});

describe("NFA - Structure Validation", () => {
  it("should have valid state IDs", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);

    // All states should be numbers
    nfa.states.forEach((state) => {
      expect(typeof state).toBe("number");
    });
  });

  it("should have start state in states array", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states).toContain(nfa.start);
  });

  it("should have accept states in states array", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);

    nfa.accepts.forEach((accept) => {
      expect(nfa.states).toContain(accept);
    });
  });

  it("should have valid transitions", () => {
    const tree = parseRegex("abc");
    const nfa = nfaFromSyntaxTree(tree);

    // All transition sources should be valid states
    Object.keys(nfa.transitions).forEach((stateStr) => {
      const state = parseInt(stateStr);
      expect(nfa.states).toContain(state);
    });
  });

  it("should have epsilon transitions for star", () => {
    const tree = parseRegex("a*");
    const nfa = nfaFromSyntaxTree(tree);

    let hasEpsilon = false;
    for (const state of nfa.states) {
      if (nfa.transitions[state]?.[EPSILON]) {
        hasEpsilon = true;
        break;
      }
    }
    expect(hasEpsilon).toBe(true);
  });

  it("should have epsilon transitions for alternation", () => {
    const tree = parseRegex("a|b");
    const nfa = nfaFromSyntaxTree(tree);

    // Start state should have epsilon transitions to both branches
    expect(nfa.transitions[nfa.start]?.[EPSILON]).toBeDefined();
    expect(nfa.transitions[nfa.start][EPSILON].length).toBeGreaterThan(1);
  });
});

describe("NFA - Edge Cases", () => {
  it("should handle empty string pattern", () => {
    const tree = parseRegex("()");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
    expect(matchNfa(nfa, "a")).toBe(false);
  });

  it("should handle very long patterns", () => {
    const tree = parseRegex("a".repeat(10));
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "a".repeat(10))).toBe(true);
    expect(matchNfa(nfa, "a".repeat(9))).toBe(false);
  });

  it("should handle nested stars", () => {
    const tree = parseRegex("(a*)*");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "")).toBe(true);
    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "aaa")).toBe(true);
  });

  it("should handle alternation with empty", () => {
    const tree = parseRegex("a|()");
    const nfa = nfaFromSyntaxTree(tree);

    expect(matchNfa(nfa, "a")).toBe(true);
    expect(matchNfa(nfa, "")).toBe(true);
  });
});

describe("NFA - Error Handling", () => {
  it("should throw error for unknown node type", () => {
    const invalidTree = { type: "invalid" } as any;
    expect(() => nfaFromSyntaxTree(invalidTree)).toThrow(
      "Type de noeud inconnu"
    );
  });
});
