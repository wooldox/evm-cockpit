'use client';

import { useEffect, useRef } from 'react';
import { useConnect } from 'wagmi';

/**
 * E2E-only: auto-connect the mock wallet on mount so the smoke test starts in a
 * connected state without driving the RainbowKit modal (which does not list a
 * mock connector). Rendered only behind the build-time `IS_E2E` constant in
 * Web3Providers, so it is dead-code-eliminated from a normal build.
 *
 * NOT redundant with configE2E's `features.defaultConnected: true`: that flag
 * only makes the connector RECONNECTABLE (it reconnects on reload if a prior
 * session is stored), but on a fresh page with no stored connection — which is
 * every e2e test, since `freshApp` wipes IndexedDB — wagmi does not connect on
 * its own. This effect performs the initial `connect()` once. Verified: removing
 * it leaves `useAccount` disconnected and the smoke/write-flow journeys fail
 * because the connected account never appears.
 *
 * A ref guard ensures connect runs exactly once (no setState here — the wagmi
 * store drives the UI).
 */
export function E2EAutoConnect() {
  const { connect, connectors } = useConnect();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const connector = connectors[0];
    if (!connector) return;
    ran.current = true;
    connect({ connector });
  }, [connect, connectors]);

  return null;
}
