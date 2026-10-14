'use client';
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TContract } from '@/entities/contract/model/types';

type AppShellState = {
  currentChainId: number;
  setCurrentChainId: (id: number) => void;
  addOpen: boolean;
  editing: TContract | null;
  /** Source contract when the add modal was opened via "Duplicate". */
  duplicating: TContract | null;
  openAdd: () => void;
  openEdit: (c: TContract) => void;
  openDuplicate: (c: TContract) => void;
  closeAdd: () => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

const Ctx = createContext<AppShellState | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [currentChainId, setCurrentChainIdState] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TContract | null>(null);
  const [duplicating, setDuplicating] = useState<TContract | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Hydration-safe: init as 1, then read localStorage on the client (matches useTheme pattern).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cc-chain');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed))
          startTransition(() => setCurrentChainIdState(parsed));
      }
    } catch {
      /* ignore — localStorage unavailable */
    }
  }, []);

  const setCurrentChainId = useCallback((id: number) => {
    setCurrentChainIdState(id);
    try {
      localStorage.setItem('cc-chain', String(id));
    } catch {
      /* ignore */
    }
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDuplicating(null);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((c: TContract) => {
    setEditing(c);
    setDuplicating(null);
    setAddOpen(true);
  }, []);

  const openDuplicate = useCallback((c: TContract) => {
    setEditing(null);
    setDuplicating(c);
    setAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setEditing(null);
    setDuplicating(null);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const value = useMemo<AppShellState>(
    () => ({
      currentChainId,
      setCurrentChainId,
      addOpen,
      editing,
      duplicating,
      openAdd,
      openEdit,
      openDuplicate,
      closeAdd,
      settingsOpen,
      openSettings,
      closeSettings,
    }),
    [
      currentChainId,
      setCurrentChainId,
      addOpen,
      editing,
      duplicating,
      openAdd,
      openEdit,
      openDuplicate,
      closeAdd,
      settingsOpen,
      openSettings,
      closeSettings,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppShell(): AppShellState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error('useAppShell must be used within <AppShellProvider>');
  return ctx;
}
