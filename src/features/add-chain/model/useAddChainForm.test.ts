import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import { buildStaticCatalog } from "@/entities/chain/model/catalog";
import { CHAIN_COLORS, useAddChainForm } from "./useAddChainForm";

// Reset the catalog store between tests the same way catalogStore.test.ts does
// (custom: [] + re-derived entries) so duplicate checks read a clean catalog.
function resetStore() {
  const fresh = buildStaticCatalog();
  useChainCatalog.setState({
    base: fresh,
    custom: [],
    entries: fresh,
    byId: new Map(fresh.map((c) => [c.id, c])),
    status: "static",
  });
}

function fillValid(r: { current: ReturnType<typeof useAddChainForm> }) {
  act(() => {
    r.current.setName("Testlandia");
    r.current.setIdStr("999777");
    r.current.setRpc("http://127.0.0.1:9999");
    r.current.setSymbol("tld");
  });
}

describe("useAddChainForm", () => {
  beforeEach(resetStore);

  it("starts invalid (canSave false) and accepts a complete valid form", () => {
    const { result } = renderHook(() => useAddChainForm());
    expect(result.current.canSave).toBe(false);
    fillValid(result);
    expect(result.current.idError).toBeUndefined();
    expect(result.current.rpcError).toBeUndefined();
    expect(result.current.canSave).toBe(true);
  });

  it("rejects non-positive / non-integer ids", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    act(() => result.current.setIdStr("0"));
    expect(result.current.idError).toMatch(/positive integer/i);
    expect(result.current.canSave).toBe(false);
  });

  it("flags an id that already exists in the catalog (mainnet)", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    act(() => result.current.setIdStr("1"));
    expect(result.current.idError).toMatch(/already exists/i);
    expect(result.current.canSave).toBe(false);
  });

  it("requires an http(s) RPC URL", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    act(() => result.current.setRpc("wss://rpc.nope.xyz"));
    expect(result.current.rpcError).toMatch(/http/i);
    expect(result.current.canSave).toBe(false);
  });

  it("buildEntry derives short/nativeSymbol/explorerUrl and source custom", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    act(() => {
      result.current.setExplorer("scan.testlandia.xyz/");
      result.current.setColor(CHAIN_COLORS[3]!);
    });
    expect(result.current.buildEntry()).toEqual({
      id: 999777,
      name: "Testlandia",
      short: "TLD",
      color: CHAIN_COLORS[3],
      rpcUrls: ["http://127.0.0.1:9999"],
      explorerUrl: "https://scan.testlandia.xyz",
      nativeSymbol: "TLD",
      source: "custom",
    });
  });

  it("buildEntry omits explorerUrl when the field is empty", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    expect(result.current.buildEntry().explorerUrl).toBeUndefined();
  });

  it("preserves an explicit scheme on the explorer URL", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    act(() => result.current.setExplorer("http://local.scan/"));
    expect(result.current.buildEntry().explorerUrl).toBe("http://local.scan");
  });

  it("falls back to the name for short when symbol is name-derived", () => {
    const { result } = renderHook(() => useAddChainForm());
    fillValid(result);
    act(() => result.current.setSymbol("verylongsymbol"));
    expect(result.current.buildEntry().short).toBe("VERYL"); // slice(0,5)
  });

  it("previews the glyph char from symbol, then name, then N", () => {
    const { result } = renderHook(() => useAddChainForm());
    expect(result.current.glyphChar).toBe("N");
    act(() => result.current.setName("optimism"));
    expect(result.current.glyphChar).toBe("O");
    act(() => result.current.setSymbol("eth"));
    expect(result.current.glyphChar).toBe("E");
  });
});
