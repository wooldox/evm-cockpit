import { describe, it, expect } from "vitest";
import { encodeFunctionData } from "viem";
import { encodeCall } from "./encodeArgs";
import { erc20Abi } from "@/shared/lib/abi/fixtures";

describe("encodeCall", () => {
  const to = "0x4E639304D9229AF411020C45b6b4c0ac105225c4";

  it("validates and encodes transfer(address,uint256)", () => {
    const result = encodeCall(erc20Abi, "transfer", [to, "100"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, 100n],
    });
    expect(result.data).toBe(expected);
  });

  it("returns a validation error for a bad address", () => {
    const result = encodeCall(erc20Abi, "transfer", ["0xbad", "100"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.index).toBe(0);
  });

  it("errors when the function does not exist", () => {
    const result = encodeCall(erc20Abi, "nonexistent", []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toContain("not found");
  });

  it("dispatches the 1-arg mint overload", () => {
    const result = encodeCall(erc20Abi, "mint", ["100"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = encodeFunctionData({
      abi: erc20Abi,
      functionName: "mint",
      args: [100n],
    });
    expect(result.data).toBe(expected);
  });

  it("dispatches the 2-arg mint overload", () => {
    const result = encodeCall(erc20Abi, "mint", [to, "100"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = encodeFunctionData({
      abi: erc20Abi,
      functionName: "mint",
      args: [to, 100n],
    });
    expect(result.data).toBe(expected);
  });
});
