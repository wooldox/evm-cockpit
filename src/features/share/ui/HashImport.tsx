'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useContractsStore } from '@/entities/contract/model/store';
import { Mono, useToast } from '@/shared/ui';
import { importFromHash } from '../model/importFromHash';

/**
 * Mounted inside the app shell's ToastProvider subtree. On mount (one-shot),
 * reads `window.location.hash`; if it's a `#import=<token>` share link, clears
 * the hash first (so a reload/error never re-triggers), then imports the
 * contract — toasting the outcome and navigating to the imported contract on
 * success.
 *
 * The actual import is gated on the contracts store finishing its async
 * IndexedDB rehydration: on a cold load the in-memory `contracts` snapshot is
 * `[]` until persist hydrates, so importing too early would miss an existing
 * contract and add a duplicate. The hash is still read+cleared synchronously up
 * front so reloads never re-trigger, regardless of hydration timing. Renders
 * nothing.
 */
export function HashImport() {
  const toast = useToast();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode's double-invoke of mount effects.
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash;
    if (!hash.startsWith('#import=')) return;

    // Clear the hash BEFORE any async work (including waiting on hydration) so
    // errors/reloads can't re-trigger.
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );

    const runImport = () => {
      void (async () => {
        const result = await importFromHash(hash, {
          getContracts: () => useContractsStore.getState().contracts,
          addContract: useContractsStore.getState().add,
        });
        if (!result) return;
        if (result.ok) {
          toast({
            kind: 'success',
            title: result.deduped
              ? 'Already saved — opening'
              : 'Contract imported',
            msg: <Mono>{result.contract.name}</Mono>,
          });
          router.push(`/?c=${result.contract.id}`);
        } else {
          toast({ kind: 'error', title: 'Import failed', msg: result.error });
        }
      })();
    };

    // Only import once the persisted store has rehydrated from IndexedDB, so
    // dedupe sees existing contracts. If already hydrated, run immediately;
    // otherwise wait for hydration to finish (cleaning up the subscription).
    if (useContractsStore.persist.hasHydrated()) {
      runImport();
      return;
    }
    const unsub = useContractsStore.persist.onFinishHydration(runImport);
    return unsub;
  }, [toast, router]);

  return null;
}
