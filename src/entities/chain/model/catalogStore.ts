"use client";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  buildStaticCatalog,
  mergeCatalog,
  type TCatalogChain,
} from "./catalog";
import { getChainDisplay, type TChainDisplay } from "./chains";

/** Community chain registry — sourced from chainid.network. */
export const CHAINS_ENDPOINT = "https://chainid.network/chains.json";

const FETCH_TIMEOUT_MS = 10_000;

type CatalogState = {
  entries: TCatalogChain[];
  byId: Map<number, TCatalogChain>;
  status: "static" | "loading" | "extended" | "static-fallback";
  /** Fetch + merge the remote registry. One-shot: returns early once loading
   *  has started or completed successfully. On ANY failure the catalog stays
   *  static (status "static-fallback", entries untouched). */
  loadRemote: (deps?: {
    fetchJson?: (url: string) => Promise<unknown>;
  }) => Promise<void>;
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

export const useChainCatalog = create<CatalogState>()((set, get) => {
  const initial = buildStaticCatalog();
  return {
    entries: initial,
    byId: indexById(initial),
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
        set({ entries: merged, byId: indexById(merged), status: "extended" });
      } catch {
        set({ status: "static-fallback" });
      }
    },
  };
});

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
