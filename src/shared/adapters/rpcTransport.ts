import { fallback, http } from 'viem';
import type { Transport } from 'viem';

/**
 * How long a non-final endpoint gets before we give up and try the next one.
 * viem's default (10s) is the patience you want when there is nowhere else to
 * go; with a fallback behind it, a stalled leader should be abandoned sooner.
 * Sized to clear a 10k-block getLogs (fetchEventLogs' chunk) on a healthy node.
 */
const FAILOVER_TIMEOUT_MS = 5_000;

/**
 * One transport over an ordered RPC list: viem's `fallback` moves to the next
 * URL when a request fails (a dead host, a 429, a stall past
 * FAILOVER_TIMEOUT_MS, or a JSON-RPC error such as drpc's "chain is not
 * available on free plan"). Execution reverts and wallet rejections are real
 * answers and still throw immediately.
 *
 * The last URL keeps viem's default timeout — there is no one left to fail
 * over to, so waiting beats failing.
 *
 * An empty list yields a plain `http()` so viem uses the chain's own default.
 *
 * ponytail: static order, no latency ranking — the first live endpoint wins
 * even if a later one is faster. viem's `fallback({ rank: true })` fixes that,
 * at the cost of a forever-running background ping of every endpoint on every
 * client; add it if slow-but-alive endpoints become the common complaint.
 */
export function rpcTransport(urls: readonly string[]): Transport {
  if (urls.length === 0) return http();
  if (urls.length === 1) return http(urls[0]);
  return fallback(
    urls.map((url, i) =>
      i === urls.length - 1
        ? http(url)
        : http(url, { timeout: FAILOVER_TIMEOUT_MS }),
    ),
  );
}
