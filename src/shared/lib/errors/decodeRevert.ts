import { decodeErrorResult, type Abi } from "viem";

/** Decode revert data into a human-readable string. Handles Error(string),
 *  Panic(uint256), and custom errors declared in the ABI. */
export function decodeRevert(abi: Abi, data: `0x${string}` | string): string {
  try {
    const decoded = decodeErrorResult({ abi, data: data as `0x${string}` });
    if (decoded.errorName === "Error") {
      return `reverted: ${JSON.stringify(decoded.args?.[0])}`;
    }
    if (decoded.errorName === "Panic") {
      return `panic(${decoded.args?.[0]})`;
    }
    const args =
      decoded.args && decoded.args.length > 0
        ? `(${decoded.args.map(String).join(", ")})`
        : "";
    return `${decoded.errorName}${args}`;
  } catch {
    return "execution reverted (could not decode reason)";
  }
}
