import type { AbiEvent } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";

export type TDecodedLog = {
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
  /** Decoded named args (viem getLogs with `event`). Positional fallback keys "0","1",… when inputs unnamed. */
  args: Record<string, unknown>;
};

export type TEventLogsResult = {
  logs: TDecodedLog[]; // ascending block order
  truncated: boolean; // hit MAX_LOGS cap
  chunks: number; // RPC round-trips made (for the UI note)
};

export const MAX_LOGS = 1000;
export const CHUNK_SIZE = 10_000n; // blocks per getLogs call
/** Below this window size we stop bisecting and surface the original error. */
const BISECT_FLOOR = 256n;

/** Raw log shape returned by viem's getLogs (only the fields we consume). */
type RawLog = {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  args?: Record<string, unknown> | readonly unknown[];
};

function normalizeLog(log: RawLog): TDecodedLog {
  let args: Record<string, unknown>;
  if (Array.isArray(log.args)) {
    // viem returns a positional array when event inputs are unnamed.
    args = {};
    for (let i = 0; i < log.args.length; i++) {
      args[String(i)] = log.args[i];
    }
  } else {
    args = (log.args as Record<string, unknown> | undefined) ?? {};
  }
  return {
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
    logIndex: log.logIndex,
    args,
  };
}

/**
 * Fetch and decode event logs over an inclusive block range, splitting into
 * windows of at most CHUNK_SIZE blocks and fetching sequentially in ascending
 * order. A window that fails is bisected and retried on both halves; once a
 * failing window is ≤ BISECT_FLOOR blocks the original error is rethrown.
 * Stops issuing further requests once MAX_LOGS logs are collected (truncated).
 *
 * `chunks` counts every getLogs call ISSUED (success or failure, including
 * bisect retries) — it reflects RPC round-trips, not windows.
 */
export async function fetchEventLogs(
  deps: { rpc: RpcProvider },
  params: {
    contract: TContract;
    event: AbiEvent;
    fromBlock: bigint;
    toBlock: bigint;
  },
): Promise<TEventLogsResult> {
  const { contract, event, fromBlock, toBlock } = params;
  if (fromBlock > toBlock) throw new Error("invalid block range");

  const client = deps.rpc.getClient(contract.chainId);
  const collected: TDecodedLog[] = [];
  let chunks = 0;
  let truncated = false;

  // Fetch a single window with bisect-on-failure. Returns the window's logs in
  // ascending order. Counts every issued getLogs call into `chunks`.
  async function fetchWindow(
    winFrom: bigint,
    winTo: bigint,
  ): Promise<TDecodedLog[]> {
    chunks += 1;
    try {
      const raw = (await client.getLogs({
        address: contract.address,
        event,
        fromBlock: winFrom,
        toBlock: winTo,
      })) as unknown as RawLog[];
      return raw.map(normalizeLog);
    } catch (e) {
      // At/under the floor, stop bisecting and surface the original error.
      if (winTo - winFrom + 1n <= BISECT_FLOOR) throw e;
      const mid = winFrom + (winTo - winFrom) / 2n;
      const left = await fetchWindow(winFrom, mid);
      const right = await fetchWindow(mid + 1n, winTo);
      return [...left, ...right];
    }
  }

  // Walk consecutive windows ascending; stop issuing calls once capped.
  let winFrom = fromBlock;
  while (winFrom <= toBlock) {
    const winTo =
      winFrom + CHUNK_SIZE - 1n < toBlock ? winFrom + CHUNK_SIZE - 1n : toBlock;
    const windowLogs = await fetchWindow(winFrom, winTo);
    collected.push(...windowLogs);
    if (collected.length >= MAX_LOGS) {
      truncated = true;
      break;
    }
    winFrom = winTo + 1n;
  }

  const logs = truncated ? collected.slice(0, MAX_LOGS) : collected;
  return { logs, truncated, chunks };
}
