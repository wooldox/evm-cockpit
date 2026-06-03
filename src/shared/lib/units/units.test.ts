import { describe, it, expect } from "vitest";
import { toBaseUnits, fromBaseUnits, type EthUnit } from "./units";

describe("units", () => {
  it("converts ether to wei", () => {
    expect(toBaseUnits("1", "ether")).toBe(1_000_000_000_000_000_000n);
  });

  it("converts gwei to wei", () => {
    expect(toBaseUnits("1", "gwei")).toBe(1_000_000_000n);
  });

  it("passes wei through as integer", () => {
    expect(toBaseUnits("42", "wei")).toBe(42n);
  });

  it("converts token amounts using decimals", () => {
    expect(toBaseUnits("1.5", 6)).toBe(1_500_000n); // e.g. USDC
  });

  it("round-trips from base units back to a decimal string", () => {
    expect(fromBaseUnits(1_500_000n, 6)).toBe("1.5");
  });

  it("rejects fractional wei", () => {
    expect(() => toBaseUnits("1.5", "wei")).toThrow();
  });

  const _typecheck: EthUnit = "ether";
  void _typecheck;
});
