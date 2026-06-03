import { describe, it, expect } from "vitest";
import { createViemRpc } from "./viem-rpc";

describe("viem rpc adapter", () => {
  it("returns a public client for a known chain", () => {
    const rpc = createViemRpc(() => ({}));
    expect(rpc.getClient(1).chain?.id).toBe(1);
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
});
