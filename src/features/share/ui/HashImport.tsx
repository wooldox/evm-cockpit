'use client';

import { useEffect, useRef } from 'react';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TShareContract } from '@/shared/lib/share/codec';
import { useToast } from '@/shared/ui';
import { readImportHash } from '../model/importItems';

/**
 * Mounted inside the app shell's ToastProvider subtree. On mount — and on
 * every `hashchange` — reads `window.location.hash`; if it's a `#import=<token>` share link, clears
 * the hash first (so a reload/error never re-triggers), decodes it, and hands
 * the contracts to `onImport` — which shows a review step. Nothing is added
 * without the user confirming.
 *
 * `onImport` is called only once the contracts store has finished its async
 * IndexedDB rehydration, so the review step can tell which contracts are
 * already saved. Renders nothing.
 */
export function HashImport({
  onImport,
}: {
  onImport: (items: TShareContract[]) => void;
}) {
  const toast = useToast();
  const ran = useRef(false);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const handle = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#import=')) return;

      // Clear the hash BEFORE any async work (including waiting on hydration)
      // so errors/reloads can't re-trigger.
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );

      const run = () => {
        void readImportHash(hash).then((result) => {
          if (!result) return;
          if (result.ok) onImport(result.items);
          else
            toast({ kind: 'error', title: 'Import failed', msg: result.error });
        });
      };

      if (useContractsStore.persist.hasHydrated()) run();
      else unsubs.push(useContractsStore.persist.onFinishHydration(run));
    };

    // On load — guarded against React StrictMode's double-invoke of mount
    // effects (the hash is cleared on first read anyway).
    if (!ran.current) {
      ran.current = true;
      handle();
    }
    // A link pasted into a tab where the app is already open only changes the
    // hash (no reload), so listen for that too.
    window.addEventListener('hashchange', handle);
    return () => {
      window.removeEventListener('hashchange', handle);
      unsubs.forEach((u) => u());
    };
  }, [toast, onImport]);

  return null;
}
