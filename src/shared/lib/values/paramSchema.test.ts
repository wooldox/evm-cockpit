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

  it("validates dynamic bytes and rejects odd-length hex", () => {
    const s = paramSchema("bytes");
    expect(s.safeParse("0xabcd").success).toBe(true);
    expect(s.safeParse("0x").success).toBe(true);
    expect(s.safeParse("0x1").success).toBe(false);
    expect(s.safeParse("nothex").success).toBe(false);
  });

  it("validates string type", () => {
    const s = paramSchema("string");
    expect(s.safeParse("hello").success).toBe(true);
    expect(s.safeParse(123).success).toBe(false);
  });

  it("validates signed intN range", () => {
    const s = paramSchema("int8");
    expect(s.parse("-128")).toBe(-128n);
    expect(s.parse("127")).toBe(127n);
    expect(s.safeParse("-129").success).toBe(false);
    expect(s.safeParse("128").success).toBe(false);
  });

  it("accepts number and bigint inputs for uint", () => {
    const s = paramSchema("uint256");
    expect(s.parse(100)).toBe(100n);
    expect(s.parse(100n)).toBe(100n);
  });

  it("rejects non-bool, non-string input for bool", () => {
    const s = paramSchema("bool");
    expect(s.safeParse(0).success).toBe(false);
    expect(s.safeParse(1).success).toBe(false);
  });

  it("passes through raw boolean for bool", () => {
    const s = paramSchema("bool");
    expect(s.parse(true)).toBe(true);
    expect(s.parse(false)).toBe(false);
  });

  it("passes through unknown/tuple types", () => {
    const s = paramSchema("tuple");
    expect(s.safeParse({ anything: true }).success).toBe(true);
  });
});
