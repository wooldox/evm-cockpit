import { describe, it, expect } from "vitest";
import { explorerUrl, txUrl, addressUrl } from "./explorer";

const HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const ADDR = "0x1234567890123456789012345678901234567890";

describe("explorer urls", () => {
  it("returns the explorer base for a known chain", () => {
    const url = explorerUrl(1);
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("returns undefined for an unknown chain", () => {
    expect(explorerUrl(999999)).toBeUndefined();
    expect(txUrl(999999, HASH)).toBeUndefined();
    expect(addressUrl(999999, ADDR)).toBeUndefined();
  });

  it("builds tx and address urls for a known chain", () => {
    const base = explorerUrl(1)!;
    expect(txUrl(1, HASH)).toBe(`${base}/tx/${HASH}`);
    expect(addressUrl(1, ADDR)).toBe(`${base}/address/${ADDR}`);
  });
});
