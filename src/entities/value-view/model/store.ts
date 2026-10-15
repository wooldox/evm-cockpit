'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStateStorage } from '@/entities/_shared/idbStateStorage';
import type { TIntView } from '@/shared/lib/values/interpret';

/** Key for one value slot: `<contractId>|<fn or event signature>|<output/arg>`. */
export type TViewKey = string;

export type ValueViewState = {
  /** User-picked "view as" per value slot; absent → auto/raw. */
  views: Record<TViewKey, TIntView>;
  setView: (key: TViewKey, view: TIntView) => void;
  clearView: (key: TViewKey) => void;
};

export const useValueViewStore = create<ValueViewState>()(
  persist(
    (set) => ({
      views: {},
      setView: (key, view) =>
        set((s) => ({ views: { ...s.views, [key]: view } })),
      clearView: (key) =>
        set((s) => {
          const next = { ...s.views };
          delete next[key];
          return { views: next };
        }),
    }),
    {
      // Own key inside the existing "settings" object store — avoids an
      // IndexedDB schema/version bump for a new store.
      name: 'cc-value-views',
      storage: createJSONStorage(() => idbStateStorage('settings')),
    },
  ),
);
