"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStateStorage } from "@/entities/_shared/idbStateStorage";
import type { THistoryEntry } from "./types";

export const MAX_ENTRIES = 300;

export type HistoryState = {
  entries: THistoryEntry[];
  add: (e: THistoryEntry) => void;
  clear: () => void;
  clearForContract: (contractId: string) => void;
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) =>
        set((s) => {
          const next = [e, ...s.entries];
          return {
            entries:
              next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next,
          };
        }),
      clear: () => set({ entries: [] }),
      clearForContract: (contractId) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.contractId !== contractId),
        })),
    }),
    {
      name: "cc-history",
      storage: createJSONStorage(() => idbStateStorage("history")),
    },
  ),
);

/** Fills id + timestamp, then records the entry. Injected as a dep by feature hooks. */
export function record(partial: Omit<THistoryEntry, "id" | "timestamp">): void {
  useHistoryStore.getState().add({
    ...partial,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
}
