"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
export type MockWallet = { connected: boolean; address: string };
type AppShellState = {
  currentChainId: number;
  setCurrentChainId: (id: number) => void;
  wallet: MockWallet;
  toggleWallet: () => void;
};
const Ctx = createContext<AppShellState | null>(null);
export function AppShellProvider({ children }: { children: ReactNode }) {
  const [currentChainId, setCurrentChainId] = useState(1);
  const [wallet, setWallet] = useState<MockWallet>({
    connected: false,
    address: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6Bc44",
  });
  const value = useMemo<AppShellState>(
    () => ({
      currentChainId,
      setCurrentChainId,
      wallet,
      toggleWallet: () => setWallet((w) => ({ ...w, connected: !w.connected })),
    }),
    [currentChainId, wallet],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAppShell(): AppShellState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useAppShell must be used within <AppShellProvider>");
  return ctx;
}
