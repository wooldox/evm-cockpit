import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PublicClient } from "viem";
import type { AbiEvent } from "abitype";
import { useEventLogs } from "./useEventLogs";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";

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

const transferEvent = erc20Abi.find(
  (x) => x.type === "event" && x.name === "Transfer",
) as AbiEvent;

function rawLog(blockNumber: bigint, logIndex: number) {
  return {
    blockNumber,
    transactionHash: `0x${"a".repeat(64)}` as `0x${string}`,
    logIndex,
    args: { from: ADDR, to: ADDR, value: 1n },
  };
}

type FakeClient = {
  getLogs: ReturnType<typeof vi.fn>;
  getBlockNumber: ReturnType<typeof vi.fn>;
};

function makeFakeClient(overrides?: Partial<FakeClient>): FakeClient {
  return {
    getLogs: vi.fn().mockResolvedValue([rawLog(10n, 0)]),
    getBlockNumber: vi.fn().mockResolvedValue(5000n),
    ...overrides,
  };
}

function makeRpc(client: FakeClient): RpcProvider {
  return {
    getClient: vi.fn().mockReturnValue(client as unknown as PublicClient),
  };
}

describe("useEventLogs", () => {
  it("happy fetch: done with mapped logs", async () => {
    const client = makeFakeClient();
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "0", "100");
    });

    expect(result.current.state.status).toBe("done");
    if (result.current.state.status !== "done") throw new Error("not done");
    expect(result.current.state.result.logs).toEqual([
      {
        blockNumber: 10n,
        txHash: `0x${"a".repeat(64)}`,
        logIndex: 0,
        args: { from: ADDR, to: ADDR, value: 1n },
      },
    ]);
    expect(client.getBlockNumber).not.toHaveBeenCalled();
  });

  it("'latest' to-block resolves via getBlockNumber and is used as toBlock", async () => {
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockResolvedValue(4242n),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "0", "LaTeSt");
    });

    expect(client.getBlockNumber).toHaveBeenCalledOnce();
    expect(result.current.state.status).toBe("done");
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 0n, toBlock: 4242n }),
    );
  });

  it("empty to-block resolves via getBlockNumber", async () => {
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockResolvedValue(99n),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "0", "  ");
    });

    expect(client.getBlockNumber).toHaveBeenCalledOnce();
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ toBlock: 99n }),
    );
  });

  it("invalid from block: error, getLogs NOT called, no loading", async () => {
    const client = makeFakeClient();
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "not-a-number", "100");
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toBe("invalid from block");
    expect(client.getLogs).not.toHaveBeenCalled();
  });

  it.each(["-5", "0x10"])(
    "from block %s (hex/negative): error, no rpc",
    async (fromRaw) => {
      const client = makeFakeClient();
      const { result } = renderHook(() =>
        useEventLogs(makeContract(), { rpc: makeRpc(client) }),
      );

      await act(async () => {
        await result.current.fetchLogs(transferEvent, fromRaw, "100");
      });

      expect(result.current.state.status).toBe("error");
      if (result.current.state.status !== "error") throw new Error("not error");
      expect(result.current.state.error).toBe("invalid from block");
      expect(client.getLogs).not.toHaveBeenCalled();
      expect(client.getBlockNumber).not.toHaveBeenCalled();
    },
  );

  it.each(["-5", "0x10"])(
    "to block %s (hex/negative): error, no getLogs",
    async (toRaw) => {
      const client = makeFakeClient();
      const { result } = renderHook(() =>
        useEventLogs(makeContract(), { rpc: makeRpc(client) }),
      );

      await act(async () => {
        await result.current.fetchLogs(transferEvent, "0", toRaw);
      });

      expect(result.current.state.status).toBe("error");
      if (result.current.state.status !== "error") throw new Error("not error");
      expect(result.current.state.error).toBe("invalid to block");
      expect(client.getLogs).not.toHaveBeenCalled();
    },
  );

  it("empty/whitespace from block: error, getLogs and getBlockNumber NOT called", async () => {
    const client = makeFakeClient();
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "   ", "100");
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toBe("invalid from block");
    expect(client.getLogs).not.toHaveBeenCalled();
    expect(client.getBlockNumber).not.toHaveBeenCalled();
  });

  it("invalid to block: error, getLogs NOT called", async () => {
    const client = makeFakeClient();
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "0", "bogus");
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toBe("invalid to block");
    expect(client.getLogs).not.toHaveBeenCalled();
  });

  it("client failure: humanized shortMessage error", async () => {
    const client = makeFakeClient({
      // floor-sized window so fetchEventLogs rethrows immediately.
      getLogs: vi.fn().mockRejectedValue(
        Object.assign(new Error("long verbose message"), {
          shortMessage: "node down",
        }),
      ),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.fetchLogs(transferEvent, "0", "100");
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toBe("node down");
  });

  it("stale fetch resolving after reset() is ignored", async () => {
    let resolveLogs: (v: unknown[]) => void = () => {};
    const deferred = new Promise<unknown[]>((res) => {
      resolveLogs = res;
    });
    const client = makeFakeClient({
      getLogs: vi.fn().mockReturnValue(deferred),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    let fetchPromise: Promise<void> = Promise.resolve();
    act(() => {
      fetchPromise = result.current.fetchLogs(transferEvent, "0", "100");
    });
    expect(result.current.state.status).toBe("loading");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state.status).toBe("idle");

    await act(async () => {
      resolveLogs([rawLog(10n, 0)]);
      await fetchPromise;
    });

    // Stale resolution must not flip state back to done.
    expect(result.current.state.status).toBe("idle");
  });

  it("loadDefaultRange: from = latest - 9999, to = 'latest'", async () => {
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockResolvedValue(50000n),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    let returned: unknown;
    await act(async () => {
      returned = await result.current.loadDefaultRange();
    });

    const expected = { from: (50000n - 9999n).toString(), to: "latest" };
    expect(result.current.defaultRange).toEqual(expected);
    // Also returns the resolved range so a handler can use it synchronously.
    expect(returned).toEqual(expected);
  });

  it("loadDefaultRange clamps from to '0' when latest < 9999", async () => {
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.loadDefaultRange();
    });

    expect(result.current.defaultRange).toEqual({ from: "0", to: "latest" });
  });

  it("loadDefaultRange late failure after reset() does not clobber state", async () => {
    let rejectBlock: (e: unknown) => void = () => {};
    const deferred = new Promise<bigint>((_, rej) => {
      rejectBlock = rej;
    });
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockReturnValue(deferred),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    let rangePromise: Promise<unknown> = Promise.resolve();
    act(() => {
      rangePromise = result.current.loadDefaultRange();
    });

    // reset() bumps callId, invalidating the in-flight loadDefaultRange snapshot.
    act(() => {
      result.current.reset();
    });
    expect(result.current.state.status).toBe("idle");

    await act(async () => {
      rejectBlock(new Error("rpc boom"));
      await rangePromise;
    });

    // Stale failure must not flip state to error.
    expect(result.current.state.status).toBe("idle");
  });

  it("loadDefaultRange failure sets error state", async () => {
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockRejectedValue(new Error("rpc boom")),
    });
    const { result } = renderHook(() =>
      useEventLogs(makeContract(), { rpc: makeRpc(client) }),
    );

    await act(async () => {
      await result.current.loadDefaultRange();
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toBe("rpc boom");
  });
});
