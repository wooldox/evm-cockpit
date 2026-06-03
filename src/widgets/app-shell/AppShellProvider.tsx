"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TContract } from "@/entities/contract/model/types";

type AppShellState = {
  currentChainId: number;
  setCurrentChainId: (id: number) => void;
  addOpen: boolean;
  editing: TContract | null;
  openAdd: () => void;
  openEdit: (c: TContract) => void;
  closeAdd: () => void;
};

const Ctx = createContext<AppShellState | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [currentChainId, setCurrentChainId] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TContract | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((c: TContract) => {
    setEditing(c);
    setAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setEditing(null);
  }, []);

  const value = useMemo<AppShellState>(
    () => ({
      currentChainId,
      setCurrentChainId,
      addOpen,
      editing,
      openAdd,
      openEdit,
      closeAdd,
    }),
    [currentChainId, addOpen, editing, openAdd, openEdit, closeAdd],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppShell(): AppShellState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useAppShell must be used within <AppShellProvider>");
  return ctx;
}
