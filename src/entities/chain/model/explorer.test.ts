import { describe, it, expect, afterEach } from "vitest";
import { explorerUrl, txUrl, addressUrl } from "./explorer";
import { useChainCatalog } from "./catalogStore";
import type { TCatalogChain } from "./catalog";

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

describe("explorer urls — catalog fallback", () => {
  const CATALOG_ONLY_ID = 876543;

  afterEach(() => {
    const byId = new Map(useChainCatalog.getState().byId);
    byId.delete(CATALOG_ONLY_ID);
    useChainCatalog.setState({ byId });
  });

  it("falls back to the catalog explorer for a non-viem chain", () => {
    const entry: TCatalogChain = {
      id: CATALOG_ONLY_ID,
      name: "Exotic",
      short: "EXO",
      color: "#abcdef",
      rpcUrls: ["https://exotic.example"],
      explorerUrl: "https://scan.exotic.example",
      nativeSymbol: "EXO",
      source: "remote",
    };
    const byId = new Map(useChainCatalog.getState().byId);
    byId.set(entry.id, entry);
    useChainCatalog.setState({ byId });

    expect(explorerUrl(CATALOG_ONLY_ID)).toBe("https://scan.exotic.example");
    expect(txUrl(CATALOG_ONLY_ID, HASH)).toBe(
      `https://scan.exotic.example/tx/${HASH}`,
    );
  });
});
