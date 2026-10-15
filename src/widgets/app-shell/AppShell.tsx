'use client';
import { Suspense, type ReactNode } from 'react';
import { ConfirmProvider, ToastProvider } from '@/shared/ui';
import { useSettingsStore } from '@/entities/settings/model/store';
import { Web3Providers } from '@/app/web3/Web3Providers';
import { AddContractModal } from '@/features/add-contract/ui/AddContractModal';
import { getEffectiveAbi } from '@/features/contract-browser/model/effectiveAbi';
import { SettingsModal } from '@/features/settings/ui/SettingsModal';
import { CatalogLoader } from '@/entities/chain/ui/CatalogLoader';
import { AppShellProvider, useAppShell } from './AppShellProvider';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ShellImport } from './ShellImport';

/** Rendered inside AppShellProvider — safe to call useAppShell(). */
function ShellModals() {
  const {
    addOpen,
    editing,
    duplicating,
    closeAdd,
    settingsOpen,
    closeSettings,
    currentChainId,
  } = useAppShell();
  return (
    <>
      {addOpen && (
        <AddContractModal
          editing={editing}
          // The merged (proxy + implementation) ABI, so a copy pointed at a
          // different address/chain still gets the full interface.
          prefill={
            duplicating
              ? { ...duplicating, abi: getEffectiveAbi(duplicating) }
              : undefined
          }
          defaultChainId={currentChainId}
          onClose={closeAdd}
        />
      )}
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
          <ConfirmProvider>
            <div
              data-density={density === 'compact' ? 'compact' : undefined}
              className="grid h-screen grid-cols-[264px_1fr] overflow-hidden bg-surface max-[860px]:grid-cols-1"
            >
              <Suspense fallback={null}>
                <Sidebar />
              </Suspense>
              <div className="flex h-screen min-w-0 flex-col">
                <TopBar />
                <main className="min-h-0 flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
            <ShellModals />
            <ShellImport />
            <CatalogLoader />
          </ConfirmProvider>
        </ToastProvider>
      </AppShellProvider>
    </Web3Providers>
  );
}
