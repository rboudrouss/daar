import { InputType, InputTypes, isTypedArray } from "./utils.ts";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export type PSProps<R, D> = {
  dataView: DataView;
  inputType: InputTypes;
  target: InputType;
  isError: boolean;
  error: string | null;
  bitIndex: number;
  result: R;
  data: D;
};

/**
 * Class representing a parser state.
 * It is composed of some data, an error and some parsed result.
 */
export default class ParserState<R, D = any> {
  dataView: DataView;
  inputType: InputTypes;

  target: InputType;
  isError: boolean;
  error: string | null;
  bitIndex: number;
  result: R;
  data: D;

  constructor(PS: PSProps<R, D>) {
    this.dataView = PS.dataView;
    this.inputType = PS.inputType;
    this.target = PS.target;
    this.isError = PS.isError;
    this.error = PS.error;
    this.bitIndex = PS.bitIndex;
    this.result = PS.result;
    this.data = PS.data;
  }

  /* byteIndex <!> */
  get index() {
    return Math.floor(this.bitIndex / 8);
  }

  set index(i: number) {
    this.bitIndex = i * 8 + this.bitOffset;
  }

  get byteIndex() {
    return this.index;
  }

  get bitOffset() {
    return this.bitIndex % 8;
  }

  get props() {
    return {
      dataView: this.dataView,
      inputType: this.inputType,
      target: this.target,
      isError: this.isError,
      error: this.error,
      bitIndex: this.bitIndex,
      result: this.result,
      data: this.data,
    } as PSProps<R, D>;
  }

  elementAt(i: number): number | null {
    try {
      return this.dataView.getUint8(i);
    } catch (e) {
      return null;
    }
  }

  /**
   * Decodes a utf8 character from the dataView.
   * @param index The index of the character.
   * @param length The length of the character in bytes.
   */
  getUtf8Char(index: number, length: number): string {
    const dataView = this.dataView;
    const bytes = Uint8Array.from({ length }, (_, i) =>
      dataView.getUint8(index + i)
    );
    return decoder.decode(bytes);
  }

  /**
   * Determines the width of a character.
   * @param index The index of the character.
   */
  getCharWidth(index: number): number {
    const byte = this.elementAt(index);
    if (byte === null) return 0;
    if ((byte & 0x80) >> 7 === 0) return 1;
    if ((byte & 0xe0) >> 5 === 0b110) return 2;
    if ((byte & 0xf0) >> 4 === 0b1110) return 3;
    if ((byte & 0xf0) >> 4 === 0b1111) return 4;
    return 1;
  }

  /**
   * Gets a character with the correct size.
   * @param index The index of the caracter.
   */
  getChar(index: number): string {
    return this.getUtf8Char(index, this.getCharWidth(index));
  }

  /**
   * Gets a string of a certain length from the internal dataview.
   * @param index The index of the first character in the string.
   * @param length The number of characters to get.
   */
  getString(index: number, length: number): string {
    const dataView = this.dataView;
    const bytes = Uint8Array.from({ length }, (_, i) =>
      dataView.getUint8(index + i)
    );
    return decoder.decode(bytes);
  }

  /**
   * Gets the next characters in a string using a bytelength from the internal dataview.
   * @param byteLength The number of bytes to get.
   */
  nextString(byteLength: number): string {
    const dataView = this.dataView;
    const index = this.index;
    const bytes = Uint8Array.from({ length: byteLength }, (_, i) => {
      this.index = index + i;
      return dataView.getUint8(this.index);
    });
    this.index++;
    return decoder.decode(bytes);
  }

  /** Gets the next character with the correct size, *without updating the index*. */
  peekChar(): string {
    return this.getChar(this.index);
  }

  /** Gets the next character in the stream. */
  nextChar(): string {
    const index = this.index;
    const charWidth = this.getCharWidth(index);
    this.index += charWidth;
    return this.getUtf8Char(index, charWidth);
  }

  /** Gets the next `n` characters in the stream. */
  nextChars(n: number): string {
    let s = "";
    let index: number, charWidth: number;
    for (let i = 0; i < n; i++) {
      index = this.index;
      charWidth = this.getCharWidth(index);
      s += this.getUtf8Char(index, charWidth);
      this.index += charWidth;
    }
    return s;
  }

  updateError(e: string) {
    return new ParserState({
      ...this.props,
      error: e,
      isError: true,
    });
  }

  updateResult<T>(r: T) {
    return new ParserState({
      ...this.props,
      result: r,
    });
  }
  updateData<D2>(d: D2) {
    return new ParserState({
      ...this.props,
      data: d,
    });
  }

  updateByteIndex(n: number) {
    return new ParserState({
      ...this.props,
      bitIndex: this.bitIndex + n * 8,
    });
  }

  updateBitIndex(n: number) {
    return new ParserState({
      ...this.props,
      bitIndex: this.bitIndex + n,
    });
  }

  static init<D>(
    target: InputType,
    data: D | null = null
  ): ParserState<null, D | null> {
    let dataView: DataView;
    let inputType;

    if (typeof target === "string") {
      dataView = new DataView(encoder.encode(target).buffer);
      inputType = InputTypes.STRING;
    } else if (typeof target === "number") {
      let buffer = new ArrayBuffer(target);
      dataView = new DataView(buffer, 0);
      inputType = InputTypes.NUMBER;
    } else if (target instanceof ArrayBuffer) {
      dataView = new DataView(target, 0);
      inputType = InputTypes.ARRAY_BUFFER;
    } else if (isTypedArray(target)) {
      dataView = new DataView(target.buffer, 0);
      inputType = InputTypes.TYPED_ARRAY;
    } else if (target instanceof DataView) {
      dataView = target;
      inputType = InputTypes.DATA_VIEW;
    } else
      throw new Error(
        `Cannot process input. Must be a string, a number, or a DataView. but got ${typeof target}`
      );
    return new ParserState({
      dataView,
      inputType,

      target,
      isError: false,
      error: null,
      result: null,
      data,
      bitIndex: 0,
    });
  }
}
