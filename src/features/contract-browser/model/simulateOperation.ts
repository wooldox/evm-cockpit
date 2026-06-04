import { encodeFunctionData, type Abi } from "viem";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { classifyWriteError } from "@/shared/lib/errors/classifyWriteError";
import { getEffectiveAbi } from "./effectiveAbi";

export type TSimOk = {
  ok: true;
  gas: bigint;
  data: `0x${string}`;
  fees?: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };
  nonce?: number;
};
export type TSimFail = { ok: false; kind: "revert" | "rpc"; message: string };
export type TSimResult = TSimOk | TSimFail;

/**
 * Simulate a write operation: encode calldata, run simulateContract +
 * estimateContractGas (failures are classified), then best-effort fees & nonce.
 */
export async function simulateOperation(
  deps: { rpc: RpcProvider },
  params: {
    contract: TContract;
    fn: AbiFunction;
    args: readonly unknown[];
    value?: bigint;
    account?: `0x${string}`;
  },
): Promise<TSimResult> {
  const { contract, fn, args, value, account } = params;
  const abi: Abi = getEffectiveAbi(contract);
  const client = deps.rpc.getClient(contract.chainId);

  // Encode calldata up front; encoding failures are an rpc-kind classification.
  let data: `0x${string}`;
  try {
    data = encodeFunctionData({ abi, functionName: fn.name, args });
  } catch (e) {
    return {
      ok: false,
      kind: "rpc",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  // Core: simulate + estimate gas. Either throwing is a hard failure.
  let gas: bigint;
  try {
    await client.simulateContract({
      address: contract.address,
      abi,
      functionName: fn.name,
      args,
      value,
      account,
    });
    gas = await client.estimateContractGas({
      address: contract.address,
      abi,
      functionName: fn.name,
      args,
      value,
      account,
    });
  } catch (e) {
    return { ok: false, ...classifyWriteError(abi, e) };
  }

  // Best-effort extras: each independently optional.
  let fees: TSimOk["fees"];
  try {
    // Typed loosely: on legacy chains these EIP-1559 fields may be absent at
    // runtime, so we guard before constructing the fees object.
    const f = (await client.estimateFeesPerGas()) as {
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    };
    if (f.maxFeePerGas !== undefined && f.maxPriorityFeePerGas !== undefined) {
      fees = {
        maxFeePerGas: f.maxFeePerGas,
        maxPriorityFeePerGas: f.maxPriorityFeePerGas,
      };
    }
  } catch {
    // legacy chain or transient failure — omit fees
  }

  let nonce: number | undefined;
  if (account) {
    try {
      nonce = await client.getTransactionCount({ address: account });
    } catch {
      // omit nonce on failure
    }
  }

  return { ok: true, gas, data, fees, nonce };
}
