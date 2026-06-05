"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { idbStateStorage } from "@/entities/_shared/idbStateStorage";
import {
  buildStaticCatalog,
  composeCatalog,
  mergeCatalog,
  type TCatalogChain,
} from "./catalog";
import { getChainDisplay, type TChainDisplay } from "./chains";

/** Community chain registry — sourced from chainid.network. */
export const CHAINS_ENDPOINT = "https://chainid.network/chains.json";

const FETCH_TIMEOUT_MS = 10_000;

type CatalogState = {
  /** viem static catalog, possibly extended by the remote registry. */
  base: TCatalogChain[];
  /** User-added chains (the ONLY persisted field — see partialize). */
  custom: TCatalogChain[];
  /** Derived: composeCatalog(base, custom). Never set directly. */
  entries: TCatalogChain[];
  byId: Map<number, TCatalogChain>;
  status: "static" | "loading" | "extended" | "static-fallback";
  /** Fetch + merge the remote registry. One-shot: returns early once loading
   *  has started or completed successfully. On ANY failure the catalog stays
   *  static (status "static-fallback", entries untouched). */
  loadRemote: (deps?: {
    fetchJson?: (url: string) => Promise<unknown>;
  }) => Promise<void>;
  /** Add a user-defined chain. No-ops when the id is already known (the form
   *  validates first; this is defense in depth). */
  addCustomChain: (entry: TCatalogChain) => void;
};

/** Default JSON fetch: AbortController timeout + res.ok check. */
async function defaultFetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function indexById(entries: TCatalogChain[]): Map<number, TCatalogChain> {
  return new Map(entries.map((c) => [c.id, c]));
}

/** Recompute the derived entries/byId for a base+custom pair. */
function derive(
  base: TCatalogChain[],
  custom: TCatalogChain[],
): Pick<CatalogState, "base" | "custom" | "entries" | "byId"> {
  const entries = composeCatalog(base, custom);
  return { base, custom, entries, byId: indexById(entries) };
}

export const useChainCatalog = create<CatalogState>()(
  persist(
    (set, get) => {
      const initial = buildStaticCatalog();
      return {
        ...derive(initial, []),
        status: "static",
        loadRemote: async (deps) => {
          const status = get().status;
          if (status === "loading" || status === "extended") return;
          set({ status: "loading" });

          const fetchJson = deps?.fetchJson ?? defaultFetchJson;
          try {
            const data = await fetchJson(CHAINS_ENDPOINT);
            const merged = mergeCatalog(
              buildStaticCatalog(),
              Array.isArray(data) ? data : [],
            );
            set({ ...derive(merged, get().custom), status: "extended" });
          } catch {
            set({ status: "static-fallback" });
          }
        },
        addCustomChain: (entry) => {
          const s = get();
          if (s.byId.has(entry.id)) return;
          set(derive(s.base, [...s.custom, entry]));
        },
      };
    },
    {
      name: "cc-chains",
      storage: createJSONStorage(() => idbStateStorage("customChains")),
      // Hydration is triggered explicitly by CatalogLoader (persist.rehydrate)
      // rather than on import: this store is imported very widely (viem-rpc,
      // explorer, displays, selectors, top bar) including by suites and SSR
      // contexts where IndexedDB is absent — auto-rehydrate-on-import would
      // raise an unhandled "indexedDB is not defined" rejection there.
      skipHydration: true,
      partialize: (s) => ({ custom: s.custom }),
      // Rehydration only delivers `custom` — recompute the derived fields
      // against whatever base is current (static now; loadRemote re-derives).
      merge: (persisted, current) => {
        const p = persisted as { custom?: TCatalogChain[] } | undefined;
        const custom = p?.custom ?? [];
        return { ...current, ...derive(current.base, custom) };
      },
    },
  ),
);

/** Non-reactive lookup: catalog → getChainDisplay fallback. */
export function catalogDisplay(id: number): TChainDisplay {
  const c = useChainCatalog.getState().byId.get(id);
  if (!c) return getChainDisplay(id);
  return { id: c.id, name: c.name, short: c.short, color: c.color };
}

/** Reactive version — re-renders when the catalog gains the chain. */
export function useChainDisplay(id: number): TChainDisplay {
  return useChainCatalog(
    useShallow((s): TChainDisplay => {
      const c = s.byId.get(id);
      if (!c) return getChainDisplay(id);
      return { id: c.id, name: c.name, short: c.short, color: c.color };
    }),
  );
}
