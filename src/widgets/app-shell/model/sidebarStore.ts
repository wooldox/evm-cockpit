'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStateStorage } from '@/entities/_shared/idbStateStorage';

export type SidebarState = {
  /** Chain ids whose contract lists are collapsed. */
  collapsed: number[];
  /** True once persisted state has loaded (IndexedDB is async). */
  hydrated: boolean;
  toggleChain: (chainId: number) => void;
  setAll: (chainIds: number[], collapsed: boolean) => void;
  expandChain: (chainId: number) => void;
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: [],
      hydrated: false,
      toggleChain: (id) =>
        set((s) => ({
          collapsed: s.collapsed.includes(id)
            ? s.collapsed.filter((c) => c !== id)
            : [...s.collapsed, id],
        })),
      setAll: (ids, collapsed) =>
        set((s) => ({
          collapsed: collapsed
            ? [...new Set([...s.collapsed, ...ids])]
            : s.collapsed.filter((c) => !ids.includes(c)),
        })),
      expandChain: (id) =>
        set((s) =>
          s.collapsed.includes(id)
            ? { collapsed: s.collapsed.filter((c) => c !== id) }
            : s,
        ),
    }),
    {
      // Own key inside the existing "settings" object store (no IDB schema bump).
      name: 'cc-sidebar',
      storage: createJSONStorage(() => idbStateStorage('settings')),
      partialize: (s) => ({ collapsed: s.collapsed }),
      onRehydrateStorage: () => () => {
        useSidebarStore.setState({ hydrated: true });
      },
    },
  ),
);
