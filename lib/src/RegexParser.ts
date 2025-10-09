export type SyntaxTree =
  | { type: "char"; value: string }
  | { type: "dot" }
  | { type: "concat"; left: SyntaxTree; right: SyntaxTree }
  | { type: "alt"; left: SyntaxTree; right: SyntaxTree }
  | { type: "star"; child: SyntaxTree };

class RegexParser {
  private input: string;
  private position: number;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
  }

  parse(): SyntaxTree {
    if (this.input.length === 0) {
      throw new Error("Empty regex");
    }

    const result = this.parseAlternation();

    if (this.position < this.input.length) {
      throw new Error(
        `Unexpected character at position ${this.position}: ${this.input[this.position]}`
      );
    }

    return result;
  }

  private parseAlternation(): SyntaxTree {
    let left = this.parseConcatenation();

    while (this.position < this.input.length && this.current() === "|") {
      this.position++; // consume '|'
      const right = this.parseConcatenation();
      left = { type: "alt", left, right };
    }

    return left;
  }

  private parseConcatenation(): SyntaxTree {
    const factors: SyntaxTree[] = [];

    while (
      this.position < this.input.length &&
      this.current() !== "|" &&
      this.current() !== ")"
    ) {
      factors.push(this.parseFactor());
    }

    if (factors.length === 0) {
      throw new Error("Empty concatenation");
    }

    return factors.reduce((left, right) => ({ type: "concat", left, right }));
  }

  private parseFactor(): SyntaxTree {
    let base = this.parseBase();

    while (this.position < this.input.length && this.current() === "*") {
      this.position++; // consume '*'
      base = { type: "star", child: base };
    }

    return base;
  }

  private parseBase(): SyntaxTree {
    const char = this.current();

    if (char === "(") {
      this.position++; // consume '('
      const subExpr = this.parseAlternation();

      if (this.current() !== ")") {
        throw new Error(`Expected ')' at position ${this.position}`);
      }

      this.position++; // consume ')'
      return subExpr;
    }

    if (char === ".") {
      this.position++; // consume '.'
      return { type: "dot" };
    }

    if (char === "\\") {
      this.position++; // consume '\'

      if (this.position >= this.input.length) {
        throw new Error("Backslash at end of regex");
      }

      const escapedChar = this.current();
      this.position++; // consume escaped character

      return { type: "char", value: escapedChar };
    }

    // Check for special characters that shouldn't be here
    if (char === "*" || char === "|" || char === ")") {
      throw new Error(
        `Unexpected character '${char}' at position ${this.position}`
      );
    }

    // Regular character
    this.position++;
    return { type: "char", value: char };
  }

  private current(): string {
    return this.input[this.position];
  }
}

export function parseRegex(input: string): SyntaxTree {
  const parser = new RegexParser(input);
  return parser.parse();
}
