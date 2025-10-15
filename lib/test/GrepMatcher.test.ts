import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseRegex } from "../src/RegexParser";
import { GrepMatcher, createGrepMatcher } from "../src/GrepMatcher";
import { Match } from "../src/Matcher";

describe("GrepMatcher", () => {
  const testDir = path.join(__dirname, "test-files");
  const testFile = path.join(testDir, "grep-test.txt");

  beforeEach(() => {
    // Créer le répertoire de test
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Créer un fichier de test
    const content = [
      "hello world",
      "test line with test",
      "another line",
      "testing testing 123",
      "no match here",
      "HELLO WORLD",
      "Test with capital",
    ].join("\n");

    fs.writeFileSync(testFile, content, "utf-8");
  });

  afterEach(() => {
    // Nettoyer les fichiers de test
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe("Constructor and Prefilter", () => {
    it("should NOT enable prefilter when algorithm is literal-kmp", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { algorithm: "literal-kmp" });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(false);
      expect(stats.literals).toContain("test");
    });

    it("should NOT enable prefilter when algorithm is literal-bm", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { algorithm: "literal-bm" });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(false);
      expect(stats.literals).toContain("test");
    });

    it("should NOT enable prefilter when algorithm is aho-corasick", () => {
      const tree = parseRegex("from|what|who");
      const matcher = new GrepMatcher(tree, { algorithm: "aho-corasick" });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(false);
    });

    it("should enable prefilter when algorithm is NFA and pattern has literals", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { algorithm: "nfa" });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(true);
      expect(stats.literals).toContain("test");
    });

    it("should enable prefilter when algorithm is DFA and pattern has literals", () => {
      const tree = parseRegex("(.*)test(.*)");
      const matcher = new GrepMatcher(tree, { algorithm: "dfa" });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(true);
      expect(stats.literals).toContain("test");
    });

    it("should create matcher with prefilter disabled when explicitly requested", () => {
      const tree = parseRegex("(.*)test(.*)");
      const matcher = new GrepMatcher(tree, { enablePrefilter: false });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(false);
    });

    it("should extract literals from simple pattern", () => {
      const tree = parseRegex("hello");
      const matcher = new GrepMatcher(tree);
      const stats = matcher.getPrefilterStats();

      expect(stats.literals).toContain("hello");
      expect(stats.literalCount).toBe(1);
    });

    it("should extract literals from pattern with star", () => {
      const tree = parseRegex("(.*)(test)");
      const matcher = new GrepMatcher(tree);
      const stats = matcher.getPrefilterStats();

      expect(stats.literals).toContain("test");
    });

    it("should not use prefilter for pattern with only wildcards", () => {
      const tree = parseRegex("(.*)");
      const matcher = new GrepMatcher(tree);
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(false);
    });
  });

  describe("searchFile", () => {
    it("should find lines matching simple pattern", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.line.includes("test"))).toBe(true);
    });

    it("should return line numbers correctly", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      // Vérifier que les numéros de ligne sont corrects
      for (const result of results) {
        expect(result.lineNumber).toBeGreaterThan(0);
        expect(result.line).toBeTruthy();
      }
    });

    it("should return matches for each line", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const matches: Match[] = [];
        let pos = 0;
        while ((pos = line.indexOf("test", pos)) !== -1) {
          matches.push({ start: pos, end: pos + 4, text: "test" });
          pos += 4;
        }
        return matches;
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      // Vérifier que chaque résultat a des matches
      for (const result of results) {
        expect(result.matches.length).toBeGreaterThan(0);
      }
    });

    it("should work with prefilter disabled", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { enablePrefilter: false });
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("ignoreCase option", () => {
    it("should match case-insensitively when ignoreCase is true", () => {
      const tree = parseRegex("hello");
      const matcher = new GrepMatcher(tree, { ignoreCase: true });
      const mockMatcher = (line: string): Match[] => {
        const lowerLine = line.toLowerCase();
        const pos = lowerLine.indexOf("hello");
        if (pos === -1) return [];
        return [
          { start: pos, end: pos + 5, text: line.substring(pos, pos + 5) },
        ];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      // Devrait matcher "hello world" et "HELLO WORLD"
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should match case-sensitively by default", () => {
      const tree = parseRegex("hello");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("hello");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 5, text: "hello" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      // Devrait matcher seulement "hello world" (pas "HELLO WORLD")
      expect(results.every((r) => r.line.includes("hello"))).toBe(true);
    });
  });

  describe("invertMatch option", () => {
    it("should return lines that do NOT match when invertMatch is true", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { invertMatch: true });
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      // Toutes les lignes retournées ne devraient PAS contenir "test" (case-sensitive)
      expect(results.every((r) => !r.line.includes("test"))).toBe(
        true
      );
    });

    it("should return lines that match when invertMatch is false", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { invertMatch: false });
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      // Toutes les lignes retournées devraient contenir "test"
      expect(results.every((r) => r.line.toLowerCase().includes("test"))).toBe(
        true
      );
    });
  });

  describe("countMatches", () => {
    it("should count matching lines correctly", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const count = matcher.countMatches(testFile, mockMatcher);

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe("number");
    });

    it("should return 0 when no matches", () => {
      const tree = parseRegex("xyz");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("xyz");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 3, text: "xyz" }];
      };

      const count = matcher.countMatches(testFile, mockMatcher);

      expect(count).toBe(0);
    });
  });

  describe("hasMatch", () => {
    it("should return true when at least one line matches", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const hasMatch = matcher.hasMatch(testFile, mockMatcher);

      expect(hasMatch).toBe(true);
    });

    it("should return false when no lines match", () => {
      const tree = parseRegex("xyz");
      const matcher = new GrepMatcher(tree);
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("xyz");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 3, text: "xyz" }];
      };

      const hasMatch = matcher.hasMatch(testFile, mockMatcher);

      expect(hasMatch).toBe(false);
    });

    it("should stop at first match (optimization)", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree);
      let callCount = 0;
      const mockMatcher = (line: string): Match[] => {
        callCount++;
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const hasMatch = matcher.hasMatch(testFile, mockMatcher);

      expect(hasMatch).toBe(true);
      // Devrait s'arrêter après avoir trouvé le premier match
      // donc callCount devrait être inférieur au nombre total de lignes
      expect(callCount).toBeLessThan(7);
    });
  });

  describe("createGrepMatcher factory", () => {
    it("should create a GrepMatcher instance", () => {
      const tree = parseRegex("test");
      const matcher = createGrepMatcher(tree);

      expect(matcher).toBeInstanceOf(GrepMatcher);
    });

    it("should pass options correctly", () => {
      const tree = parseRegex("test");
      const matcher = createGrepMatcher(tree, { enablePrefilter: false });
      const stats = matcher.getPrefilterStats();

      expect(stats.enabled).toBe(false);
    });
  });

  describe("chunkSize option", () => {
    it("should work with custom chunk size", () => {
      const tree = parseRegex("test");
      const matcher = new GrepMatcher(tree, { chunkSize: 1024 });
      const mockMatcher = (line: string): Match[] => {
        const pos = line.indexOf("test");
        if (pos === -1) return [];
        return [{ start: pos, end: pos + 4, text: "test" }];
      };

      const results = Array.from(matcher.searchFile(testFile, mockMatcher));

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
