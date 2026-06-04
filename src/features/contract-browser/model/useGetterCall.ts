"use client";

import { useState } from "react";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { viemRpc } from "@/app/web3/services";
import { paramSchema } from "@/shared/lib/values/paramSchema";
import { stringifyWithBigint } from "@/shared/lib/json/stringify";
import { record } from "@/entities/history/model/store";
import type { THistoryEntry } from "@/entities/history/model/types";
import { getEffectiveAbi } from "./effectiveAbi";

export type GetterStatus = "idle" | "loading" | "done" | "error";

export type UseGetterCallState = {
  status: GetterStatus;
  result?: unknown;
  error?: string;
  argErrors: Record<string, string>;
};

export type UseGetterCallResult = UseGetterCallState & {
  call: (rawArgs: Record<string, string>) => Promise<void>;
};

type Deps = {
  rpc: RpcProvider;
  addHistory: (e: Omit<THistoryEntry, "id" | "timestamp">) => void;
};

const defaultDeps: Deps = { rpc: viemRpc, addHistory: record };

export function useGetterCall(
  contract: TContract,
  fn: AbiFunction,
  deps: Deps = defaultDeps,
): UseGetterCallResult {
  const [state, setState] = useState<UseGetterCallState>({
    status: "idle",
    argErrors: {},
  });

  async function call(rawArgs: Record<string, string>): Promise<void> {
    // Validate each input
    const argErrors: Record<string, string> = {};
    const parsedArgs: unknown[] = [];

    for (let i = 0; i < fn.inputs.length; i++) {
      const input = fn.inputs[i]!;
      const key = input.name ?? String(i);
      const raw = rawArgs[key] ?? "";
      const result = paramSchema(input.type).safeParse(raw);
      if (!result.success) {
        argErrors[key] = result.error.issues[0]?.message ?? "invalid value";
      } else {
        parsedArgs.push(result.data);
      }
    }

    if (Object.keys(argErrors).length > 0) {
      setState((prev) => ({ ...prev, argErrors }));
      return;
    }

    setState({ status: "loading", argErrors: {} });

    try {
      const client = deps.rpc.getClient(contract.chainId);
      const abi = getEffectiveAbi(contract);

      const result = await client.readContract({
        address: contract.address,
        abi,
        functionName: fn.name,
        args: parsedArgs as readonly unknown[],
      });

      setState({ status: "done", result, argErrors: {} });
      deps.addHistory({
        contractId: contract.id,
        chainId: contract.chainId,
        type: "read",
        fnName: fn.name,
        args: rawArgs,
        status: "ok",
        result: stringifyWithBigint(result),
      });
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      const message = err.shortMessage ?? err.message ?? "call failed";
      setState({ status: "error", error: message, argErrors: {} });
      deps.addHistory({
        contractId: contract.id,
        chainId: contract.chainId,
        type: "read",
        fnName: fn.name,
        args: rawArgs,
        status: "error",
        error: message,
      });
    }
  }

  return { ...state, call };
}
