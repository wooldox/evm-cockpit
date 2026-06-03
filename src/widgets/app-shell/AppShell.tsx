"use client";
import type { ReactNode } from "react";
import { ToastProvider } from "@/shared/ui";
import { Web3Providers } from "@/app/web3/Web3Providers";
import { AddContractModal } from "@/features/add-contract/ui/AddContractModal";
import { AppShellProvider, useAppShell } from "./AppShellProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Rendered inside AppShellProvider — safe to call useAppShell(). */
function ShellModals() {
  const { addOpen, editing, closeAdd } = useAppShell();
  if (!addOpen) return null;
  return <AddContractModal editing={editing} onClose={closeAdd} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Web3Providers>
      <AppShellProvider>
        <ToastProvider>
          <div className="grid h-screen grid-cols-[264px_1fr] overflow-hidden bg-surface max-[860px]:grid-cols-1">
            <Sidebar />
            <div className="flex h-screen min-w-0 flex-col">
              <TopBar />
              <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
          <ShellModals />
        </ToastProvider>
      </AppShellProvider>
    </Web3Providers>
  );
}
