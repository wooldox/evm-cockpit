import { describe, it, expect } from "vitest";
import { stringifyWithBigint } from "./stringify";

describe("stringifyWithBigint", () => {
  it("serializes bigint as decimal string", () => {
    expect(stringifyWithBigint({ a: 1n, b: [2n, "x"] })).toBe(
      '{"a":"1","b":["2","x"]}',
    );
  });

  it("leaves plain objects unchanged", () => {
    const obj = { a: 1, b: "hello", c: true, d: null };
    expect(stringifyWithBigint(obj)).toBe(JSON.stringify(obj));
  });

  it("respects the space parameter for indentation", () => {
    const result = stringifyWithBigint({ n: 42n }, 2);
    expect(result).toBe('{\n  "n": "42"\n}');
  });

  it("handles nested bigints inside arrays", () => {
    expect(stringifyWithBigint([1n, 2n, 3n])).toBe('["1","2","3"]');
  });
});
