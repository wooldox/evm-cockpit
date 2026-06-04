import { BaseError, ContractFunctionRevertedError, type Abi } from "viem";
import { decodeRevert } from "./decodeRevert";

export type WriteErrorKind = "revert" | "rpc";
export type ClassifiedWriteError = { kind: WriteErrorKind; message: string };

/**
 * Classify a thrown error from a write simulation/estimation into either a
 * contract revert (decoded against the ABI) or a generic RPC/transport failure.
 */
export function classifyWriteError(
  abi: Abi,
  error: unknown,
): ClassifiedWriteError {
  if (error instanceof BaseError) {
    const revertErr = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (revertErr instanceof ContractFunctionRevertedError) {
      const message = revertErr.raw
        ? decodeRevert(abi, revertErr.raw)
        : (revertErr.reason ?? revertErr.shortMessage);
      return { kind: "revert", message };
    }
    return { kind: "rpc", message: error.shortMessage ?? error.message };
  }
  return {
    kind: "rpc",
    message: error instanceof Error ? error.message : String(error),
  };
}
