import { describe, it, expect } from "vitest";
import { isValidAddress, truncateAddress } from "./address";

describe("address helpers", () => {
  const addr = "0x4E639304D9229AF411020C45b6b4c0ac105225c4";

  it("validates a correct address", () => {
    expect(isValidAddress(addr)).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidAddress("0x123")).toBe(false);
    expect(isValidAddress("not-an-address")).toBe(false);
  });

  it("truncates with default head/tail", () => {
    expect(truncateAddress(addr)).toBe("0x4E63…25c4");
  });
});
