export type SyntaxTree =
  | { type: "char"; value: string }
  | { type: "dot" }
  | { type: "concat"; left: SyntaxTree; right: SyntaxTree }
  | { type: "alt"; left: SyntaxTree; right: SyntaxTree }
  | { type: "star"; child: SyntaxTree };

export function parseRegex(input: string): SyntaxTree {
  let position = 0;

  /**
   * @returns le caractère courant sans avancer la position
   */
  function peek() {
    return input[position];
  }

  /**
   * @returns le caractère courant et avance la position
   */
  function next() {
    return input[position++];
  }

  /**
   * @returns true s'il reste des caractères à lire dans l'input
   */
  function hasMore() {
    return position < input.length;
  }

  /**
   * Parse une expression d'alternation (séparée par '|', ex: 'a|b')
   * Ce parseur est aussi le parseur le plus haut niveau (point d'entrée qui appel les autres fonctions de parsing)
   * @returns l'arbre syntaxique de l'expression régulière
   */
  function parseAlternation(): SyntaxTree {
    let left = parseConcatenation();

    while (hasMore() && peek() === "|") {
      next(); // consume '|'
      const right = parseConcatenation();
      left = { type: "alt", left, right };
    }

    return left;
  }

  /**
   * Parse une expression de concaténation (séparée par rien, ex: 'ab')
   *
   * @returns l'arbre syntaxique de l'expression régulière
   */
  function parseConcatenation(): SyntaxTree {
    const factors: SyntaxTree[] = [];

    // peek !== "|" && peek() !== ")" car l'aternation est le seul parseur non encore appelé que
    // l'ont risque de rencontrer, et ")" peut être rencontré notamment quand on est appelé par
    // parseAlternation qui a été appelé par parseBase.
    while (hasMore() && peek() !== "|" && peek() !== ")") {
      factors.push(parseFactor());
    }

    if (factors.length === 0) {
      throw new Error("Empty concatenation");
    }

    return factors.reduce((left, right) => ({ type: "concat", left, right }));
  }

  /**
   * Parse une expression factor (ex: 'a*')
   *
   * @returns l'arbre syntaxique de l'expression régulière
   */
  function parseFactor(): SyntaxTree {
    let base = parseBase();

    while (hasMore() && peek() === "*") {
      next(); // consume '*'
      base = { type: "star", child: base };
    }

    return base;
  }

  /**
   * Parse une expression de base, gère surtout les cas spéciaux: parenthèses, '.', échappement, et caractères simples
   * @returns l'arbre syntaxique de l'expression régulière
   */
  function parseBase(): SyntaxTree {
    const char = peek();

    if (char === "(") {
      next(); // consume '('
      if (peek() === ")") {
        next(); // consume ')'
        return { type: "char", value: "" }; // empty string
      }
      const subExpr = parseAlternation();

      if (peek() !== ")") {
        throw new Error(`Expected ')' at position ${position}`);
      }

      next(); // consume ')'
      return subExpr;
    }

    if (char === ".") {
      next(); // consume '.'
      return { type: "dot" };
    }

    if (char === "\\") {
      next(); // consume '\'

      if (!hasMore()) {
        throw new Error("Backslash at end of regex");
      }

      const escapedChar = next(); // consume escaped character
      return { type: "char", value: escapedChar };
    }

    // Check for special characters that shouldn't be here
    if (char === "*" || char === "|" || char === ")") {
      throw new Error(`Unexpected character '${char}' at position ${position}`);
    }

    // Regular character
    next();
    return { type: "char", value: char };
  }

  // Main parse function
  if (input.length === 0) {
    throw new Error("Empty regex");
  }

  const result = parseAlternation();

  if (hasMore()) {
    throw new Error(`Unexpected character at position ${position}: ${peek()}`);
  }

  return result;
}
