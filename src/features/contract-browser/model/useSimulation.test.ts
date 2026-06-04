import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PublicClient } from "viem";
import type { AbiFunction } from "abitype";
import { useSimulation } from "./useSimulation";
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

// deposit() payable
const depositFn = erc20Abi.find(
  (x) => x.type === "function" && x.name === "deposit",
) as AbiFunction;

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

describe("useSimulation", () => {
  it("sets argErrors for a bad arg; no client call and no history", async () => {
    const client = makeFakeClient();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), transferFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate({ to: "not-an-address", amount: "100" });
    });

    expect(result.current.argErrors["to"]).toBeDefined();
    expect(result.current.state.status).toBe("idle");
    expect(client.simulateContract).not.toHaveBeenCalled();
    expect(addHistory).not.toHaveBeenCalled();
    expect(result.current.parsedArgs).toBeNull();
  });

  it("sets valueError for a bad value string; no rpc, no history", async () => {
    const client = makeFakeClient();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), depositFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate(
        {},
        { amount: "not-a-number", unit: "ether" },
      );
    });

    expect(result.current.valueError).toBeDefined();
    expect(result.current.state.status).toBe("idle");
    expect(client.simulateContract).not.toHaveBeenCalled();
    expect(addHistory).not.toHaveBeenCalled();
  });

  it("on success: state done+ok, parsedArgs/parsedValue populated, ok history entry", async () => {
    const client = makeFakeClient();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), transferFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate(
        { to: ACCOUNT, amount: "100" },
        undefined,
        ACCOUNT,
      );
    });

    expect(result.current.state.status).toBe("done");
    if (result.current.state.status !== "done") throw new Error("not done");
    expect(result.current.state.result.ok).toBe(true);
    expect(result.current.parsedArgs).toEqual([ACCOUNT, 100n]);
    expect(result.current.parsedValue).toBeUndefined();
    expect(result.current.argErrors).toEqual({});
    expect(result.current.valueError).toBeUndefined();
    expect(addHistory).toHaveBeenCalledWith({
      contractId: "test-id",
      chainId: 1,
      type: "simulate",
      fnName: "transfer",
      args: { to: ACCOUNT, amount: "100" },
      status: "ok",
      result: "est. gas 21000",
      from: ACCOUNT,
    });
  });

  it("parses payable value into parsedValue and passes it through", async () => {
    const client = makeFakeClient();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), depositFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate({}, { amount: "1", unit: "ether" });
    });

    expect(result.current.state.status).toBe("done");
    expect(result.current.parsedValue).toBe(1000000000000000000n);
    expect(client.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ value: 1000000000000000000n }),
    );
  });

  it("treats empty/'0' value as undefined (value: undefined to simulateContract)", async () => {
    const client = makeFakeClient();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), depositFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate({}, { amount: "0", unit: "ether" });
    });

    expect(result.current.parsedValue).toBeUndefined();
    expect(client.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ value: undefined }),
    );
  });

  it("on revert: state done+fail and an error history entry", async () => {
    const client = makeFakeClient({
      simulateContract: vi
        .fn()
        .mockRejectedValue(new Error("execution reverted")),
    });
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), transferFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate({ to: ACCOUNT, amount: "100" });
    });

    expect(result.current.state.status).toBe("done");
    if (result.current.state.status !== "done") throw new Error("not done");
    expect(result.current.state.result.ok).toBe(false);
    expect(addHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "simulate",
        status: "error",
        fnName: "transfer",
      }),
    );
    const entry = addHistory.mock.calls[0]![0] as { error?: string };
    expect(entry.error).toBeDefined();
  });

  it("reset() clears state, errors, parsedArgs and parsedValue", async () => {
    const client = makeFakeClient();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSimulation(makeContract(), depositFn, {
        rpc: makeRpc(client),
        addHistory,
      }),
    );

    await act(async () => {
      await result.current.simulate({}, { amount: "1", unit: "ether" });
    });
    expect(result.current.state.status).toBe("done");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.argErrors).toEqual({});
    expect(result.current.valueError).toBeUndefined();
    expect(result.current.parsedArgs).toBeNull();
    expect(result.current.parsedValue).toBeUndefined();
  });
});
