"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
type AppShellState = {
  currentChainId: number;
  setCurrentChainId: (id: number) => void;
};
const Ctx = createContext<AppShellState | null>(null);
export function AppShellProvider({ children }: { children: ReactNode }) {
  const [currentChainId, setCurrentChainId] = useState(1);
  const value = useMemo<AppShellState>(
    () => ({
      currentChainId,
      setCurrentChainId,
    }),
    [currentChainId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAppShell(): AppShellState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useAppShell must be used within <AppShellProvider>");
  return ctx;
}
