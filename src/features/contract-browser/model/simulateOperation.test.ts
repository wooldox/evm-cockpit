import { describe, it, expect, vi } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  encodeErrorResult,
  encodeFunctionData,
} from "viem";
import type { PublicClient } from "viem";
import type { AbiFunction } from "abitype";
import { simulateOperation } from "./simulateOperation";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";

const ADDR = "0x1234567890123456789012345678901234567890" as const;
const ACCOUNT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

function makeContract(overrides?: Partial<TContract>): TContract {
  return {
    id: "test-id",
    name: "TestToken",
    chainId: 1,
    address: ADDR,
    abi: erc20Abi,
    source: "manual",
    addedAt: 0,
    ...overrides,
  };
}

// transfer(address to, uint256 amount) → bool
const transferFn = erc20Abi.find(
  (x) => x.type === "function" && x.name === "transfer",
) as AbiFunction;

const ARGS = [ACCOUNT, 100n] as const;

type FakeClient = {
  simulateContract: ReturnType<typeof vi.fn>;
  estimateContractGas: ReturnType<typeof vi.fn>;
  estimateFeesPerGas: ReturnType<typeof vi.fn>;
  getTransactionCount: ReturnType<typeof vi.fn>;
};

function makeFakeClient(overrides?: Partial<FakeClient>): FakeClient {
  return {
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    estimateContractGas: vi.fn().mockResolvedValue(21000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
    }),
    getTransactionCount: vi.fn().mockResolvedValue(7),
    ...overrides,
  };
}

function makeRpc(client: FakeClient): RpcProvider {
  return {
    getClient: vi.fn().mockReturnValue(client as unknown as PublicClient),
  };
}

describe("simulateOperation", () => {
  it("returns ok with gas, data, fees and nonce on success", async () => {
    const client = makeFakeClient();
    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      {
        contract: makeContract(),
        fn: transferFn,
        args: ARGS,
        value: 5n,
        account: ACCOUNT,
      },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.gas).toBe(21000n);
    expect(res.data).toBe(
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: ARGS,
      }),
    );
    expect(res.fees).toEqual({
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
    });
    expect(res.nonce).toBe(7);

    const expectedCall = {
      address: ADDR,
      abi: erc20Abi,
      functionName: "transfer",
      args: ARGS,
      value: 5n,
      account: ACCOUNT,
    };
    expect(client.simulateContract).toHaveBeenCalledWith(expectedCall);
    expect(client.estimateContractGas).toHaveBeenCalledWith(expectedCall);
  });

  it("returns revert failure when simulateContract reverts; does not reach estimateContractGas", async () => {
    const data = encodeErrorResult({
      abi: erc20Abi,
      errorName: "InsufficientBalance",
      args: [1n, 2n],
    });
    const reverted = new ContractFunctionRevertedError({
      abi: erc20Abi,
      data,
      functionName: "transfer",
    });
    const wrapped = new BaseError("wrapper", { cause: reverted });
    const client = makeFakeClient({
      simulateContract: vi.fn().mockRejectedValue(wrapped),
    });

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      { contract: makeContract(), fn: transferFn, args: ARGS },
    );

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.kind).toBe("revert");
    expect(res.message).toContain("InsufficientBalance");
    expect(client.estimateContractGas).not.toHaveBeenCalled();
  });

  it("returns rpc failure when estimateContractGas throws a non-revert error", async () => {
    const client = makeFakeClient({
      estimateContractGas: vi
        .fn()
        .mockRejectedValue(
          new HttpRequestError({ url: "https://x", status: 500 }),
        ),
    });

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      { contract: makeContract(), fn: transferFn, args: ARGS },
    );

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.kind).toBe("rpc");
    expect(client.simulateContract).toHaveBeenCalledOnce();
  });

  it("returns ok with undefined fees when estimateFeesPerGas throws", async () => {
    const client = makeFakeClient({
      estimateFeesPerGas: vi.fn().mockRejectedValue(new Error("no fees")),
    });

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      {
        contract: makeContract(),
        fn: transferFn,
        args: ARGS,
        account: ACCOUNT,
      },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.fees).toBeUndefined();
    expect(res.nonce).toBe(7);
  });

  it("does not call getTransactionCount and leaves nonce undefined when no account", async () => {
    const client = makeFakeClient();

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      { contract: makeContract(), fn: transferFn, args: ARGS },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.nonce).toBeUndefined();
    expect(client.getTransactionCount).not.toHaveBeenCalled();
  });

  it("returns ok with undefined nonce when getTransactionCount throws", async () => {
    const client = makeFakeClient({
      getTransactionCount: vi.fn().mockRejectedValue(new Error("nonce fail")),
    });

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      {
        contract: makeContract(),
        fn: transferFn,
        args: ARGS,
        account: ACCOUNT,
      },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.nonce).toBeUndefined();
    expect(res.fees).toBeDefined();
  });

  it("omits fees when chain returns legacy fee values (no EIP-1559 fields)", async () => {
    const client = makeFakeClient({
      estimateFeesPerGas: vi.fn().mockResolvedValue({ gasPrice: 100n }),
    });

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      { contract: makeContract(), fn: transferFn, args: ARGS },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.fees).toBeUndefined();
  });

  it("returns rpc failure when calldata encoding throws", async () => {
    const client = makeFakeClient();

    const res = await simulateOperation(
      { rpc: makeRpc(client) },
      // wrong arg types for transfer cause encodeFunctionData to throw
      {
        contract: makeContract(),
        fn: transferFn,
        args: ["not-an-address", "not-a-number"],
      },
    );

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.kind).toBe("rpc");
    expect(client.simulateContract).not.toHaveBeenCalled();
  });
});
