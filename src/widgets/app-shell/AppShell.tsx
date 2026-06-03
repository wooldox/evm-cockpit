"use client";
import type { ReactNode } from "react";
import { ToastProvider } from "@/shared/ui";
import { AppShellProvider } from "./AppShellProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppShellProvider>
      <ToastProvider>
        <div className="grid h-screen grid-cols-[264px_1fr] overflow-hidden bg-surface max-[860px]:grid-cols-1">
          <Sidebar />
          <div className="flex h-screen min-w-0 flex-col">
            <TopBar />
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AppShellProvider>
  );
}
