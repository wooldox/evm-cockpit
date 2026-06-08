export type RpcTestResult =
  | { ok: true; info: string }
  | { ok: false; info: string };

const TIMEOUT_MS = 5000;

/**
 * Probe a custom RPC endpoint with a real `eth_blockNumber` call so the user
 * can confirm it actually works. Returns the latest block on success, or a
 * concise reason on failure (HTTP status, JSON-RPC error, timeout, network).
 * `fetchFn` is injectable for tests.
 */
export async function testRpc(
  url: string,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<RpcTestResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, info: `HTTP ${res.status}` };
    const j = (await res.json()) as {
      result?: unknown;
      error?: { message?: unknown };
    };
    if (typeof j.result === "string") {
      const n = Number.parseInt(j.result, 16);
      if (Number.isNaN(n)) return { ok: false, info: "bad result" };
      return { ok: true, info: `block ${n.toLocaleString()}` };
    }
    const msg =
      j.error && typeof j.error.message === "string"
        ? j.error.message
        : "no result";
    return { ok: false, info: msg };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, info: "timed out" };
    }
    return { ok: false, info: "request failed" };
  } finally {
    clearTimeout(timer);
  }
}
