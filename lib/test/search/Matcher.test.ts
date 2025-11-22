import { describe, it, expect } from "vitest";
import { findAllMatchesLiteralKmp, findAllMatchesLiteralBm, Match, colorizeMatches } from "../../src";
/**
 * Tests for Matcher utilities (KMP, Boyer-Moore, colorization).
 * For NFA/DFA matching tests, see matching-algorithms.test.ts
 */
describe("Matcher", () => {
  describe("findAllMatchesLiteralKmp", () => {
    it("should find simple literal matches", () => {
      const literal = "test";
      const line = "this is a test line";

      const matches = findAllMatchesLiteralKmp(literal, line);

      expect(matches.length).toBe(1);
      expect(matches[0].text).toBe("test");
      expect(matches[0].start).toBe(10);
      expect(matches[0].end).toBe(14);
    });

    it("should find multiple matches", () => {
      const literal = "ab";
      const line = "ab ab ab";

      const matches = findAllMatchesLiteralKmp(literal, line);

      expect(matches.length).toBe(3);
      expect(matches[0].start).toBe(0);
      expect(matches[1].start).toBe(3);
      expect(matches[2].start).toBe(6);
    });

    it("should return empty array when no matches", () => {
      const literal = "xyz";
      const line = "abc def ghi";

      const matches = findAllMatchesLiteralKmp(literal, line);

      expect(matches.length).toBe(0);
    });

    it("should handle overlapping patterns correctly", () => {
      const literal = "aa";
      const line = "aaaa";

      const matches = findAllMatchesLiteralKmp(literal, line);

      // KMP ne devrait pas trouver de matches qui se chevauchent
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("findAllMatchesLiteralBm", () => {
    it("should find simple literal matches", () => {
      const literal = "test";
      const line = "this is a test line";

      const matches = findAllMatchesLiteralBm(literal, line);

      expect(matches.length).toBe(1);
      expect(matches[0].text).toBe("test");
      expect(matches[0].start).toBe(10);
      expect(matches[0].end).toBe(14);
    });

    it("should find multiple matches", () => {
      const literal = "ab";
      const line = "ab ab ab";

      const matches = findAllMatchesLiteralBm(literal, line);

      expect(matches.length).toBe(3);
      expect(matches[0].start).toBe(0);
      expect(matches[1].start).toBe(3);
      expect(matches[2].start).toBe(6);
    });

    it("should return empty array when no matches", () => {
      const literal = "xyz";
      const line = "abc def ghi";

      const matches = findAllMatchesLiteralBm(literal, line);

      expect(matches.length).toBe(0);
    });

    it("should produce same results as KMP", () => {
      const literal = "test";
      const line = "test test test";

      const kmpMatches = findAllMatchesLiteralKmp(literal, line);
      const bmMatches = findAllMatchesLiteralBm(literal, line);

      expect(bmMatches.length).toBe(kmpMatches.length);
      for (let i = 0; i < bmMatches.length; i++) {
        expect(bmMatches[i].start).toBe(kmpMatches[i].start);
        expect(bmMatches[i].end).toBe(kmpMatches[i].end);
      }
    });
  });

  describe("colorizeMatches", () => {
    it("should colorize single match", () => {
      const line = "hello world";
      const matches: Match[] = [
        { start: 0, end: 5, text: "hello" },
      ];

      const colored = colorizeMatches(line, matches);

      expect(colored).toContain("\x1b[31m\x1b[1m"); // Color start
      expect(colored).toContain("\x1b[0m"); // Color end
      expect(colored).toContain("hello");
      expect(colored).toContain("world");
    });

    it("should colorize multiple matches", () => {
      const line = "test test test";
      const matches: Match[] = [
        { start: 0, end: 4, text: "test" },
        { start: 5, end: 9, text: "test" },
        { start: 10, end: 14, text: "test" },
      ];

      const colored = colorizeMatches(line, matches);

      // Devrait contenir 3 paires de codes couleur
      const colorStarts = (colored.match(/\x1b\[31m\x1b\[1m/g) || []).length;
      expect(colorStarts).toBe(3);
    });

    it("should return original line when no matches", () => {
      const line = "hello world";
      const matches: Match[] = [];

      const colored = colorizeMatches(line, matches);

      expect(colored).toBe(line);
    });

    it("should use custom colors", () => {
      const line = "hello world";
      const matches: Match[] = [
        { start: 0, end: 5, text: "hello" },
      ];
      const customStart = "\x1b[32m"; // Green
      const customEnd = "\x1b[0m";

      const colored = colorizeMatches(line, matches, customStart, customEnd);

      expect(colored).toContain(customStart);
      expect(colored).toContain(customEnd);
    });

    it("should preserve text between matches", () => {
      const line = "hello world test";
      const matches: Match[] = [
        { start: 0, end: 5, text: "hello" },
        { start: 12, end: 16, text: "test" },
      ];

      const colored = colorizeMatches(line, matches);

      expect(colored).toContain(" world ");
    });

    it("should handle adjacent matches", () => {
      const line = "abcdef";
      const matches: Match[] = [
        { start: 0, end: 3, text: "abc" },
        { start: 3, end: 6, text: "def" },
      ];

      const colored = colorizeMatches(line, matches);

      expect(colored).toContain("abc");
      expect(colored).toContain("def");
    });

    it("should handle match at start of line", () => {
      const line = "hello world";
      const matches: Match[] = [
        { start: 0, end: 5, text: "hello" },
      ];

      const colored = colorizeMatches(line, matches);

      expect(colored.startsWith("\x1b[31m\x1b[1m")).toBe(true);
    });

    it("should handle match at end of line", () => {
      const line = "hello world";
      const matches: Match[] = [
        { start: 6, end: 11, text: "world" },
      ];

      const colored = colorizeMatches(line, matches);

      expect(colored.endsWith("world\x1b[0m")).toBe(true);
    });

    it("should handle empty match", () => {
      const line = "hello world";
      const matches: Match[] = [
        { start: 5, end: 5, text: "" },
      ];

      const colored = colorizeMatches(line, matches);

      expect(colored).toBeDefined();
    });
  });

  describe("Match interface", () => {
    it("should have correct structure", () => {
      const match: Match = {
        start: 0,
        end: 5,
        text: "hello",
      };

      expect(match.start).toBe(0);
      expect(match.end).toBe(5);
      expect(match.text).toBe("hello");
    });

    it("should calculate correct length", () => {
      const match: Match = {
        start: 10,
        end: 14,
        text: "test",
      };

      const length = match.end - match.start;
      expect(length).toBe(4);
      expect(length).toBe(match.text.length);
    });
  });
});

