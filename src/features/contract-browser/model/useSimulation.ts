"use client";

import { useRef, useState } from "react";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { viemRpc } from "@/app/web3/services";
import { paramSchema } from "@/shared/lib/values/paramSchema";
import { toBaseUnits, type EthUnit } from "@/shared/lib/units/units";
import { record } from "@/entities/history/model/store";
import type { THistoryEntry } from "@/entities/history/model/types";
import { simulateOperation, type TSimResult } from "./simulateOperation";

export type SimulationState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "done";
      result: TSimResult;
      // Parsed values are co-located with the result so consumers can only
      // read args that match the sim they are currently seeing. This prevents
      // a stale parsedArgs/parsedValue from desyncing from the displayed sim.
      parsedArgs: readonly unknown[];
      parsedValue: bigint | undefined;
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
  addHistory: (e: Omit<THistoryEntry, "id" | "timestamp">) => void;
};

const defaultDeps: Deps = { rpc: viemRpc, addHistory: record };

export function useSimulation(
  contract: TContract,
  fn: AbiFunction,
  deps: Deps = defaultDeps,
): UseSimulationResult {
  const [state, setState] = useState<SimulationState>({ status: "idle" });
  const [argErrors, setArgErrors] = useState<Record<string, string>>({});
  const [valueError, setValueError] = useState<string | undefined>(undefined);
  // Monotonic call-id: incremented on every simulate() and reset() so an
  // in-flight simulate that resolves after a newer simulate()/reset() bails.
  const callId = useRef(0);

  function reset(): void {
    callId.current += 1;
    setState({ status: "idle" });
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

    // Validate each input
    const nextArgErrors: Record<string, string> = {};
    const args: unknown[] = [];
    for (let i = 0; i < fn.inputs.length; i++) {
      const input = fn.inputs[i]!;
      const key = input.name ?? String(i);
      const raw = rawArgs[key] ?? "";
      const parsed = paramSchema(input.type).safeParse(raw);
      if (!parsed.success) {
        nextArgErrors[key] = parsed.error.issues[0]?.message ?? "invalid value";
      } else {
        args.push(parsed.data);
      }
    }

    // Validate payable value
    let value: bigint | undefined;
    let nextValueError: string | undefined;
    if (rawValue) {
      const amount = rawValue.amount.trim();
      if (amount !== "" && amount !== "0") {
        try {
          value = toBaseUnits(amount, rawValue.unit);
        } catch (e) {
          nextValueError = e instanceof Error ? e.message : String(e);
        }
      }
    }

    if (Object.keys(nextArgErrors).length > 0 || nextValueError !== undefined) {
      setArgErrors(nextArgErrors);
      setValueError(nextValueError);
      setState({ status: "idle" });
      return;
    }

    setArgErrors({});
    setValueError(undefined);
    setState({ status: "loading" });

    const result = await simulateOperation(
      { rpc: deps.rpc },
      { contract, fn, args, value, account },
    );

    // Staleness guard: if a newer simulate() or reset() happened during the
    // await, this resolution is stale — do not touch state or record history.
    if (callId.current !== myCallId) return;

    setState({ status: "done", result, parsedArgs: args, parsedValue: value });

    deps.addHistory({
      contractId: contract.id,
      chainId: contract.chainId,
      type: "simulate",
      fnName: fn.name,
      args: rawArgs,
      status: result.ok ? "ok" : "error",
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
