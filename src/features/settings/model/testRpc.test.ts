import { describe, it, expect, vi } from "vitest";
import { testRpc } from "./testRpc";

function jsonRes(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("testRpc", () => {
  it("returns the latest block on a valid eth_blockNumber result", async () => {
    const fetchFn: typeof fetch = vi.fn(async () =>
      jsonRes({ jsonrpc: "2.0", id: 1, result: "0x10" }),
    );
    const r = await testRpc("https://rpc.example.com", { fetchFn });
    expect(r).toEqual({ ok: true, info: "block 16" });
    // sent a JSON-RPC eth_blockNumber POST
    const init = vi.mocked(fetchFn).mock.calls[0]![1];
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("eth_blockNumber");
  });

  it("reports a JSON-RPC error message", async () => {
    const fetchFn = vi.fn(async () =>
      jsonRes({
        jsonrpc: "2.0",
        id: 1,
        error: { message: "method not found" },
      }),
    );
    const r = await testRpc("https://rpc.example.com", { fetchFn });
    expect(r).toEqual({ ok: false, info: "method not found" });
  });

  it("reports a non-OK HTTP status", async () => {
    const fetchFn = vi.fn(async () => jsonRes({}, false, 503));
    const r = await testRpc("https://rpc.example.com", { fetchFn });
    expect(r).toEqual({ ok: false, info: "HTTP 503" });
  });

  it("reports 'no result' when the body has neither result nor error", async () => {
    const fetchFn = vi.fn(async () => jsonRes({ jsonrpc: "2.0", id: 1 }));
    const r = await testRpc("https://rpc.example.com", { fetchFn });
    expect(r).toEqual({ ok: false, info: "no result" });
  });

  it("reports a network failure", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const r = await testRpc("https://rpc.example.com", { fetchFn });
    expect(r).toEqual({ ok: false, info: "request failed" });
  });

  it("reports a timeout when the request aborts", async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    const r = await testRpc("https://rpc.example.com", { fetchFn });
    expect(r).toEqual({ ok: false, info: "timed out" });
  });
});
