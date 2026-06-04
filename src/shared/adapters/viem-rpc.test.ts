import { describe, it, expect } from "vitest";
import { createViemRpc } from "./viem-rpc";

describe("viem rpc adapter", () => {
  it("returns a public client for a known chain", () => {
    const rpc = createViemRpc(() => ({}));
    const client = rpc.getClient(1);
    expect(client.chain?.id).toBe(1);
    // Curated default should be used when no override is present
    expect(client.transport.url).toBe("https://eth.drpc.org");
  });
  it("uses the override URL when present", () => {
    const rpc = createViemRpc(() => ({ 1: "https://my.rpc" }));
    expect(rpc.getClient(1).transport.url).toBe("https://my.rpc");
  });
  it("memoizes the client for the same chain+url", () => {
    const rpc = createViemRpc(() => ({}));
    expect(rpc.getClient(1)).toBe(rpc.getClient(1));
  });
  it("throws a clear error for an unsupported chain", () => {
    const rpc = createViemRpc(() => ({}));
    expect(() => rpc.getClient(123456789)).toThrow(
      /unsupported|unknown|not.*support/i,
    );
  });
  // Note: simulating a chain in SUPPORTED_VIEM_CHAINS but absent from DEFAULT_RPC_URLS
  // would require patching the module-level CHAIN_MAP, which is not straightforward without
  // mocking. The fallback to viem's chain default (http(undefined)) is covered by the
  // implementation path but not exercised here.
});
