import { describe, it, expect } from "vitest";
import { analyzePattern } from "../src/AlgorithmSelector";
import { parseRegex } from "../src/RegexParser";

/**
 * Tests for text-size-aware algorithm selection
 */
describe("AlgorithmSelector - Text Size Awareness", () => {
  describe("Small text (< 500 bytes)", () => {
    it("should recommend NFA for simple regex on small text", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 300); // 300 bytes

      expect(analysis.recommendedAlgorithm).toBe("nfa");
      expect(analysis.reason).toContain("Petit texte");
      expect(analysis.reason).toContain("300 bytes");
    });

    it("should recommend NFA for complex regex on small text", () => {
      const tree = parseRegex("(a|b)(.*)c");
      const analysis = analyzePattern(tree, 100); // 100 bytes

      expect(analysis.recommendedAlgorithm).toBe("nfa");
      expect(analysis.reason).toContain("Petit texte");
    });

    it("should still recommend literal algorithms for literals on small text", () => {
      const tree = parseRegex("abc");
      const analysis = analyzePattern(tree, 200); // 200 bytes

      // Literals should still use KMP/BM regardless of text size
      expect(analysis.recommendedAlgorithm).toBe("literal-kmp");
    });

    it("should still recommend Aho-Corasick for alternations of literals on small text", () => {
      const tree = parseRegex("(abc|def|ghi)");
      const analysis = analyzePattern(tree, 200); // 200 bytes

      expect(analysis.recommendedAlgorithm).toBe("aho-corasick");
    });
  });

  describe("Medium text (500 bytes - 10KB)", () => {
    it("should recommend NFA+DFA-cache for simple regex on medium text", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 5 * 1024); // 5KB

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
      expect(analysis.reason).toContain("Texte moyen");
      expect(analysis.reason).toContain("KB");
    });

    it("should recommend NFA+DFA-cache for complex regex on medium text", () => {
      const tree = parseRegex("(a|b)(.*)c");
      const analysis = analyzePattern(tree, 8 * 1024); // 8KB

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
      expect(analysis.reason).toContain("Texte moyen");
    });

    it("should recommend NFA+DFA-cache at lower boundary (500 bytes)", () => {
      const tree = parseRegex("a(.)b");
      const analysis = analyzePattern(tree, 500);

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
    });

    it("should recommend NFA+DFA-cache at upper boundary (just under 10KB)", () => {
      const tree = parseRegex("a(.)b");
      const analysis = analyzePattern(tree, 10 * 1024 - 1);

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
    });
  });

  describe("Large text (>= 10KB)", () => {
    it("should recommend DFA for simple regex on large text", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 50 * 1024); // 50KB

      expect(analysis.recommendedAlgorithm).toBe("dfa");
      expect(analysis.reason).toContain("Pattern simple");
    });

    it("should recommend DFA for patterns with alternations on large text", () => {
      const tree = parseRegex("(a|b)c");
      const analysis = analyzePattern(tree, 100 * 1024); // 100KB

      expect(analysis.recommendedAlgorithm).toBe("dfa");
      expect(analysis.reason).toContain("alternations");
    });

    it("should recommend NFA+DFA-cache for very complex patterns even on large text", () => {
      // Create a complex pattern (complexity > 20)
      const tree = parseRegex("((a|b)(.*)|(c|d)(.*))((e|f)(.*)|(g|h)(.*))");
      const analysis = analyzePattern(tree, 1024 * 1024); // 1MB

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
      expect(analysis.reason).toContain("complexe");
    });

    it("should recommend DFA at exactly 10KB boundary", () => {
      const tree = parseRegex("a(.)b");
      const analysis = analyzePattern(tree, 10 * 1024);

      expect(analysis.recommendedAlgorithm).toBe("dfa");
    });
  });

  describe("Unknown text size", () => {
    it("should fall back to pattern-based selection when text size is undefined", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, undefined);

      // Should use pattern complexity to decide
      expect(analysis.recommendedAlgorithm).toBe("dfa");
    });

    it("should handle simple patterns without text size", () => {
      const tree = parseRegex("a(.)c");
      const analysis = analyzePattern(tree);

      expect(analysis.recommendedAlgorithm).toBe("dfa");
    });

    it("should handle complex patterns without text size", () => {
      const tree = parseRegex("((a|b)(.*)|(c|d)(.*))((e|f)(.*)|(g|h)(.*))");
      const analysis = analyzePattern(tree);

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
    });
  });

  describe("Edge cases", () => {
    it("should handle zero-byte text", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 0);

      expect(analysis.recommendedAlgorithm).toBe("nfa");
    });

    it("should handle very large text (> 1GB)", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 2 * 1024 * 1024 * 1024); // 2GB

      // Should still recommend DFA for large text
      expect(analysis.recommendedAlgorithm).toBe("dfa");
    });

    it("should handle boundary at 499 bytes (should be NFA)", () => {
      const tree = parseRegex("a(.)b");
      const analysis = analyzePattern(tree, 499);

      expect(analysis.recommendedAlgorithm).toBe("nfa");
    });

    it("should handle boundary at 501 bytes (should be NFA+DFA-cache)", () => {
      const tree = parseRegex("a(.)b");
      const analysis = analyzePattern(tree, 501);

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
    });
  });

  describe("Complexity interaction with text size", () => {
    it("should prefer NFA for low complexity on small text", () => {
      const tree = parseRegex("abc(.*)def"); // Low complexity
      const analysis = analyzePattern(tree, 200);

      expect(analysis.recommendedAlgorithm).toBe("nfa");
    });

    it("should prefer DFA for low complexity on large text", () => {
      const tree = parseRegex("abc(.*)def"); // Low complexity
      const analysis = analyzePattern(tree, 100 * 1024);

      expect(analysis.recommendedAlgorithm).toBe("dfa");
    });

    it("should prefer NFA+DFA-cache for high complexity regardless of large text", () => {
      // Very complex pattern
      const tree = parseRegex("((a|b)(.*)|(c|d)(.*))((e|f)(.*)|(g|h)(.*))");
      const analysis = analyzePattern(tree, 1024 * 1024);

      expect(analysis.recommendedAlgorithm).toBe("nfa-dfa-cache");
      expect(analysis.complexity).toBeGreaterThan(20);
    });
  });

  describe("Reason messages with text size", () => {
    it("should include text size in reason for small text", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 300);

      expect(analysis.reason).toContain("300 bytes");
    });

    it("should include text size in KB for medium text", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree, 5 * 1024);

      expect(analysis.reason).toContain("5.0KB");
    });

    it("should not include text size when undefined", () => {
      const tree = parseRegex("a(.*)b");
      const analysis = analyzePattern(tree);

      expect(analysis.reason).not.toContain("bytes");
      expect(analysis.reason).not.toContain("KB");
    });
  });

  describe("Backward compatibility", () => {
    it("should work without text size parameter (existing behavior)", () => {
      const tree = parseRegex("abc");
      const analysis = analyzePattern(tree);

      expect(analysis.recommendedAlgorithm).toBe("literal-kmp");
      expect(analysis.isLiteral).toBe(true);
    });

    it("should maintain existing literal pattern selection", () => {
      const tree = parseRegex("abcdefghijk");
      const analysis = analyzePattern(tree);

      expect(analysis.recommendedAlgorithm).toBe("literal-bm");
    });

    it("should maintain existing Aho-Corasick selection", () => {
      const tree = parseRegex("(abc|def|ghi)");
      const analysis = analyzePattern(tree);

      expect(analysis.recommendedAlgorithm).toBe("aho-corasick");
    });
  });
});

