"use client";

import { useQuery } from "@tanstack/react-query";
import { BaseError, ChainDoesNotSupportContract } from "viem";
import type { AbiFunction } from "abitype";
import type { PublicClient } from "viem";
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

type MulticallItem =
  | { status: "success"; result: unknown }
  | { status: "failure"; error: unknown };

/** Map a single multicall result item to a PropertyRow. */
function toRow(fn: AbiFunction, item: MulticallItem): PropertyRow {
  if (item.status === "success") {
    return { fn, status: "ok", value: item.result };
  }
  return {
    fn,
    status: "error",
    error: (item.error as Error)?.message ?? "call failed",
  };
}

/** True when the error chain contains viem's ChainDoesNotSupportContract
 *  (raised when a chain has no Multicall3 deployed/configured). */
function isMissingMulticall(err: unknown): boolean {
  if (err instanceof BaseError) {
    return !!err.walk((e) => e instanceof ChainDoesNotSupportContract);
  }
  if (err instanceof Error) {
    return /does not support contract/i.test(err.message);
  }
  return false;
}

/** Multicall fallback: read each property individually via readContract,
 *  preserving row order. One failing read becomes that row's error. */
async function readEachProperty(
  client: PublicClient,
  address: `0x${string}`,
  abi: ReturnType<typeof getEffectiveAbi>,
  sections: ReturnType<typeof getBrowserSections>,
): Promise<PropertyRow[]> {
  const settled = await Promise.allSettled(
    sections.properties.map((fn) =>
      client.readContract({ address, abi, functionName: fn.name }),
    ),
  );
  return sections.properties.map((fn, i): PropertyRow => {
    const r = settled[i]!;
    if (r.status === "fulfilled") {
      return { fn, status: "ok", value: r.value };
    }
    return {
      fn,
      status: "error",
      error: (r.reason as Error)?.message ?? "call failed",
    };
  });
}

export function useProperties(
  contract: TContract,
  deps: Deps = defaultDeps,
): UsePropertiesResult {
  const sections = getBrowserSections(contract);

  const query = useQuery({
    queryKey: [
      "properties",
      contract.id,
      contract.chainId,
      contract.proxy?.implAddress ?? null,
    ],
    queryFn: async () => {
      const client = deps.rpc.getClient(contract.chainId);
      const abi = getEffectiveAbi(contract);

      // Type the contracts array loosely so multicall's strict generics don't
      // reject a dynamically-built list. Cast result items via `unknown` as well.
      const contracts: {
        address: `0x${string}`;
        abi: typeof abi;
        functionName: string;
      }[] = sections.properties.map((fn) => ({
        address: contract.address,
        abi,
        functionName: fn.name,
      }));

      let res: (
        | { status: "success"; result: unknown }
        | {
            status: "failure";
            error: unknown;
          }
      )[];

      try {
        res = (await client.multicall({
          contracts: contracts as Parameters<
            typeof client.multicall
          >[0]["contracts"],
          allowFailure: true,
        })) as typeof res;
      } catch (err) {
        // Chains without a deployed Multicall3 throw ChainDoesNotSupportContract.
        // Fall back to one readContract per property so reads still work.
        if (isMissingMulticall(err)) {
          return readEachProperty(client, contract.address, abi, sections);
        }
        throw err;
      }

      // res[i] is defined — res has the same length as contracts.
      return sections.properties.map(
        (fn, i): PropertyRow => toRow(fn, res[i]!),
      );
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
