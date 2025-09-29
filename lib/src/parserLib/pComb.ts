import Parser, { ParserTuple } from "./parser.ts";
import ParserState from "./pState.ts";

/** Takes an array of parsers and composes them left to right, so each parser's return value is passed into the next one in the chain. The result is a new parser that, when run, yields the result of the final parser in the chain. */
export const pipe = <D, R extends any[]>(parsers: ParserTuple<R, D>) =>
  new Parser((s) => {
    for (const parser of parsers)
      s = parser.pf(s as ParserState<unknown, unknown>);
    return s;
  }) as Parser<D, R[typeof parsers.length]>;

/** Takes an array of parsers and composes them right to left, so each parsers return value is passed into the next one in the chain. The result is a new parser that, when run, yields the result of the final parser in the chain. */
export const compose = <R extends any[], D>(parsers: ParserTuple<R, D>) =>
  pipe([...parsers].reverse() as ParserTuple<R, D>) as Parser<R[0], D>;

/** Takes an array of parsers, and pipes the **result** of the previous one as the **target** of the next one. As a consequence, every parser except the last one has to have a return type extending the `PStream` class. */
export const pipeResult = <R, D>(parsers: ParserTuple<R[], D>) =>
  new Parser((s) => {
    if (s.error) return s;
    for (const parser of parsers) {
      if (s.error) break;
      s = parser.run(s.result);
    }
    return s;
  }) as Parser<R, D>;

/** Takes an array of parsers, and returns a new parser that matches each of them sequentially, collecting up the results into an array. */
export const sequence = <D, R extends any[]>(parsers: ParserTuple<R, D>) =>
  new Parser((s) => {
    if (s.error) return s;
    const results = [];
    let nextState = s;

    for (const parser of parsers) {
      const out = parser.pf(nextState);
      if (out.error) return results ? out.updateResult(results) : out;
      nextState = out;
      results.push(out.result);
    }
    return nextState.updateResult(results);
  }) as Parser<R, D>;

export const many = function many<T>(parser: Parser<T>): Parser<T[]> {
  return new Parser(function many$state(state) {
    if (state.isError) return state;

    const results = [];
    let nextState = state;

    while (true) {
      const out = parser.pf(nextState);

      if (out.isError) {
        break;
      } else {
        nextState = out;
        results.push(nextState.result);

        if (nextState.index >= nextState.dataView.byteLength) {
          break;
        }
      }
    }

    return nextState.updateResult(results);
  });
};

export function possibly<T, D>(parser: Parser<T, D>): Parser<T | null, D> {
  return new Parser(function possibly$state(state) {
    if (state.isError) return state;

    const nextState = parser.pf(state);
    return nextState.isError ? state.updateResult(null) : nextState;
  });
}

type ParserFn<T> = (_yield: <K>(parser: Parser<K>) => K) => T;

export function coroutine<T>(parserFn: ParserFn<T>): Parser<T> {
  return new Parser(function coroutine$state(state) {
    let currentValue;
    let currentState = state;

    const run = <T>(parser: Parser<T>) => {
      if (!(parser && parser instanceof Parser)) {
        throw new Error(
          `[coroutine] passed values must be Parsers, got ${parser}.`
        );
      }
      const newState = parser.pf(currentState);
      if (newState.isError) {
        throw newState;
      } else {
        currentState = newState;
      }
      currentValue = currentState.result;
      return currentValue;
    };

    try {
      const result = parserFn(run);
      return currentState.updateResult(result);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      } else {
        return e as ParserState<any, any>;
      }
    }
  });
}

export function anyOf<R, D>(...parsers: Parser<R, D>[]) {
  return new Parser(function anyOf$state(state) {
    if (state.isError) return state;

    let nextState = state;

    for (let parser of parsers) {
      const out = parser.pf(nextState);
      if (!out.isError) {
        return out;
      }
    }

    return nextState.updateError(
      `[anyOf] unable to match any possible parsers at index ${state.index}`
    );
  });
}
