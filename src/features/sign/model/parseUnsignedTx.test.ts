import { describe, it, expect } from "vitest";
import { buildUnsignedTxJson } from "@/shared/lib/tx/downloadUnsignedTx";
import { parseUnsignedTx } from "./parseUnsignedTx";

const TO = "0xA0b86991c6218B36c1d19D4a2e9Eb0cE3606eB48" as const;
const DATA = "0xa9059cbb0000000000000000000000000000000000000000" as const;

describe("parseUnsignedTx", () => {
  it("round-trips a real buildUnsignedTxJson output with bigint equality", () => {
    const json = buildUnsignedTxJson({
      chainId: 1,
      to: TO,
      data: DATA,
      value: 1_000_000_000_000_000_000n,
      gas: 51284n,
      nonce: 142,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 1_500_000_000n,
      from: "0x1111111111111111111111111111111111111111",
    });

    const result = parseUnsignedTx(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tx.to).toBe(TO);
    expect(result.tx.data).toBe(DATA);
    expect(result.tx.valueWei).toBe(1_000_000_000_000_000_000n);
    expect(result.tx.gas).toBe(51284n);
    expect(result.tx.nonce).toBe(142);
    expect(result.tx.maxFeePerGas).toBe(30_000_000_000n);
    expect(result.tx.maxPriorityFeePerGas).toBe(1_500_000_000n);
    expect(result.tx.chainId).toBe(1);
    // from is dropped from the output.
    expect("from" in result.tx).toBe(false);
  });

  it("accepts a minimal { to } payload", () => {
    const result = parseUnsignedTx(JSON.stringify({ to: TO }));
    expect(result).toEqual({ ok: true, tx: { to: TO } });
  });

  it("accepts numeric value/gas/fees", () => {
    const result = parseUnsignedTx(
      JSON.stringify({ to: TO, value: 0, gas: 21000 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tx.valueWei).toBe(0n);
    expect(result.tx.gas).toBe(21000n);
  });

  it("ignores unknown keys like from", () => {
    const result = parseUnsignedTx(
      JSON.stringify({ to: TO, from: "0xdead", extra: 1 }),
    );
    expect(result).toEqual({ ok: true, tx: { to: TO } });
  });

  it("rejects a bad address with a path-bearing error", () => {
    const result = parseUnsignedTx(JSON.stringify({ to: "0x123" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^to: /);
  });

  it("rejects odd-length data hex", () => {
    const result = parseUnsignedTx(JSON.stringify({ to: TO, data: "0xabc" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^data: /);
  });

  it("rejects a negative value", () => {
    const result = parseUnsignedTx(JSON.stringify({ to: TO, value: -5 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("value: must not be negative");
  });

  it("rejects a float nonce", () => {
    const result = parseUnsignedTx(JSON.stringify({ to: TO, nonce: 1.5 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^nonce: /);
  });

  it("rejects a non-integer numeric value", () => {
    const result = parseUnsignedTx(JSON.stringify({ to: TO, value: 1.5 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("value: must be an integer");
  });

  it("rejects non-JSON input", () => {
    const result = parseUnsignedTx("{not json");
    expect(result).toEqual({ ok: false, error: "invalid JSON" });
  });
});
