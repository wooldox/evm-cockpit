import { describe, it, expect } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  encodeErrorResult,
} from "viem";
import { classifyWriteError } from "./classifyWriteError";
import { erc20Abi } from "@/shared/lib/abi/fixtures";

function makeRevertedError(
  data: `0x${string}` | undefined,
  reason?: string,
): ContractFunctionRevertedError {
  return new ContractFunctionRevertedError({
    abi: erc20Abi,
    data,
    functionName: "transfer",
    message: reason,
  });
}

describe("classifyWriteError", () => {
  it("classifies a revert with Error(string) raw data, decoding the reason", () => {
    const data = encodeErrorResult({
      abi: [{ type: "error", name: "Error", inputs: [{ type: "string" }] }],
      errorName: "Error",
      args: ["nope"],
    });
    const result = classifyWriteError(erc20Abi, makeRevertedError(data));
    expect(result.kind).toBe("revert");
    expect(result.message).toBe('reverted: "nope"');
  });

  it("classifies a revert with a custom error from the ABI", () => {
    const data = encodeErrorResult({
      abi: erc20Abi,
      errorName: "InsufficientBalance",
      args: [1n, 2n],
    });
    const result = classifyWriteError(erc20Abi, makeRevertedError(data));
    expect(result.kind).toBe("revert");
    expect(result.message).toContain("InsufficientBalance");
  });

  it("classifies a revert with a Panic code", () => {
    const data = encodeErrorResult({
      abi: [{ type: "error", name: "Panic", inputs: [{ type: "uint256" }] }],
      errorName: "Panic",
      args: [17n],
    });
    const result = classifyWriteError(erc20Abi, makeRevertedError(data));
    expect(result.kind).toBe("revert");
    expect(result.message).toBe("panic(17)");
  });

  it("walks a wrapping BaseError to find the nested reverted error", () => {
    const data = encodeErrorResult({
      abi: erc20Abi,
      errorName: "InsufficientBalance",
      args: [1n, 2n],
    });
    const wrapped = new BaseError("wrapper", {
      cause: makeRevertedError(data),
    });
    const result = classifyWriteError(erc20Abi, wrapped);
    expect(result.kind).toBe("revert");
    expect(result.message).toContain("InsufficientBalance");
  });

  it("uses reason when a revert has no raw data", () => {
    const result = classifyWriteError(
      erc20Abi,
      makeRevertedError(undefined, "custom reason"),
    );
    expect(result.kind).toBe("revert");
    expect(result.message).toBe("custom reason");
  });

  it("falls back to shortMessage for a revert with neither raw data nor reason", () => {
    const err = makeRevertedError(undefined);
    // Force both raw and reason to be absent to exercise the shortMessage path.
    Object.assign(err, { raw: undefined, reason: undefined });
    const result = classifyWriteError(erc20Abi, err);
    expect(result.kind).toBe("revert");
    expect(result.message).toBe(err.shortMessage);
  });

  it("falls back to message for a non-revert BaseError without a shortMessage", () => {
    const err = new BaseError("ignored");
    // Simulate a BaseError whose shortMessage is absent, exercising the
    // `error.shortMessage ?? error.message` fallback.
    Object.assign(err, { shortMessage: undefined });
    const result = classifyWriteError(erc20Abi, err);
    expect(result.kind).toBe("rpc");
    expect(result.message).toBe(err.message);
  });

  it("classifies an HttpRequestError as rpc with its shortMessage", () => {
    const err = new HttpRequestError({
      url: "https://example.com",
      status: 500,
    });
    const result = classifyWriteError(erc20Abi, err);
    expect(result.kind).toBe("rpc");
    expect(result.message).toBe(err.shortMessage);
  });

  it("classifies a plain Error as rpc with its message", () => {
    const result = classifyWriteError(erc20Abi, new Error("boom"));
    expect(result.kind).toBe("rpc");
    expect(result.message).toBe("boom");
  });

  it("classifies a non-Error throw as rpc using String()", () => {
    const result = classifyWriteError(erc20Abi, "just a string");
    expect(result.kind).toBe("rpc");
    expect(result.message).toBe("just a string");
  });
});
