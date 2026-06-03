import { describe, it, expect } from "vitest";
import { trunc, fmtBig, identGradient } from "./format";

describe("format", () => {
  it("truncates hex with the default size", () => {
    expect(trunc("0x4E639304D9229AF411020C45b6b4c0ac105225c4")).toBe(
      "0x4E63…25c4",
    );
    expect(trunc(undefined)).toBe("");
  });

  it("formats big integers with separators and passes through junk", () => {
    expect(fmtBig("1000000")).toBe("1,000,000");
    expect(fmtBig("not-a-number")).toBe("not-a-number");
  });

  it("identGradient is deterministic and returns a linear-gradient", () => {
    expect(identGradient("abc")).toBe(identGradient("abc"));
    expect(identGradient("abc")).toMatch(/^linear-gradient/);
  });
});
