import { describe, it, expect } from "vitest";
import type { AbiFunction } from "abitype";
import { parseOperationInputs } from "./parseOperationInputs";

const transfer: AbiFunction = {
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
};

const deposit: AbiFunction = {
  type: "function",
  name: "deposit",
  stateMutability: "payable",
  inputs: [],
  outputs: [],
};

const ADDR = "0x1111111111111111111111111111111111111111";

describe("parseOperationInputs", () => {
  it("parses valid args (positional, in input order)", () => {
    const r = parseOperationInputs(transfer, { to: ADDR, amount: "5" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.args).toEqual([ADDR, 5n]);
    expect(r.value).toBeUndefined();
  });

  it("keys unnamed inputs by positional index", () => {
    // Truly nameless inputs (name === undefined) fall back to String(i), the
    // same keying the UI uses (p.name ?? String(i)) so form keys and parsed
    // args stay aligned. ABIs that carry name: "" key by that empty string
    // instead — matching the UI's identical fallback — so the two never diverge.
    const fn: AbiFunction = {
      ...transfer,
      inputs: [
        { type: "address" } as AbiFunction["inputs"][number],
        { type: "uint256" } as AbiFunction["inputs"][number],
      ],
    };
    const r = parseOperationInputs(fn, { "0": ADDR, "1": "7" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.args).toEqual([ADDR, 7n]);
  });

  it("collects per-field arg errors and reports ok:false", () => {
    const r = parseOperationInputs(transfer, { to: "nope", amount: "x" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(Object.keys(r.argErrors)).toEqual(["to", "amount"]);
    expect(r.valueError).toBeUndefined();
  });

  it("parses a payable value via the unit", () => {
    const r = parseOperationInputs(deposit, {}, { amount: "1", unit: "ether" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value).toBe(1_000_000_000_000_000_000n);
  });

  it("treats empty / '0' value as no value", () => {
    const a = parseOperationInputs(deposit, {}, { amount: "", unit: "ether" });
    const b = parseOperationInputs(deposit, {}, { amount: "0", unit: "ether" });
    expect(a.ok && a.value).toBeUndefined();
    expect(b.ok && b.value).toBeUndefined();
  });

  it("reports a valueError for an unparseable amount", () => {
    const r = parseOperationInputs(
      deposit,
      {},
      { amount: "1.2.3", unit: "ether" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.valueError).toBeTruthy();
  });
});
