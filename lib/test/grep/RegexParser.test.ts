import { describe, it, expect } from "vitest";
import { parseRegex } from "../../src";

describe("RegexParser - Basic Characters", () => {
  it("should parse a single character", () => {
    const result = parseRegex("a");
    expect(result).toEqual({ type: "char", value: "a" });
  });

  it("should parse multiple characters as concatenation", () => {
    const result = parseRegex("abc");
    expect(result.type).toBe("concat");
    if (result.type === "concat") {
      expect(result.left.type).toBe("concat");
      if (result.left.type === "concat") {
        expect(result.left.left).toEqual({ type: "char", value: "a" });
        expect(result.left.right).toEqual({ type: "char", value: "b" });
      }
      expect(result.right).toEqual({ type: "char", value: "c" });
    }
  });

  it("should parse numeric characters", () => {
    const result = parseRegex("123");
    expect(result.type).toBe("concat");
  });

  it("should parse special characters when escaped", () => {
    const result = parseRegex("\\*");
    expect(result).toEqual({ type: "char", value: "*" });
  });

  it("should parse escaped backslash", () => {
    const result = parseRegex("\\\\");
    expect(result).toEqual({ type: "char", value: "\\" });
  });

  it("should parse escaped dot", () => {
    const result = parseRegex("\\.");
    expect(result).toEqual({ type: "char", value: "." });
  });

  it("should parse escaped pipe", () => {
    const result = parseRegex("\\|");
    expect(result).toEqual({ type: "char", value: "|" });
  });

  it("should parse escaped parentheses", () => {
    const result1 = parseRegex("\\(");
    expect(result1).toEqual({ type: "char", value: "(" });

    const result2 = parseRegex("\\)");
    expect(result2).toEqual({ type: "char", value: ")" });
  });
});

describe("RegexParser - Dot (Wildcard)", () => {
  it("should parse a single dot", () => {
    const result = parseRegex(".");
    expect(result).toEqual({ type: "dot" });
  });

  it("should parse dot in concatenation", () => {
    const result = parseRegex("a.b");
    expect(result.type).toBe("concat");
  });

  it("should parse multiple dots", () => {
    const result = parseRegex("...");
    expect(result.type).toBe("concat");
  });
});

describe("RegexParser - Star Operator", () => {
  it("should parse character with star", () => {
    const result = parseRegex("a*");
    expect(result).toEqual({
      type: "star",
      child: { type: "char", value: "a" },
    });
  });

  it("should parse dot with star", () => {
    const result = parseRegex(".*");
    expect(result).toEqual({
      type: "star",
      child: { type: "dot" },
    });
  });

  it("should parse multiple stars on same element", () => {
    const result = parseRegex("a**");
    expect(result.type).toBe("star");
    if (result.type === "star") {
      expect(result.child.type).toBe("star");
    }
  });

  it("should parse concatenation with star", () => {
    const result = parseRegex("ab*c");
    expect(result.type).toBe("concat");
  });

  it("should parse star on grouped expression", () => {
    const result = parseRegex("(ab)*");
    expect(result.type).toBe("star");
    if (result.type === "star") {
      expect(result.child.type).toBe("concat");
    }
  });
});

describe("RegexParser - Alternation", () => {
  it("should parse simple alternation", () => {
    const result = parseRegex("a|b");
    expect(result).toEqual({
      type: "alt",
      left: { type: "char", value: "a" },
      right: { type: "char", value: "b" },
    });
  });

  it("should parse alternation with concatenation", () => {
    const result = parseRegex("abc|def");
    expect(result.type).toBe("alt");
    if (result.type === "alt") {
      expect(result.left.type).toBe("concat");
      expect(result.right.type).toBe("concat");
    }
  });

  it("should parse multiple alternations (left-associative)", () => {
    const result = parseRegex("a|b|c");
    expect(result.type).toBe("alt");
    if (result.type === "alt") {
      expect(result.left.type).toBe("alt");
      expect(result.right).toEqual({ type: "char", value: "c" });
    }
  });

  it("should parse alternation with star", () => {
    const result = parseRegex("a*|b*");
    expect(result.type).toBe("alt");
    if (result.type === "alt") {
      expect(result.left.type).toBe("star");
      expect(result.right.type).toBe("star");
    }
  });
});

describe("RegexParser - Parentheses", () => {
  it("should parse grouped expression", () => {
    const result = parseRegex("(a)");
    expect(result).toEqual({ type: "char", value: "a" });
  });

  it("should parse empty parentheses as empty string", () => {
    const result = parseRegex("()");
    expect(result).toEqual({ type: "char", value: "" });
  });

  it("should parse nested parentheses", () => {
    const result = parseRegex("((a))");
    expect(result).toEqual({ type: "char", value: "a" });
  });

  it("should parse grouped alternation", () => {
    const result = parseRegex("(a|b)");
    expect(result.type).toBe("alt");
  });

  it("should parse grouped concatenation", () => {
    const result = parseRegex("(ab)");
    expect(result.type).toBe("concat");
  });

  it("should parse complex nested groups", () => {
    const result = parseRegex("((a|b)*c)");
    expect(result.type).toBe("concat");
  });
});

describe("RegexParser - Complex Patterns", () => {
  it("should parse pattern with all operators", () => {
    const result = parseRegex("(a|b)*c.");
    expect(result.type).toBe("concat");
  });

  it("should parse pattern from main.ts example", () => {
    const result = parseRegex("(.*)(abc)(.*)");
    expect(result.type).toBe("concat");
  });

  it("should parse alternation with groups and stars", () => {
    const result = parseRegex("(a*|b*)c");
    expect(result.type).toBe("concat");
  });

  it("should parse complex nested pattern", () => {
    const result = parseRegex("((a|b)*c)*");
    expect(result.type).toBe("star");
  });
});

describe("RegexParser - Error Cases", () => {
  it("should throw error for empty regex", () => {
    expect(() => parseRegex("")).toThrow("Empty regex");
  });

  it("should throw error for unmatched opening parenthesis", () => {
    expect(() => parseRegex("(a")).toThrow("Expected ')'");
  });

  it("should throw error for unmatched closing parenthesis", () => {
    expect(() => parseRegex("a)")).toThrow("Unexpected character");
  });

  it("should throw error for star at beginning", () => {
    expect(() => parseRegex("*a")).toThrow("Unexpected character '*'");
  });

  it("should throw error for pipe at beginning", () => {
    expect(() => parseRegex("|a")).toThrow("Empty concatenation");
  });

  it("should throw error for pipe at end", () => {
    expect(() => parseRegex("a|")).toThrow("Empty concatenation");
  });

  it("should throw error for backslash at end", () => {
    expect(() => parseRegex("a\\")).toThrow("Backslash at end of regex");
  });

  it("should throw error for double pipe", () => {
    expect(() => parseRegex("a||b")).toThrow("Empty concatenation");
  });

  it("should throw error for unexpected closing paren", () => {
    expect(() => parseRegex("a)b")).toThrow("Unexpected character");
  });
});

describe("RegexParser - Edge Cases", () => {
  it("should parse single star on group", () => {
    const result = parseRegex("(a)*");
    expect(result.type).toBe("star");
  });

  it("should parse alternation in nested groups", () => {
    const result = parseRegex("((a|b)|(c|d))");
    expect(result.type).toBe("alt");
  });

  it("should parse long concatenation", () => {
    const result = parseRegex("abcdefghij");
    expect(result.type).toBe("concat");
  });

  it("should parse pattern with only dots", () => {
    const result = parseRegex("...");
    expect(result.type).toBe("concat");
  });

  it("should parse pattern with escaped special chars", () => {
    const result = parseRegex("\\*\\|\\(\\)");
    expect(result.type).toBe("concat");
  });
});
