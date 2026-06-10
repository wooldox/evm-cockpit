'use client';

import { useRef, useState } from 'react';
import type { AbiEvent } from 'abitype';
import type { TContract } from '@/entities/contract/model/types';
import type { RpcProvider } from '@/shared/ports/rpc';
import { viemRpc } from '@/app/web3/services';
import { fetchEventLogs, type TEventLogsResult } from './fetchEventLogs';

export type EventLogsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: TEventLogsResult }
  | { status: 'error'; error: string };

export type DefaultRange = { from: string; to: string };

export type UseEventLogsResult = {
  state: EventLogsState;
  defaultRange: DefaultRange | null;
  /**
   * Resolve the default look-back window (latest − 9999) and store it in
   * `defaultRange`. Also returns the resolved range so a caller can use it
   * synchronously within the same handler (state updates aren't visible to the
   * running closure); returns null when the block-number lookup failed.
   */
  loadDefaultRange: () => Promise<DefaultRange | null>;
  fetchLogs: (event: AbiEvent, fromRaw: string, toRaw: string) => Promise<void>;
  reset: () => void;
};

type Deps = { rpc: RpcProvider };

const defaultDeps: Deps = { rpc: viemRpc };

/** Default look-back window (most recent 10k blocks) when none is given. */
const DEFAULT_LOOKBACK = 9999n;

export function useEventLogs(
  contract: TContract,
  deps: Deps = defaultDeps,
): UseEventLogsResult {
  const [state, setState] = useState<EventLogsState>({ status: 'idle' });
  const [defaultRange, setDefaultRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  // Monotonic call-id: incremented on every fetchLogs() and reset() so an
  // in-flight fetch that resolves after a newer fetchLogs()/reset() bails.
  const callId = useRef(0);

  function reset(): void {
    callId.current += 1;
    // defaultRange is range metadata (not result state) — keep it.
    setState({ status: 'idle' });
  }

  async function loadDefaultRange(): Promise<DefaultRange | null> {
    // Snapshot (don't bump): loading a range shouldn't invalidate an in-flight
    // fetch, but a late resolution must not clobber a concurrent fetch's state.
    const mySnapshot = callId.current;
    try {
      const client = deps.rpc.getClient(contract.chainId);
      const latest = await client.getBlockNumber();
      // A newer fetchLogs()/reset() ran during the await — bail without setState.
      if (callId.current !== mySnapshot) return null;
      const from = latest > DEFAULT_LOOKBACK ? latest - DEFAULT_LOOKBACK : 0n;
      const range: DefaultRange = { from: from.toString(), to: 'latest' };
      setDefaultRange(range);
      return range;
    } catch (e) {
      // Late failure must not clobber a concurrent fetch's state; if still fresh
      // keep current behavior and surface the error.
      if (callId.current !== mySnapshot) return null;
      const err = e as { shortMessage?: string; message?: string };
      const message =
        err.shortMessage ?? err.message ?? 'failed to load block range';
      setState({ status: 'error', error: message });
      return null;
    }
  }

  async function fetchLogs(
    event: AbiEvent,
    fromRaw: string,
    toRaw: string,
  ): Promise<void> {
    // Claim a fresh call-id; any earlier in-flight fetch is now stale.
    callId.current += 1;
    const myCallId = callId.current;

    const fromTrimmed = fromRaw.trim();
    const toTrimmed = toRaw.trim();

    // Only plain decimal block numbers — reject hex/negative/exotic forms that
    // BigInt() would otherwise accept (e.g. "0x1f", "-5").
    if (!/^\d+$/.test(fromTrimmed)) {
      setState({ status: 'error', error: 'invalid from block' });
      return;
    }

    let fromBlock: bigint;
    try {
      fromBlock = BigInt(fromTrimmed);
    } catch {
      setState({ status: 'error', error: 'invalid from block' });
      return;
    }

    setState({ status: 'loading' });

    try {
      const client = deps.rpc.getClient(contract.chainId);

      let toBlock: bigint;
      if (toTrimmed === '' || toTrimmed.toLowerCase() === 'latest') {
        toBlock = await client.getBlockNumber();
      } else if (!/^\d+$/.test(toTrimmed)) {
        if (callId.current !== myCallId) return;
        setState({ status: 'error', error: 'invalid to block' });
        return;
      } else {
        try {
          toBlock = BigInt(toTrimmed);
        } catch {
          if (callId.current !== myCallId) return;
          setState({ status: 'error', error: 'invalid to block' });
          return;
        }
      }

      const result = await fetchEventLogs(
        { rpc: deps.rpc },
        { contract, event, fromBlock, toBlock },
      );

      // Staleness guard: a newer fetchLogs()/reset() ran during the await.
      if (callId.current !== myCallId) return;
      setState({ status: 'done', result });
    } catch (e) {
      if (callId.current !== myCallId) return;
      const err = e as { shortMessage?: string; message?: string };
      const message = err.shortMessage ?? err.message ?? 'failed to load logs';
      setState({ status: 'error', error: message });
    }
  }

  return { state, defaultRange, loadDefaultRange, fetchLogs, reset };
}
