import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGetterCall } from "./useGetterCall";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import type { AbiFunction } from "abitype";

const ADDR = "0x1234567890123456789012345678901234567890" as const;

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

// balanceOf(address owner) → uint256
const balanceOfFn = erc20Abi.find(
  (x) => x.type === "function" && x.name === "balanceOf",
) as AbiFunction;

function makeFakeClient(readContractImpl?: () => Promise<unknown>) {
  return {
    readContract: vi.fn().mockImplementation(readContractImpl ?? (() => Promise.resolve(42n))),
  };
}

describe("useGetterCall", () => {
  it("sets argErrors when address arg is invalid; does NOT call readContract", async () => {
    const fakeClient = makeFakeClient();
    const rpc: RpcProvider = { getClient: vi.fn().mockReturnValue(fakeClient) };

    const contract = makeContract();
    const { result } = renderHook(() =>
      useGetterCall(contract, balanceOfFn, { rpc }),
    );

    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.call({ owner: "not-an-address" });
    });

    expect(result.current.argErrors["owner"]).toBeDefined();
    expect(result.current.status).toBe("idle");
    expect(fakeClient.readContract).not.toHaveBeenCalled();
  });

  it("returns result and status=done for valid args", async () => {
    const fakeClient = makeFakeClient(() => Promise.resolve(42n));
    const rpc: RpcProvider = { getClient: vi.fn().mockReturnValue(fakeClient) };

    const contract = makeContract();
    const { result } = renderHook(() =>
      useGetterCall(contract, balanceOfFn, { rpc }),
    );

    await act(async () => {
      await result.current.call({ owner: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" });
    });

    expect(result.current.status).toBe("done");
    expect(result.current.result).toBe(42n);
    expect(result.current.argErrors).toEqual({});
    expect(fakeClient.readContract).toHaveBeenCalledOnce();
  });

  it("sets status=error with shortMessage when client throws a viem-like error", async () => {
    const fakeClient = {
      readContract: vi.fn().mockRejectedValue({ shortMessage: "execution reverted" }),
    };
    const rpc: RpcProvider = { getClient: vi.fn().mockReturnValue(fakeClient) };

    const contract = makeContract();
    const { result } = renderHook(() =>
      useGetterCall(contract, balanceOfFn, { rpc }),
    );

    await act(async () => {
      await result.current.call({ owner: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("execution reverted");
  });

  it("falls back to .message when shortMessage is absent", async () => {
    const fakeClient = {
      readContract: vi.fn().mockRejectedValue(new Error("rpc failed")),
    };
    const rpc: RpcProvider = { getClient: vi.fn().mockReturnValue(fakeClient) };

    const contract = makeContract();
    const { result } = renderHook(() =>
      useGetterCall(contract, balanceOfFn, { rpc }),
    );

    await act(async () => {
      await result.current.call({ owner: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("rpc failed");
  });
});
