"use client";

import { useRef, useState } from "react";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { viemRpc } from "@/app/web3/services";
import { record } from "@/entities/history/model/store";
import type { THistoryEntry } from "@/entities/history/model/types";
import { getEffectiveAbi } from "./effectiveAbi";

export type SendState =
  | { status: "idle" }
  | { status: "wallet" } // awaiting signature in wallet
  | { status: "pending"; hash: `0x${string}` }
  | { status: "confirmed"; hash: `0x${string}`; blockNumber: bigint }
  | { status: "failed"; error: string; hash?: `0x${string}` };

export type UseSendOperationResult = {
  state: SendState;
  send: (p: {
    args: readonly unknown[];
    value?: bigint;
    gas?: bigint;
    rawArgs: Record<string, string>;
  }) => Promise<void>;
};

type Deps = {
  rpc: RpcProvider;
  addHistory: (e: Omit<THistoryEntry, "id" | "timestamp">) => void;
};

const defaultDeps: Deps = { rpc: viemRpc, addHistory: record };

export function useSendOperation(
  contract: TContract,
  fn: AbiFunction,
  deps: Deps = defaultDeps,
): UseSendOperationResult {
  const [state, setState] = useState<SendState>({ status: "idle" });
  // Re-entrancy guard. A ref, not `state`, because the state value captured in
  // this closure can be stale across overlapping send() calls.
  const inFlight = useRef(false);
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  async function send(p: {
    args: readonly unknown[];
    value?: bigint;
    gas?: bigint;
    rawArgs: Record<string, string>;
  }): Promise<void> {
    // Ignore overlapping sends while one is awaiting the wallet or pending.
    if (inFlight.current) return;

    // Defensive: UI should prevent sending without a wallet (no history recorded).
    if (!isConnected || !address) {
      setState({ status: "failed", error: "connect a wallet to sign" });
      return;
    }

    inFlight.current = true;

    function recordError(error: string, txHash?: `0x${string}`): void {
      deps.addHistory({
        contractId: contract.id,
        chainId: contract.chainId,
        type: "write",
        fnName: fn.name,
        args: p.rawArgs,
        status: "error",
        error,
        txHash,
        from: address,
      });
    }

    try {
      // Ensure the wallet is on the contract's chain before signing.
      if (chainId !== contract.chainId) {
        try {
          await switchChainAsync({ chainId: contract.chainId });
        } catch {
          const msg = "network switch rejected";
          setState({ status: "failed", error: msg });
          recordError(msg);
          return;
        }
      }

      setState({ status: "wallet" });

      let hash: `0x${string}`;
      try {
        hash = await writeContractAsync({
          address: contract.address,
          abi: getEffectiveAbi(contract),
          functionName: fn.name,
          args: p.args,
          value: p.value,
          gas: p.gas,
          chainId: contract.chainId,
        });
      } catch (e) {
        const err = e as { shortMessage?: string; message?: string };
        const msg = err.shortMessage ?? err.message ?? "transaction failed";
        setState({ status: "failed", error: msg });
        recordError(msg);
        return;
      }

      setState({ status: "pending", hash });

      let receipt: { status: "success" | "reverted"; blockNumber: bigint };
      try {
        receipt = (await deps.rpc
          .getClient(contract.chainId)
          .waitForTransactionReceipt({ hash })) as {
          status: "success" | "reverted";
          blockNumber: bigint;
        };
      } catch (e) {
        const err = e as { shortMessage?: string; message?: string };
        const msg = err.shortMessage ?? err.message ?? "transaction failed";
        setState({ status: "failed", error: msg, hash });
        recordError(msg, hash);
        return;
      }

      if (receipt.status === "success") {
        setState({
          status: "confirmed",
          hash,
          blockNumber: receipt.blockNumber,
        });
        deps.addHistory({
          contractId: contract.id,
          chainId: contract.chainId,
          type: "write",
          fnName: fn.name,
          args: p.rawArgs,
          status: "ok",
          txHash: hash,
          result: `block ${receipt.blockNumber}`,
          from: address,
        });
      } else {
        const msg = "transaction reverted on-chain";
        setState({ status: "failed", error: msg, hash });
        recordError(msg, hash);
      }
    } finally {
      // Released at every terminal state so a subsequent send() can proceed.
      inFlight.current = false;
    }
  }

  return { state, send };
}
