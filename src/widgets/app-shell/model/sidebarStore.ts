'use client';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStateStorage } from '@/entities/_shared/idbStateStorage';

export type SidebarState = {
  /** Chain ids whose contract lists are collapsed. */
  collapsed: number[];
  toggleChain: (chainId: number) => void;
  setAll: (chainIds: number[], collapsed: boolean) => void;
  expandChain: (chainId: number) => void;
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: [],
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
    },
  ),
);

/** True once the persisted sidebar state has loaded from IndexedDB (async).
 *  Read from persist's own status — writing a flag into the store would
 *  trigger a persist write, which fails during static prerender. */
export function useSidebarHydrated(): boolean {
  return useSyncExternalStore(
    useSidebarStore.persist.onFinishHydration,
    useSidebarStore.persist.hasHydrated,
    () => false,
  );
}
