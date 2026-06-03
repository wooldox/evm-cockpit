import { describe, it, expect } from "vitest";
import { CHAIN_LIST, getChainDisplay } from "./chains";
describe("chain display", () => {
  it("includes core chains with id/name/short/color", () => {
    const eth = getChainDisplay(1);
    expect(eth.name).toMatch(/ethereum/i);
    expect(eth.short.length).toBeGreaterThan(0);
    expect(eth.color).toMatch(/^#/);
  });
  it("CHAIN_LIST is non-empty and unique by id", () => {
    expect(CHAIN_LIST.length).toBeGreaterThan(3);
    const ids = CHAIN_LIST.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("returns a usable fallback for an unknown chain id", () => {
    const x = getChainDisplay(999999);
    expect(x.id).toBe(999999);
    expect(x.name).toBeTruthy();
    expect(x.color).toMatch(/^#/);
  });
});
