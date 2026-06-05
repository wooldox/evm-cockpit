import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useChainCatalog,
  catalogDisplay,
  useChainDisplay,
  CHAINS_ENDPOINT,
} from "./catalogStore";
import { buildStaticCatalog } from "./catalog";

const REMOTE_ITEM = {
  name: "Zeta Chain",
  chain: "ZETA",
  chainId: 700700,
  rpc: ["https://zeta.example"],
  explorers: [{ url: "https://zetascan.example" }],
  nativeCurrency: { name: "Zeta", symbol: "ZET", decimals: 18 },
};

function resetStore() {
  const fresh = buildStaticCatalog();
  useChainCatalog.setState({
    entries: fresh,
    byId: new Map(fresh.map((c) => [c.id, c])),
    status: "static",
  });
}

describe("useChainCatalog", () => {
  beforeEach(resetStore);

  it("exposes the chainid.network endpoint constant", () => {
    expect(CHAINS_ENDPOINT).toBe("https://chainid.network/chains.json");
  });

  it("initializes to static with entries ready and a working byId", () => {
    const s = useChainCatalog.getState();
    expect(s.status).toBe("static");
    expect(s.entries.length).toBeGreaterThanOrEqual(600);
    expect(s.byId.get(1)?.short).toBe("ETH");
  });

  it("loadRemote success → extended + new id resolvable", async () => {
    const fetchJson = vi.fn(async () => [REMOTE_ITEM]);
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe("extended");
    expect(catalogDisplay(700700).name).toBe("Zeta Chain");
    expect(useChainCatalog.getState().byId.get(700700)?.source).toBe("remote");
  });

  it("loadRemote failure (fetchJson rejects) → static-fallback, entries unchanged", async () => {
    const before = useChainCatalog.getState().entries;
    const fetchJson = vi.fn(async () => {
      throw new Error("network");
    });
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe("static-fallback");
    expect(useChainCatalog.getState().entries).toBe(before);
  });

  it("loadRemote with a non-ok-style throw → static-fallback", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("HTTP 500");
    });
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe("static-fallback");
  });

  it("double loadRemote calls fetchJson once", async () => {
    const fetchJson = vi.fn(async () => [REMOTE_ITEM]);
    await useChainCatalog.getState().loadRemote({ fetchJson });
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("loadRemote with non-array json → extended with no remote additions", async () => {
    const fetchJson = vi.fn(async () => ({ not: "an array" }));
    const before = useChainCatalog.getState().entries.length;
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe("extended");
    expect(useChainCatalog.getState().entries.length).toBe(before);
  });

  it("catalogDisplay falls back to getChainDisplay for unknown ids", () => {
    const d = catalogDisplay(99887766);
    expect(d.name).toBe("Chain 99887766");
  });

  it("default fetch path: ok response → extended", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [REMOTE_ITEM],
    } as Response);
    await useChainCatalog.getState().loadRemote();
    expect(fetchSpy).toHaveBeenCalledWith(CHAINS_ENDPOINT, expect.any(Object));
    expect(useChainCatalog.getState().status).toBe("extended");
    expect(useChainCatalog.getState().byId.get(700700)?.name).toBe(
      "Zeta Chain",
    );
    fetchSpy.mockRestore();
  });

  it("default fetch path: non-ok response → static-fallback", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    await useChainCatalog.getState().loadRemote();
    expect(useChainCatalog.getState().status).toBe("static-fallback");
    fetchSpy.mockRestore();
  });
});

describe("useChainDisplay", () => {
  beforeEach(resetStore);

  it("returns the curated display for chain 1", () => {
    const { result } = renderHook(() => useChainDisplay(1));
    expect(result.current.short).toBe("ETH");
    expect(result.current.name).toBe("Ethereum");
  });

  it("returns the Chain <id> fallback for an unknown id", () => {
    const { result } = renderHook(() => useChainDisplay(424242));
    expect(result.current.name).toBe("Chain 424242");
    expect(result.current.short).toBe("424242");
  });
});
