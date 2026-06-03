"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStateStorage } from "@/entities/_shared/idbStateStorage";
import type { TContract } from "./types";

export type ContractsState = {
  contracts: TContract[];
  add: (c: TContract) => void;
  update: (id: string, patch: Partial<TContract>) => void;
  remove: (id: string) => void;
  getById: (id: string) => TContract | undefined;
};

export const useContractsStore = create<ContractsState>()(
  persist(
    (set, get) => ({
      contracts: [],
      add: (c) => set((s) => ({ contracts: [...s.contracts, c] })),
      update: (id, patch) =>
        set((s) => ({
          contracts: s.contracts.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      remove: (id) =>
        set((s) => ({ contracts: s.contracts.filter((c) => c.id !== id) })),
      getById: (id) => get().contracts.find((c) => c.id === id),
    }),
    {
      name: "cc-contracts",
      storage: createJSONStorage(() => idbStateStorage("contracts")),
    },
  ),
);
