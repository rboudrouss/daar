import ParserState from "./pState.ts";
import { InputType } from "./utils.ts";

export type ParsingFunction<R, D> = (
  PS: ParserState<any, any>
) => ParserState<R, D>;

/** An array of different generic parsers. */
export type ParserTuple<R extends any[], D> = {
  [K in keyof R]: Parser<R[K], D>;
};
/** An array of parsers paired with strings. */
export type PairedParsers<D, R> = { [K in keyof R]: [string, Parser<R[K], D>] };
/** An object of results indexed by string keys. */
export type PairedResults<R> = { [key: string]: R[keyof R] };
/** Yielder of parsers, which behaves very similarly to monads in functional programming. */
export type ParserMonad<D, R> = Generator<Parser<D, unknown>, R>;

export default class Parser<R, D = any> {
  pf: ParsingFunction<R, D>;

  constructor(pf: ParsingFunction<R, D>) {
    this.pf = pf;
  }

  run(target: InputType): ParserState<R, D> {
    return this.pf(ParserState.init(target));
  }

  map<T>(fn: (x: R) => T): Parser<T, D> {
    const pf = this.pf;
    return new Parser((state) => {
      const newState = pf(state);
      if (newState.isError) return newState as unknown as ParserState<T, D>;
      return newState.updateResult(fn(newState.result));
    });
  }

  tag(s: string): Parser<{ name: string; value: R }, D> {
    return this.map((x) => {
      return {
        name: s,
        value: x,
      };
    });
  }

  chain<R2>(fn: (x: R) => Parser<R2, D>): Parser<R2, D> {
    const p = this.pf;
    return new Parser((state) => {
      const newState = p(state);
      if (newState.isError) return newState as unknown as ParserState<R2, D>;
      return fn(newState.result).pf(newState);
    });
  }

  errorMap(fn: (s: ParserState<R, D>) => string): Parser<R, D> {
    const p = this.pf;
    return new Parser(function Parser$errorMap$state(state): ParserState<R, D> {
      const nextState = p(state);
      if (!nextState.isError) return nextState as unknown as ParserState<R, D>;
      return nextState.updateError(fn(nextState));
    });
  }

  fork<F>(
    target: InputType,
    errorFn: (errorMsg: string | null, parsingState: ParserState<R, D>) => F,
    successFn: (result: R, parsingState: ParserState<R, D>) => F
  ) {
    const state = ParserState.init(target);
    const newState = this.pf(state);

    if (newState.isError) {
      return errorFn(newState.error, newState);
    }

    return successFn(newState.result, newState);
  }
}
