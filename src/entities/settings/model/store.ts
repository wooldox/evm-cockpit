'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStateStorage } from '@/entities/_shared/idbStateStorage';

export type Density = 'comfortable' | 'compact';

export type SettingsState = {
  rpcOverrides: Record<number, string>;
  etherscanApiKey: string;
  density: Density;
  setRpcOverride: (chainId: number, url: string) => void;
  clearRpcOverride: (chainId: number) => void;
  setEtherscanApiKey: (k: string) => void;
  setDensity: (d: Density) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      rpcOverrides: {},
      etherscanApiKey: '',
      density: 'comfortable',
      setRpcOverride: (chainId, url) =>
        set((s) => ({ rpcOverrides: { ...s.rpcOverrides, [chainId]: url } })),
      clearRpcOverride: (chainId) =>
        set((s) => {
          const next = { ...s.rpcOverrides };
          delete next[chainId];
          return { rpcOverrides: next };
        }),
      setEtherscanApiKey: (etherscanApiKey) => set({ etherscanApiKey }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'cc-settings',
      storage: createJSONStorage(() => idbStateStorage('settings')),
    },
  ),
);
