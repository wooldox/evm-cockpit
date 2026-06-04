import { describe, it, expect, vi } from "vitest";
import type { PublicClient } from "viem";
import type { Abi, AbiEvent } from "abitype";
import {
  fetchEventLogs,
  MAX_LOGS,
  CHUNK_SIZE,
  MAX_WINDOWS,
} from "./fetchEventLogs";
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

// Transfer(address indexed from, address indexed to, uint256 value)
const transferEvent = erc20Abi.find(
  (x) => x.type === "event" && x.name === "Transfer",
) as AbiEvent;

// Local fixture: an event with unnamed inputs (viem returns positional args).
const unnamedAbi: Abi = [
  {
    type: "event",
    name: "Ping",
    inputs: [
      { name: "", type: "uint256", indexed: false },
      { name: "", type: "address", indexed: false },
    ],
    anonymous: false,
  },
];
const unnamedEvent = unnamedAbi[0] as AbiEvent;

type RawLog = {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  args?: Record<string, unknown> | readonly unknown[];
};

function rawLog(blockNumber: bigint, logIndex: number): RawLog {
  return {
    blockNumber,
    transactionHash: `0x${"a".repeat(64)}` as `0x${string}`,
    logIndex,
    args: { from: ADDR, to: ADDR, value: 1n },
  };
}

function makeRpc(getLogs: ReturnType<typeof vi.fn>): RpcProvider {
  const client = { getLogs } as unknown as PublicClient;
  return { getClient: vi.fn().mockReturnValue(client) };
}

describe("fetchEventLogs", () => {
  it("single window happy path: maps logs, ascending, chunks=1", async () => {
    const getLogs = vi.fn().mockResolvedValue([rawLog(10n, 0), rawLog(11n, 1)]);
    const res = await fetchEventLogs(
      { rpc: makeRpc(getLogs) },
      {
        contract: makeContract(),
        event: transferEvent,
        fromBlock: 0n,
        toBlock: 100n,
      },
    );

    expect(res.chunks).toBe(1);
    expect(res.truncated).toBe(false);
    expect(res.logs).toEqual([
      {
        blockNumber: 10n,
        txHash: `0x${"a".repeat(64)}`,
        logIndex: 0,
        args: { from: ADDR, to: ADDR, value: 1n },
      },
      {
        blockNumber: 11n,
        txHash: `0x${"a".repeat(64)}`,
        logIndex: 1,
        args: { from: ADDR, to: ADDR, value: 1n },
      },
    ]);
    expect(getLogs).toHaveBeenCalledWith({
      address: ADDR,
      event: transferEvent,
      fromBlock: 0n,
      toBlock: 100n,
    });
  });

  it("multi-window: splits range > CHUNK_SIZE into inclusive non-overlapping sub-ranges", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    const from = 0n;
    const to = CHUNK_SIZE * 2n + 5n; // → 3 windows
    await fetchEventLogs(
      { rpc: makeRpc(getLogs) },
      {
        contract: makeContract(),
        event: transferEvent,
        fromBlock: from,
        toBlock: to,
      },
    );

    expect(getLogs).toHaveBeenCalledTimes(3);
    const ranges = getLogs.mock.calls.map((c) => [
      (c[0] as { fromBlock: bigint }).fromBlock,
      (c[0] as { toBlock: bigint }).toBlock,
    ]);
    expect(ranges).toEqual([
      [0n, CHUNK_SIZE - 1n],
      [CHUNK_SIZE, CHUNK_SIZE * 2n - 1n],
      [CHUNK_SIZE * 2n, to],
    ]);
    // No gaps / overlaps: each window starts one block after the previous end.
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]![0]).toBe(ranges[i - 1]![1]! + 1n);
    }
  });

  it("bisect: a window rejecting once is split and retried; logs complete, chunks counts retries", async () => {
    // Window is 1000 blocks (> floor). First call rejects, the two halves succeed.
    const err = new Error("query returned more than 10000 results");
    const getLogs = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce([rawLog(100n, 0)])
      .mockResolvedValueOnce([rawLog(600n, 1)]);
    const res = await fetchEventLogs(
      { rpc: makeRpc(getLogs) },
      {
        contract: makeContract(),
        event: transferEvent,
        fromBlock: 0n,
        toBlock: 999n,
      },
    );

    // 1 failed + 2 successful halves = 3 issued calls.
    expect(res.chunks).toBe(3);
    expect(res.logs.map((l) => l.blockNumber)).toEqual([100n, 600n]);
    const ranges = getLogs.mock.calls.map((c) => [
      (c[0] as { fromBlock: bigint }).fromBlock,
      (c[0] as { toBlock: bigint }).toBlock,
    ]);
    expect(ranges).toEqual([
      [0n, 999n],
      [0n, 499n],
      [500n, 999n],
    ]);
  });

  it("bisect floor: a window ≤ 256 blocks still failing rethrows the original error", async () => {
    const err = new Error("node unavailable");
    const getLogs = vi.fn().mockRejectedValue(err);
    await expect(
      fetchEventLogs(
        { rpc: makeRpc(getLogs) },
        {
          contract: makeContract(),
          event: transferEvent,
          fromBlock: 0n,
          toBlock: 100n,
        },
      ),
    ).rejects.toBe(err);
    // 100-block window is below the floor → single attempt, no bisect.
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it("cap: stops at MAX_LOGS, truncated, later windows not fetched", async () => {
    const tooMany = Array.from({ length: MAX_LOGS + 50 }, (_, i) =>
      rawLog(BigInt(i), i),
    );
    // First window already exceeds MAX_LOGS; second window must never be hit.
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce(tooMany)
      .mockResolvedValueOnce([rawLog(99999n, 0)]);
    const res = await fetchEventLogs(
      { rpc: makeRpc(getLogs) },
      {
        contract: makeContract(),
        event: transferEvent,
        fromBlock: 0n,
        toBlock: CHUNK_SIZE * 2n,
      },
    );

    expect(res.truncated).toBe(true);
    expect(res.logs.length).toBe(MAX_LOGS);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it("throws 'invalid block range' when fromBlock > toBlock; no rpc", async () => {
    const getLogs = vi.fn();
    await expect(
      fetchEventLogs(
        { rpc: makeRpc(getLogs) },
        {
          contract: makeContract(),
          event: transferEvent,
          fromBlock: 10n,
          toBlock: 5n,
        },
      ),
    ).rejects.toThrow("invalid block range");
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("rejects a range exceeding MAX_WINDOWS up-front; getLogs never called", async () => {
    const getLogs = vi.fn();
    // MAX_WINDOWS+1 windows: from 0, span = (MAX_WINDOWS+1)*CHUNK_SIZE blocks.
    const toBlock = (MAX_WINDOWS + 1n) * CHUNK_SIZE - 1n;
    await expect(
      fetchEventLogs(
        { rpc: makeRpc(getLogs) },
        {
          contract: makeContract(),
          event: transferEvent,
          fromBlock: 0n,
          toBlock,
        },
      ),
    ).rejects.toThrow(
      "block range too large — narrow the range (max 2,000,000 blocks)",
    );
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("accepts a range of exactly MAX_WINDOWS windows", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    // Exactly MAX_WINDOWS windows: span = MAX_WINDOWS*CHUNK_SIZE blocks.
    const toBlock = MAX_WINDOWS * CHUNK_SIZE - 1n;
    const res = await fetchEventLogs(
      { rpc: makeRpc(getLogs) },
      {
        contract: makeContract(),
        event: transferEvent,
        fromBlock: 0n,
        toBlock,
      },
    );

    expect(res.truncated).toBe(false);
    expect(res.logs).toEqual([]);
    expect(getLogs).toHaveBeenCalledTimes(Number(MAX_WINDOWS));
  });

  it("normalizes positional args (unnamed inputs) to keys '0','1',…", async () => {
    const getLogs = vi.fn().mockResolvedValue([
      {
        blockNumber: 7n,
        transactionHash: `0x${"b".repeat(64)}`,
        logIndex: 3,
        args: [42n, ADDR],
      },
    ]);
    const res = await fetchEventLogs(
      { rpc: makeRpc(getLogs) },
      {
        contract: makeContract(),
        event: unnamedEvent,
        fromBlock: 0n,
        toBlock: 100n,
      },
    );

    expect(res.logs).toEqual([
      {
        blockNumber: 7n,
        txHash: `0x${"b".repeat(64)}`,
        logIndex: 3,
        args: { "0": 42n, "1": ADDR },
      },
    ]);
  });
});
