'use client';

import { useRef, useState } from 'react';
import type { AbiFunction } from 'abitype';
import type { TContract } from '@/entities/contract/model/types';
import type { RpcProvider } from '@/shared/ports/rpc';
import { viemRpc } from '@/app/web3/services';
import { type EthUnit } from '@/shared/lib/units/units';
import { record } from '@/entities/history/model/store';
import type { THistoryEntry } from '@/entities/history/model/types';
import { parseOperationInputs } from './parseOperationInputs';
import { simulateOperation, type TSimResult } from './simulateOperation';

export type SimulationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'done';
      result: TSimResult;
      // Parsed values are co-located with the result so consumers can only
      // read args that match the sim they are currently seeing. This prevents
      // a stale parsedArgs/parsedValue from desyncing from the displayed sim.
      parsedArgs: readonly unknown[];
      parsedValue: bigint | undefined;
      // The connected account the sim ran with. The consumer compares this to
      // the live wallet address to invalidate the verdict if the account
      // changed after the sim — the prediction is signer-specific.
      account: `0x${string}` | undefined;
    };

export type UseSimulationResult = {
  state: SimulationState;
  argErrors: Record<string, string>;
  valueError?: string;
  /** account = connected wallet address, passed by the component from useAccount() */
  simulate: (
    rawArgs: Record<string, string>,
    rawValue?: { amount: string; unit: EthUnit },
    account?: `0x${string}`,
  ) => Promise<void>;
  reset: () => void; // component calls on any input change — invalidates stale sim
};

type Deps = {
  rpc: RpcProvider;
  addHistory: (e: Omit<THistoryEntry, 'id' | 'timestamp'>) => void;
};

const defaultDeps: Deps = { rpc: viemRpc, addHistory: record };

export function useSimulation(
  contract: TContract,
  fn: AbiFunction,
  deps: Deps = defaultDeps,
): UseSimulationResult {
  const [state, setState] = useState<SimulationState>({ status: 'idle' });
  const [argErrors, setArgErrors] = useState<Record<string, string>>({});
  const [valueError, setValueError] = useState<string | undefined>(undefined);
  // Monotonic call-id: incremented on every simulate() and reset() so an
  // in-flight simulate that resolves after a newer simulate()/reset() bails.
  const callId = useRef(0);

  function reset(): void {
    callId.current += 1;
    setState({ status: 'idle' });
    setArgErrors({});
    setValueError(undefined);
  }

  async function simulate(
    rawArgs: Record<string, string>,
    rawValue?: { amount: string; unit: EthUnit },
    account?: `0x${string}`,
  ): Promise<void> {
    // Claim a fresh call-id; any earlier in-flight simulate is now stale.
    callId.current += 1;
    const myCallId = callId.current;

    // Validate + coerce inputs via the shared pure helper (also used by the
    // Execute path) so a signed tx can never use args that differ from what
    // was validated/displayed here.
    const parsed = parseOperationInputs(fn, rawArgs, rawValue);
    if (!parsed.ok) {
      setArgErrors(parsed.argErrors);
      setValueError(parsed.valueError);
      setState({ status: 'idle' });
      return;
    }

    setArgErrors({});
    setValueError(undefined);
    setState({ status: 'loading' });

    const result = await simulateOperation(
      { rpc: deps.rpc },
      { contract, fn, args: parsed.args, value: parsed.value, account },
    );

    // Staleness guard: if a newer simulate() or reset() happened during the
    // await, this resolution is stale — do not touch state or record history.
    if (callId.current !== myCallId) return;

    setState({
      status: 'done',
      result,
      parsedArgs: parsed.args,
      parsedValue: parsed.value,
      account,
    });

    deps.addHistory({
      contractId: contract.id,
      chainId: contract.chainId,
      type: 'simulate',
      fnName: fn.name,
      args: rawArgs,
      status: result.ok ? 'ok' : 'error',
      result: result.ok ? `est. gas ${result.gas}` : undefined,
      error: !result.ok ? result.message : undefined,
      from: account,
    });
  }

  return {
    state,
    argErrors,
    valueError,
    simulate,
    reset,
  };
}
