"use client";

import { useQuery } from "@tanstack/react-query";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { viemRpc } from "@/app/web3/services";
import { getEffectiveAbi, getBrowserSections } from "./effectiveAbi";

export type PropertyRow =
  | { fn: AbiFunction; status: "ok"; value: unknown }
  | { fn: AbiFunction; status: "error"; error: string };

export type UsePropertiesResult = {
  rows: PropertyRow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
};

type Deps = {
  rpc: RpcProvider;
};

const defaultDeps: Deps = { rpc: viemRpc };

export function useProperties(
  contract: TContract,
  deps: Deps = defaultDeps,
): UsePropertiesResult {
  const sections = getBrowserSections(contract);

  const query = useQuery({
    queryKey: ["properties", contract.id, contract.chainId],
    queryFn: async () => {
      const client = deps.rpc.getClient(contract.chainId);
      const abi = getEffectiveAbi(contract);

      // Type the contracts array loosely so multicall's strict generics don't
      // reject a dynamically-built list. Cast result items via `unknown` as well.
      const contracts: { address: `0x${string}`; abi: typeof abi; functionName: string }[] =
        sections.properties.map((fn) => ({
          address: contract.address,
          abi,
          functionName: fn.name,
        }));

      const res = await client.multicall({
        contracts: contracts as Parameters<typeof client.multicall>[0]["contracts"],
        allowFailure: true,
      });

      return sections.properties.map((fn, i): PropertyRow => {
        // res[i] is defined because res has same length as contracts
        const r = (res as { status: "success"; result: unknown }[] | { status: "failure"; error: unknown }[])[i] as
          | { status: "success"; result: unknown }
          | { status: "failure"; error: unknown };

        if (r.status === "success") {
          return { fn, status: "ok", value: (r as { status: "success"; result: unknown }).result };
        }
        return {
          fn,
          status: "error",
          error: ((r as { status: "failure"; error: unknown }).error as Error)?.message ?? "call failed",
        };
      });
    },
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
