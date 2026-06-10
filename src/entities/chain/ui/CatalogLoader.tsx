'use client';

import { useEffect, useRef } from 'react';
import { useChainCatalog } from '../model/catalogStore';

/**
 * Mounted once in the app shell. On mount (one-shot, StrictMode-safe via a
 * ran-guard ref) it (1) rehydrates persisted custom chains from IndexedDB —
 * the store uses `skipHydration` so this is the explicit trigger — and (2)
 * fires the remote chain-registry load fire-and-forget. The store's
 * `loadRemote` is itself idempotent, but the ref avoids a redundant second
 * call under React's double-invoke. Renders nothing; failures fall back
 * silently to the static catalog inside the store.
 */
export function CatalogLoader() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void useChainCatalog.persist.rehydrate();
    void useChainCatalog.getState().loadRemote();
  }, []);

  return null;
}
