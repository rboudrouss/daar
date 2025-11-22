import { describe, it, expect } from "vitest";
import { parseRegex, nfaFromSyntaxTree, DOT, EPSILON } from "../../src";
/**
 * Tests for NFA construction and internal structure.
 * For matching behavior tests, see matching-algorithms.test.ts
 */
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

  it("should have epsilon transitions for alternation", () => {
    const tree = parseRegex("a|b|c");
    const nfa = nfaFromSyntaxTree(tree);

    // Should have epsilon transitions from start state
    expect(nfa.transitions[nfa.start][EPSILON]).toBeDefined();
    expect(nfa.transitions[nfa.start][EPSILON].length).toBeGreaterThan(0);
  });

  it("should have epsilon transitions for star", () => {
    const tree = parseRegex("(abc)*");
    const nfa = nfaFromSyntaxTree(tree);

    // Star creates epsilon transitions for loops
    const hasEpsilon = Object.values(nfa.transitions).some(
      (trans) => trans[EPSILON] !== undefined
    );
    expect(hasEpsilon).toBe(true);
  });

  it("should construct NFA with correct number of states for complex pattern", () => {
    const tree = parseRegex("(.*)(abc)(.*)");
    const nfa = nfaFromSyntaxTree(tree);

    expect(nfa.states.length).toBeGreaterThan(0);
    expect(nfa.start).toBe(0);
    expect(nfa.accepts.length).toBe(1);
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

describe("NFA - Error Handling", () => {
  it("should throw error for unknown node type", () => {
    const invalidTree = { type: "invalid" } as any;
    expect(() => nfaFromSyntaxTree(invalidTree)).toThrow(
      "Type de noeud inconnu"
    );
  });
});
