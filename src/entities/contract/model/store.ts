'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStateStorage } from '@/entities/_shared/idbStateStorage';
import type { TContract } from './types';

export type ContractsState = {
  contracts: TContract[];
  add: (c: TContract) => void;
  update: (id: string, patch: Partial<TContract>) => void;
  remove: (id: string) => void;
  /** Put one chain's contracts in `orderedIds` order. They keep the array
   *  slots they already occupy, so other chains' contracts don't move. */
  reorderChain: (chainId: number, orderedIds: string[]) => void;
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
      reorderChain: (chainId, orderedIds) =>
        set((s) => {
          const byId = new Map(s.contracts.map((c) => [c.id, c]));
          const queue = orderedIds
            .map((id) => byId.get(id))
            .filter((c): c is TContract => c?.chainId === chainId);
          if (
            queue.length !==
            s.contracts.filter((c) => c.chainId === chainId).length
          )
            return s; // ids don't match this chain's contracts — ignore
          return {
            contracts: s.contracts.map((c) =>
              c.chainId === chainId ? queue.shift()! : c,
            ),
          };
        }),
      getById: (id) => get().contracts.find((c) => c.id === id),
    }),
    {
      name: 'cc-contracts',
      storage: createJSONStorage(() => idbStateStorage('contracts')),
    },
  ),
);
