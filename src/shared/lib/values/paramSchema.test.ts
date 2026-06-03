import { describe, it, expect } from "vitest";
import { paramSchema } from "./paramSchema";

describe("paramSchema", () => {
  it("validates an address", () => {
    const s = paramSchema("address");
    expect(
      s.safeParse("0x4E639304D9229AF411020C45b6b4c0ac105225c4").success,
    ).toBe(true);
    expect(s.safeParse("0x123").success).toBe(false);
  });

  it("validates a bool from string or boolean", () => {
    const s = paramSchema("bool");
    expect(s.parse("true")).toBe(true);
    expect(s.parse("false")).toBe(false);
  });

  it("parses uint256 to bigint and rejects negatives", () => {
    const s = paramSchema("uint256");
    expect(s.parse("100")).toBe(100n);
    expect(s.safeParse("-1").success).toBe(false);
  });

  it("enforces uint8 max bound", () => {
    const s = paramSchema("uint8");
    expect(s.safeParse("255").success).toBe(true);
    expect(s.safeParse("256").success).toBe(false);
  });

  it("validates bytes32 hex length", () => {
    const s = paramSchema("bytes32");
    expect(s.safeParse("0x" + "ab".repeat(32)).success).toBe(true);
    expect(s.safeParse("0xabcd").success).toBe(false);
  });

  it("validates an address[] array", () => {
    const s = paramSchema("address[]");
    const a = "0x4E639304D9229AF411020C45b6b4c0ac105225c4";
    expect(s.safeParse([a, a]).success).toBe(true);
    expect(s.safeParse([a, "0x1"]).success).toBe(false);
  });
});
