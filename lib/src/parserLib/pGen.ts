import Parser, { ParsingFunction } from "./parser.ts";
import ParserState from "./pState.ts";
import { InputType } from "./utils.ts";

let decoder = new TextDecoder("utf-8");
let encoder = new TextEncoder();

/** Matches a single character using a predicate function */
export const satisfy = (predicate: (char: string) => boolean): Parser<string> =>
  new Parser((state) => {
    if (state.error) return state;
    const { target, index } = state;
    if (typeof target === "string" && index < target.length) {
      const char = target[index];
      return predicate(char)
        ? state.updateByteIndex(1).updateResult(char)
        : state.updateError(`Unexpected character "${char}"`);
    }
    return state.updateError(`Unexpected end of input`);
  });

export const str = (s: string) => {
  if (!(s && typeof s === "string"))
    throw new TypeError(
      `[str] must be called with a string with strict positive length, got ${s}`
    );

  let es = encoder.encode(s);

  return new Parser(((PS) => {
    if (PS.error) return PS;
    const { index, dataView } = PS;
    const remains = dataView.byteLength - index;
    if (!remains)
      return PS.updateError(`[str] Expected '${s}' got End Of Input`);

    if (remains < es.byteLength) {
      let sai = PS.getString(index, remains);

      return PS.updateError(`[str] Expected '${s}' got '${sai}'`);
    }
    let sai = PS.getString(index, es.byteLength);

    let out =
      s === sai
        ? PS.updateByteIndex(es.byteLength).updateResult(s)
        : PS.updateError(`[str] Expected '${s}' got '${sai}'`);

    return out;
  }) as ParsingFunction<string, null>);
};

export const fail = (e: string) => new Parser((s) => s.updateError(e));

export const succeed = <T>(e: T) => new Parser((s) => s.updateResult(e));

export const logState = (msg = "") =>
  new Parser((PS) => {
    console.log("logState : ", msg);
    console.log(PS);
    return PS;
  });

export const getIndex = new Parser((s) =>
  s.updateResult({
    bitIndex: s.bitIndex,
    index: s.index,
  })
);

export const addIndex = (n: number) =>
  new Parser((s) => (s.isError ? s : s.updateByteIndex(n)));

export const anyChar = new Parser(function anyChar$state(state) {
  if (state.isError) return state;

  const results = [];
  let nextState = state;

  while (true) {
    const out = new Parser((s) => {
      if (s.isError) return s;
      const { index, dataView } = s;
      const remains = dataView.byteLength - index;
      if (!remains)
        return s.updateError(`[anyChar] Expected any char got End Of Input`);

      let sai = s.getString(index, 1);

      return s.updateByteIndex(1).updateResult(sai);
    }).pf(nextState);

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

export const char = (c: string) => {
  if (!(c && typeof c === "string" && c.length === 1))
    throw new TypeError(
      `[char] must be called with a single character string, got ${c}`
    );

  let ec = encoder.encode(c);

  return new Parser(((PS) => {
    if (PS.error) return PS;
    const { index, dataView } = PS;
    const remains = dataView.byteLength - index;
    if (!remains)
      return PS.updateError(`[char] Expected '${c}' got End Of Input`);

    if (remains < ec.byteLength) {
      let sai = PS.getString(index, remains);

      return PS.updateError(`[char] Expected '${c}' got '${sai}'`);
    }
    let sai = PS.getString(index, ec.byteLength);

    let out =
      c === sai
        ? PS.updateByteIndex(ec.byteLength).updateResult(c)
        : PS.updateError(`[char] Expected '${c}' got '${sai}'`);

    return out;
  }) as ParsingFunction<string, null>);
};

export const updateData = <D>(d: D) =>
  new Parser((s) => (s.isError ? s : s.updateData(d)));

export const getData = new Parser((s) =>
  s.isError ? s : s.updateResult(s.data)
);
