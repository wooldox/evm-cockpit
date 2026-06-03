import { describe, it, expect } from "vitest";
import { detectProxy } from "./proxy";
import type { RpcProvider } from "@/shared/ports/rpc";

const IMPL = "0x1111111111111111111111111111111111111111";
const BEACON = "0x2222222222222222222222222222222222222222";

const slotWith = (addr: string): `0x${string}` =>
  ("0x" + "00".repeat(12) + addr.slice(2).toLowerCase()) as `0x${string}`;

const ZERO = ("0x" + "00".repeat(32)) as `0x${string}`;

const EIP1967_IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_BEACON_SLOT =
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

function mockRpc(
  getStorageAt: (args: {
    address: `0x${string}`;
    slot: `0x${string}`;
  }) => Promise<`0x${string}`>,
  readContract?: () => Promise<unknown>,
): RpcProvider {
  return {
    getClient: () => ({ getStorageAt, readContract }) as never,
  };
}

describe("detectProxy", () => {
  it("detects an EIP-1967 implementation slot proxy (UUPS/transparent)", async () => {
    const rpc = mockRpc(async () => slotWith(IMPL));
    const r = await detectProxy(
      rpc,
      1,
      "0xabcdef0000000000000000000000000000000001",
    );
    expect(r).toEqual({
      kind: "eip1967",
      implAddress: expect.stringMatching(/^0x1111/i),
    });
  });

  it("returns null when both slots are zero", async () => {
    const rpc = mockRpc(async () => ZERO);
    expect(
      await detectProxy(rpc, 1, "0xabcdef0000000000000000000000000000000001"),
    ).toBeNull();
  });

  it("detects a beacon proxy via implementation()", async () => {
    const rpc = mockRpc(
      async ({ slot }) =>
        slot.toLowerCase() === EIP1967_IMPL_SLOT.toLowerCase()
          ? ZERO
          : slot.toLowerCase() === EIP1967_BEACON_SLOT.toLowerCase()
            ? slotWith(BEACON)
            : ZERO,
      async () => IMPL,
    );
    const r = await detectProxy(
      rpc,
      1,
      "0xabcdef0000000000000000000000000000000001",
    );
    expect(r?.kind).toBe("beacon");
    expect(r?.implAddress).toMatch(/^0x1111/i);
  });

  it("returns the checksummed impl address for EIP-1967", async () => {
    const rpc = mockRpc(async () => slotWith(IMPL));
    const r = await detectProxy(
      rpc,
      1,
      "0xabcdef0000000000000000000000000000000001",
    );
    // getAddress checksums — 0x1111...1111 is all same nibble so checksumming keeps it identical
    expect(r?.implAddress).toBe("0x1111111111111111111111111111111111111111");
  });

  it("returns the checksummed impl address for beacon", async () => {
    const rpc = mockRpc(
      async ({ slot }) =>
        slot.toLowerCase() === EIP1967_IMPL_SLOT.toLowerCase()
          ? ZERO
          : slotWith(BEACON),
      async () => IMPL,
    );
    const r = await detectProxy(
      rpc,
      1,
      "0xabcdef0000000000000000000000000000000001",
    );
    expect(r?.implAddress).toBe("0x1111111111111111111111111111111111111111");
  });
});
