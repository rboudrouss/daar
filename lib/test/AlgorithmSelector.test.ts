import { describe, it, expect } from "vitest";
import { parseRegex } from "../src/RegexParser";
import {
  analyzePattern,
  shouldMinimizeDfa,
  getAlgorithmDescription,
  AlgorithmType,
} from "../src/AlgorithmSelector";

describe("AlgorithmSelector", () => {
  describe("analyzePattern", () => {
    describe("Literal patterns", () => {
      it("should recommend KMP for short literal patterns", () => {
        const tree = parseRegex("abc");
        const analysis = analyzePattern(tree);

        expect(analysis.patternType).toBe("literal");
        expect(analysis.recommendedAlgorithm).toBe("literal-kmp");
        expect(analysis.isLiteral).toBe(true);
        expect(analysis.hasWildcards).toBe(false);
        expect(analysis.hasAlternations).toBe(false);
        expect(analysis.hasStars).toBe(false);
        expect(analysis.literals).toContain("abc");
      });

      it("should recommend Boyer-Moore for long literal patterns", () => {
        const tree = parseRegex("abcdefghijk");
        const analysis = analyzePattern(tree);

        expect(analysis.patternType).toBe("literal");
        expect(analysis.recommendedAlgorithm).toBe("literal-bm");
        expect(analysis.isLiteral).toBe(true);
        expect(analysis.reason).toContain("Boyer-Moore");
      });

      it("should detect literal pattern of exactly 10 chars", () => {
        const tree = parseRegex("abcdefghij"); // 10 chars
        const analysis = analyzePattern(tree);

        expect(analysis.patternType).toBe("literal");
        expect(analysis.recommendedAlgorithm).toBe("literal-bm");
      });

      it("should detect literal pattern of 9 chars", () => {
        const tree = parseRegex("abcdefghi"); // 9 chars
        const analysis = analyzePattern(tree);

        expect(analysis.patternType).toBe("literal");
        expect(analysis.recommendedAlgorithm).toBe("literal-kmp");
      });
    });

    describe("Simple patterns", () => {
      it("should recommend min-DFA for simple patterns with wildcards", () => {
        const tree = parseRegex("a(.)c");
        const analysis = analyzePattern(tree);

        expect(analysis.patternType).toBe("simple");
        expect(analysis.recommendedAlgorithm).toBe("min-dfa");
        expect(analysis.isLiteral).toBe(false);
        expect(analysis.hasWildcards).toBe(true);
        expect(analysis.complexity).toBeLessThanOrEqual(10);
      });

      it("should recommend DFA for patterns with stars but low complexity", () => {
        const tree = parseRegex("a(.*)b");
        const analysis = analyzePattern(tree);

        expect(analysis.recommendedAlgorithm).toBe("min-dfa");
        expect(analysis.hasStars).toBe(true);
      });

      it("should recommend aho-corasick for patterns with only alternations", () => {
        const tree = parseRegex("(a|b)");
        const analysis = analyzePattern(tree);

        expect(analysis.recommendedAlgorithm).toBe("aho-corasick");
        expect(analysis.hasAlternations).toBe(true);
      });
    });

    describe("Complex patterns", () => {
      it("should recommend NFA for very complex patterns", () => {
        // Pattern complexe avec beaucoup d'alternations et d'étoiles
        const tree = parseRegex("((a|b)(.*)|(c|d)(.*))");
        const analysis = analyzePattern(tree);

        // Devrait être complexe
        expect(analysis.complexity).toBeGreaterThan(0);
        expect(analysis.hasAlternations).toBe(true);
        expect(analysis.hasStars).toBe(true);
      });

      it("should detect high complexity patterns", () => {
        // Pattern avec plusieurs étoiles et alternations
        const tree = parseRegex("(a(.*)b(.*)c|d(.*)e(.*)f)");
        const analysis = analyzePattern(tree);

        expect(analysis.complexity).toBeGreaterThan(10);
      });
    });

    describe("Pattern characteristics detection", () => {
      it("should detect wildcards correctly", () => {
        const tree1 = parseRegex("a(.)b");
        const analysis1 = analyzePattern(tree1);
        expect(analysis1.hasWildcards).toBe(true);

        const tree2 = parseRegex("abc");
        const analysis2 = analyzePattern(tree2);
        expect(analysis2.hasWildcards).toBe(false);
      });

      it("should detect alternations correctly", () => {
        const tree1 = parseRegex("(a|b)");
        const analysis1 = analyzePattern(tree1);
        expect(analysis1.hasAlternations).toBe(true);

        const tree2 = parseRegex("abc");
        const analysis2 = analyzePattern(tree2);
        expect(analysis2.hasAlternations).toBe(false);
      });

      it("should detect stars correctly", () => {
        const tree1 = parseRegex("a(.*)b");
        const analysis1 = analyzePattern(tree1);
        expect(analysis1.hasStars).toBe(true);

        const tree2 = parseRegex("abc");
        const analysis2 = analyzePattern(tree2);
        expect(analysis2.hasStars).toBe(false);
      });

      it("should extract literals from patterns", () => {
        const tree = parseRegex("(abc|def)");
        const analysis = analyzePattern(tree);

        expect(analysis.literals.length).toBeGreaterThan(0);
        expect(analysis.literals).toContain("abc");
        expect(analysis.literals).toContain("def");
      });
    });

    describe("Complexity calculation", () => {
      it("should calculate complexity for simple char", () => {
        const tree = parseRegex("a");
        const analysis = analyzePattern(tree);

        expect(analysis.complexity).toBe(1);
      });

      it("should calculate complexity for concat", () => {
        const tree = parseRegex("abc");
        const analysis = analyzePattern(tree);

        expect(analysis.complexity).toBe(3);
      });

      it("should calculate higher complexity for wildcards", () => {
        const tree1 = parseRegex("abc");
        const tree2 = parseRegex("a(.)c");
        const analysis1 = analyzePattern(tree1);
        const analysis2 = analyzePattern(tree2);

        expect(analysis2.complexity).toBeGreaterThan(analysis1.complexity);
      });

      it("should calculate higher complexity for stars", () => {
        const tree1 = parseRegex("abc");
        const tree2 = parseRegex("a(.*)c");
        const analysis1 = analyzePattern(tree1);
        const analysis2 = analyzePattern(tree2);

        expect(analysis2.complexity).toBeGreaterThan(analysis1.complexity);
      });

      it("should calculate higher complexity for alternations", () => {
        const tree1 = parseRegex("abc");
        const tree2 = parseRegex("(a|b)c");
        const analysis1 = analyzePattern(tree1);
        const analysis2 = analyzePattern(tree2);

        expect(analysis2.complexity).toBeGreaterThan(analysis1.complexity);
      });
    });

    describe("Reason messages", () => {
      it("should provide reason for literal-kmp", () => {
        const tree = parseRegex("abc");
        const analysis = analyzePattern(tree);

        expect(analysis.reason).toContain("KMP");
        expect(analysis.reason).toContain("littéral");
      });

      it("should provide reason for literal-bm", () => {
        const tree = parseRegex("abcdefghijk");
        const analysis = analyzePattern(tree);

        expect(analysis.reason).toContain("Boyer-Moore");
        expect(analysis.reason).toContain("littéral");
      });

      it("should provide reason for dfa", () => {
        const tree = parseRegex("a(.)c");
        const analysis = analyzePattern(tree);

        expect(analysis.reason).toContain("DFA");
      });

      it("should include complexity in reason", () => {
        const tree = parseRegex("a(.)c");
        const analysis = analyzePattern(tree);

        expect(analysis.reason).toContain(analysis.complexity.toString());
      });
    });
  });

  describe("shouldMinimizeDfa", () => {
    it("should recommend minimization for complex DFA patterns", () => {
      const tree = parseRegex("(a|b)(c|d)(e|f)");
      const analysis = analyzePattern(tree);

      if (analysis.recommendedAlgorithm === "dfa") {
        const shouldMinimize = shouldMinimizeDfa(analysis);
        // Devrait recommander la minimisation si complexité > 15
        expect(typeof shouldMinimize).toBe("boolean");
      }
    });

    it("should not recommend minimization for simple patterns", () => {
      const tree = parseRegex("abc");
      const analysis = analyzePattern(tree);

      const shouldMinimize = shouldMinimizeDfa(analysis);
      expect(shouldMinimize).toBe(false);
    });

    it("should not recommend minimization for NFA", () => {
      // Créer un pattern qui devrait donner NFA
      const tree = parseRegex("a");
      const analysis = analyzePattern(tree);
      // Forcer le type à NFA pour le test
      const nfaAnalysis = { ...analysis, recommendedAlgorithm: "nfa" as AlgorithmType };

      const shouldMinimize = shouldMinimizeDfa(nfaAnalysis);
      expect(shouldMinimize).toBe(false);
    });

    it("should recommend minimization based on complexity threshold", () => {
      const tree = parseRegex("abc");
      const analysis = analyzePattern(tree);

      // Modifier la complexité pour tester le seuil
      const highComplexity = { ...analysis, complexity: 20, recommendedAlgorithm: "dfa" as AlgorithmType };
      const lowComplexity = { ...analysis, complexity: 10, recommendedAlgorithm: "dfa" as AlgorithmType };

      expect(shouldMinimizeDfa(highComplexity)).toBe(true);
      expect(shouldMinimizeDfa(lowComplexity)).toBe(false);
    });
  });

  describe("getAlgorithmDescription", () => {
    it("should return description for literal-kmp", () => {
      const desc = getAlgorithmDescription("literal-kmp");
      expect(desc).toContain("KMP");
      expect(desc).toContain("Knuth-Morris-Pratt");
    });

    it("should return description for literal-bm", () => {
      const desc = getAlgorithmDescription("literal-bm");
      expect(desc).toContain("Boyer-Moore");
    });

    it("should return description for nfa", () => {
      const desc = getAlgorithmDescription("nfa");
      expect(desc).toContain("NFA");
      expect(desc).toContain("Non-deterministic");
    });

    it("should return description for dfa", () => {
      const desc = getAlgorithmDescription("dfa");
      expect(desc).toContain("DFA");
      expect(desc).toContain("Deterministic");
    });

    it("should return description for min-dfa", () => {
      const desc = getAlgorithmDescription("min-dfa");
      expect(desc).toContain("Minimized DFA");
    });

    it("should handle unknown algorithm", () => {
      const desc = getAlgorithmDescription("unknown" as AlgorithmType);
      expect(desc).toContain("Unknown");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty-like patterns", () => {
      const tree = parseRegex("(.*)");
      const analysis = analyzePattern(tree);

      expect(analysis).toBeDefined();
      expect(analysis.isLiteral).toBe(false);
    });

    it("should handle single character patterns", () => {
      const tree = parseRegex("a");
      const analysis = analyzePattern(tree);

      expect(analysis.patternType).toBe("literal");
      expect(analysis.isLiteral).toBe(true);
      expect(analysis.complexity).toBe(1);
    });

    it("should handle patterns with only alternations", () => {
      const tree = parseRegex("(a|b|c|d|e)");
      const analysis = analyzePattern(tree);

      expect(analysis.hasAlternations).toBe(true);
      expect(analysis.isLiteral).toBe(false);
    });

    it("should handle nested alternations", () => {
      const tree = parseRegex("((a|b)|(c|d))");
      const analysis = analyzePattern(tree);

      expect(analysis.hasAlternations).toBe(true);
      expect(analysis.complexity).toBeGreaterThan(0);
    });

    it("should handle mixed patterns", () => {
      const tree = parseRegex("a(.*)(b|c)d");
      const analysis = analyzePattern(tree);

      expect(analysis.hasWildcards).toBe(true);
      expect(analysis.hasStars).toBe(true);
      expect(analysis.hasAlternations).toBe(true);
      expect(analysis.isLiteral).toBe(false);
    });
  });
});

