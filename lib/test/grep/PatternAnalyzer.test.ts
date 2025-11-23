import { describe, it, expect } from "vitest";
import { parseRegex, analyzeSqlPattern, buildSqlQuery } from "../../src";

describe("PatternAnalyzer", () => {
  describe("analyzeSqlPattern", () => {
    it("should detect exact literal patterns", () => {
      const tree = parseRegex("cat");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("exact");
      expect(analysis.exactLiteral).toBe("cat");
      expect(analysis.exactLength).toBe(3);
      expect(analysis.minLength).toBe(3);
      expect(analysis.maxLength).toBe(3);
    });

    it("should detect prefix patterns", () => {
      const tree = parseRegex("cat.*");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("prefix");
      expect(analysis.prefix).toBe("cat");
      expect(analysis.minLength).toBe(3);
    });

    it("should detect suffix patterns", () => {
      const tree = parseRegex(".*ing");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("suffix");
      expect(analysis.suffix).toBe("ing");
      expect(analysis.minLength).toBe(3);
    });

    it("should detect alternation of literals", () => {
      const tree = parseRegex("(cat|dog|bird)");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("alternation");
      expect(analysis.alternationLiterals).toContain("cat");
      expect(analysis.alternationLiterals).toContain("dog");
      expect(analysis.alternationLiterals).toContain("bird");
    });

    it("should detect contains patterns", () => {
      const tree = parseRegex(".*test.*");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("contains");
      expect(analysis.requiredLiterals).toContain("test");
    });

    it("should detect match-all patterns", () => {
      const tree = parseRegex(".*");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("match_all");
      expect(analysis.minLength).toBe(0);
    });

    it("should detect match-all with minimum length", () => {
      const tree = parseRegex("..*");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("match_all");
      expect(analysis.minLength).toBe(1);
    });

    it("should detect SQL LIKE patterns", () => {
      const tree = parseRegex("a.c");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("sql_pattern");
      expect(analysis.sqlLikePattern).toBe("a_c");
      expect(analysis.exactLength).toBe(3);
      expect(analysis.minLength).toBe(3);
      expect(analysis.maxLength).toBe(3);
    });

    it("should detect SQL LIKE patterns with multiple dots", () => {
      const tree = parseRegex("test..");
      const analysis = analyzeSqlPattern(tree);

      expect(analysis.type).toBe("sql_pattern");
      expect(analysis.sqlLikePattern).toBe("test__");
      expect(analysis.exactLength).toBe(6);
    });
  });

  describe("buildSqlQuery", () => {
    it("should build exact match query", () => {
      const tree = parseRegex("cat");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toBe("term = ?");
      expect(query.parameters).toEqual(["cat"]);
      expect(query.needsNfaFiltering).toBe(false);
    });

    it("should build prefix query", () => {
      const tree = parseRegex("cat.*");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toContain("term LIKE ?");
      expect(query.parameters[0]).toBe("cat%");
      expect(query.needsNfaFiltering).toBe(true);
    });

    it("should build suffix query", () => {
      const tree = parseRegex(".*ing");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toContain("term LIKE ?");
      expect(query.parameters[0]).toBe("%ing");
      expect(query.needsNfaFiltering).toBe(true);
    });

    it("should build alternation query", () => {
      const tree = parseRegex("(cat|dog|bird)");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toBe("term IN (?,?,?)");
      expect(query.parameters).toEqual(["cat", "dog", "bird"]);
      expect(query.needsNfaFiltering).toBe(false);
    });

    it("should build SQL LIKE query for patterns with dots", () => {
      const tree = parseRegex("a.c");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toContain("term LIKE ?");
      expect(query.whereClause).toContain("LENGTH(term) = ?");
      expect(query.parameters[0]).toBe("a_c");
      expect(query.parameters[1]).toBe(3);
      expect(query.needsNfaFiltering).toBe(false); // SQL LIKE suffit
    });

    it("should escape SQL LIKE special characters in prefix", () => {
      const tree = parseRegex("test_.*");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.parameters[0]).toBe("test\\_%");
    });

    it("should handle match-all patterns without NFA", () => {
      const tree = parseRegex(".*");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toBe("1=1");
      expect(query.parameters).toEqual([]);
      expect(query.needsNfaFiltering).toBe(false); // Pas besoin de NFA
    });

    it("should handle match-all with minimum length", () => {
      const tree = parseRegex("..*");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toBe("LENGTH(term) >= ?");
      expect(query.parameters).toEqual([1]);
      expect(query.needsNfaFiltering).toBe(false); // Pas besoin de NFA
    });

    it("should add max length constraint when available", () => {
      const tree = parseRegex("a.c");
      const analysis = analyzeSqlPattern(tree);
      const query = buildSqlQuery(analysis);

      expect(query.whereClause).toContain("LENGTH(term) = ?");
      expect(query.parameters).toContain(3);
    });
  });
});

