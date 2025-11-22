import { describe, it, expect } from "vitest";
import { NFA, epsilonClosure, EPSILON, DOT } from "../../src";

describe("utils", () => {
  describe("epsilonClosure", () => {
    it("should return the same state when no epsilon transitions", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { a: [1] },
          1: { b: [2] },
        },
        start: 0,
        accepts: [2],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toEqual([0]);
    });

    it("should follow single epsilon transition", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { [EPSILON]: [1] },
          1: { a: [2] },
        },
        start: 0,
        accepts: [2],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure.length).toBe(2);
    });

    it("should follow chain of epsilon transitions", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3],
        transitions: {
          0: { [EPSILON]: [1] },
          1: { [EPSILON]: [2] },
          2: { [EPSILON]: [3] },
        },
        start: 0,
        accepts: [3],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure).toContain(2);
      expect(closure).toContain(3);
      expect(closure.length).toBe(4);
    });

    it("should handle multiple epsilon transitions from one state", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3],
        transitions: {
          0: { [EPSILON]: [1, 2] },
          1: { a: [3] },
          2: { b: [3] },
        },
        start: 0,
        accepts: [3],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure).toContain(2);
      expect(closure.length).toBe(3);
    });

    it("should handle epsilon cycles without infinite loop", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { [EPSILON]: [1] },
          1: { [EPSILON]: [2] },
          2: { [EPSILON]: [0] }, // Cycle back to 0
        },
        start: 0,
        accepts: [2],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure).toContain(2);
      expect(closure.length).toBe(3);
    });

    it("should compute closure for multiple initial states", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3, 4],
        transitions: {
          0: { [EPSILON]: [1] },
          2: { [EPSILON]: [3] },
          3: { [EPSILON]: [4] },
        },
        start: 0,
        accepts: [4],
      };

      const closure = epsilonClosure(nfa, [0, 2]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure).toContain(2);
      expect(closure).toContain(3);
      expect(closure).toContain(4);
      expect(closure.length).toBe(5);
    });

    it("should handle empty initial states", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { [EPSILON]: [1] },
        },
        start: 0,
        accepts: [2],
      };

      const closure = epsilonClosure(nfa, []);

      expect(closure).toEqual([]);
    });

    it("should handle state with no transitions", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { a: [1] },
        },
        start: 0,
        accepts: [2],
      };

      const closure = epsilonClosure(nfa, [2]);

      expect(closure).toEqual([2]);
    });

    it("should not follow non-epsilon transitions", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { [EPSILON]: [1], a: [2] },
          1: { b: [2] },
        },
        start: 0,
        accepts: [2],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure).not.toContain(2); // Should not follow 'a' transition
      expect(closure.length).toBe(2);
    });

    it("should handle complex epsilon graph", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3, 4, 5],
        transitions: {
          0: { [EPSILON]: [1, 2] },
          1: { [EPSILON]: [3] },
          2: { [EPSILON]: [4] },
          3: { [EPSILON]: [5] },
          4: { [EPSILON]: [5] },
        },
        start: 0,
        accepts: [5],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure).toContain(2);
      expect(closure).toContain(3);
      expect(closure).toContain(4);
      expect(closure).toContain(5);
      expect(closure.length).toBe(6);
    });

    it("should handle self-loop epsilon transition", () => {
      const nfa: NFA = {
        states: [0, 1],
        transitions: {
          0: { [EPSILON]: [0, 1] }, // Self-loop
        },
        start: 0,
        accepts: [1],
      };

      const closure = epsilonClosure(nfa, [0]);

      expect(closure).toContain(0);
      expect(closure).toContain(1);
      expect(closure.length).toBe(2);
    });

    it("should preserve order independence", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { [EPSILON]: [1] },
          1: { [EPSILON]: [2] },
        },
        start: 0,
        accepts: [2],
      };

      const closure1 = epsilonClosure(nfa, [0, 1]);
      const closure2 = epsilonClosure(nfa, [1, 0]);

      // Les deux devraient contenir les mêmes états (ordre peut varier)
      expect(closure1.sort()).toEqual(closure2.sort());
    });
  });

  describe("NFA type", () => {
    it("should have correct structure", () => {
      const nfa: NFA = {
        states: [0, 1, 2],
        transitions: {
          0: { a: [1] },
          1: { b: [2] },
        },
        start: 0,
        accepts: [2],
      };

      expect(nfa.states).toEqual([0, 1, 2]);
      expect(nfa.start).toBe(0);
      expect(nfa.accepts).toEqual([2]);
      expect(nfa.transitions[0]).toEqual({ a: [1] });
    });

    it("should support multiple accept states", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3],
        transitions: {
          0: { a: [1, 2] },
        },
        start: 0,
        accepts: [1, 2, 3],
      };

      expect(nfa.accepts.length).toBe(3);
      expect(nfa.accepts).toContain(1);
      expect(nfa.accepts).toContain(2);
      expect(nfa.accepts).toContain(3);
    });

    it("should support multiple transitions for same symbol", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3],
        transitions: {
          0: { a: [1, 2, 3] },
        },
        start: 0,
        accepts: [3],
      };

      expect(nfa.transitions[0].a).toEqual([1, 2, 3]);
    });

    it("should support DOT transitions", () => {
      const nfa: NFA = {
        states: [0, 1],
        transitions: {
          0: { [DOT]: [1] },
        },
        start: 0,
        accepts: [1],
      };

      expect(nfa.transitions[0][DOT]).toEqual([1]);
    });

    it("should support mixed transition types", () => {
      const nfa: NFA = {
        states: [0, 1, 2, 3],
        transitions: {
          0: {
            a: [1],
            [EPSILON]: [2],
            [DOT]: [3],
          },
        },
        start: 0,
        accepts: [1, 2, 3],
      };

      expect(nfa.transitions[0].a).toEqual([1]);
      expect(nfa.transitions[0][EPSILON]).toEqual([2]);
      expect(nfa.transitions[0][DOT]).toEqual([3]);
    });
  });

  describe("DFA type", () => {
    it("should have correct structure", () => {
      const dfa = {
        states: [0, 1, 2],
        transitions: {
          0: { a: 1 },
          1: { b: 2 },
        },
        start: 0,
        accepts: [2],
      };

      expect(dfa.states).toEqual([0, 1, 2]);
      expect(dfa.start).toBe(0);
      expect(dfa.accepts).toEqual([2]);
      expect(dfa.transitions[0]).toEqual({ a: 1 });
    });

    it("should have deterministic transitions", () => {
      const dfa = {
        states: [0, 1, 2],
        transitions: {
          0: { a: 1, b: 2 },
          1: { a: 2 },
        },
        start: 0,
        accepts: [2],
      };

      // Chaque transition devrait pointer vers un seul état
      expect(typeof dfa.transitions[0].a).toBe("number");
      expect(typeof dfa.transitions[0].b).toBe("number");
    });
  });

  describe("state_ID type", () => {
    it("should be a number", () => {
      const stateId: number = 42;
      expect(typeof stateId).toBe("number");
    });

    it("should support zero as valid state ID", () => {
      const stateId: number = 0;
      expect(stateId).toBe(0);
    });

    it("should support negative numbers (edge case)", () => {
      const stateId: number = -1;
      expect(typeof stateId).toBe("number");
    });
  });
});
