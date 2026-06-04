"use client";
import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@/shared/ui";
import { useSettingsStore } from "@/entities/settings/model/store";
import { Web3Providers } from "@/app/web3/Web3Providers";
import { AddContractModal } from "@/features/add-contract/ui/AddContractModal";
import { SettingsModal } from "@/features/settings/ui/SettingsModal";
import { HashImport } from "@/features/share/ui/HashImport";
import { AppShellProvider, useAppShell } from "./AppShellProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Rendered inside AppShellProvider — safe to call useAppShell(). */
function ShellModals() {
  const { addOpen, editing, closeAdd, settingsOpen, closeSettings } =
    useAppShell();
  return (
    <>
      {addOpen && <AddContractModal editing={editing} onClose={closeAdd} />}
      {settingsOpen && <SettingsModal onClose={closeSettings} />}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const density = useSettingsStore((s) => s.density);

  return (
    <Web3Providers>
      <AppShellProvider>
        <ToastProvider>
          <div
            data-density={density === "compact" ? "compact" : undefined}
            className="grid h-screen grid-cols-[264px_1fr] overflow-hidden bg-surface max-[860px]:grid-cols-1"
          >
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
            <div className="flex h-screen min-w-0 flex-col">
              <TopBar />
              <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
          <ShellModals />
          <HashImport />
        </ToastProvider>
      </AppShellProvider>
    </Web3Providers>
  );
}
