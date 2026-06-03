import { describe, it, expect, vi } from "vitest";
import { createAbiResolver } from "./abi-resolver";
import type { AbiSource, AbiFetchResult } from "@/shared/ports/abi-source";

const MOCK_ABI = [
  {
    type: "function" as const,
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view" as const,
  },
] satisfies import("abitype").Abi;

function makeSource(
  result: AbiFetchResult,
): AbiSource & { fetchAbi: ReturnType<typeof vi.fn> } {
  return { fetchAbi: vi.fn().mockResolvedValue(result) };
}

describe("createAbiResolver", () => {
  it("returns the sourcify result immediately when it succeeds (short-circuit)", async () => {
    const sourcify = makeSource({
      ok: true,
      abi: MOCK_ABI,
      source: "sourcify",
    });
    const etherscan = makeSource({
      ok: true,
      abi: MOCK_ABI,
      source: "etherscan",
    });

    const resolver = createAbiResolver([sourcify, etherscan]);
    const result = await resolver.fetchAbi(1, "0xabc");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("sourcify");
    }
    expect(sourcify.fetchAbi).toHaveBeenCalledOnce();
    expect(etherscan.fetchAbi).not.toHaveBeenCalled();
  });

  it("falls through to etherscan when sourcify misses", async () => {
    const sourcify = makeSource({
      ok: false,
      error: "Sourcify HTTP 404: Not Found",
    });
    const etherscan = makeSource({
      ok: true,
      abi: MOCK_ABI,
      source: "etherscan",
    });

    const resolver = createAbiResolver([sourcify, etherscan]);
    const result = await resolver.fetchAbi(1, "0xabc");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("etherscan");
      expect(result.abi).toEqual(MOCK_ABI);
    }
    expect(sourcify.fetchAbi).toHaveBeenCalledOnce();
    expect(etherscan.fetchAbi).toHaveBeenCalledOnce();
  });

  it("returns combined error when all sources fail", async () => {
    const sourcify = makeSource({
      ok: false,
      error: "Sourcify HTTP 404: Not Found",
    });
    const etherscan = makeSource({ ok: false, error: "no Etherscan API key" });

    const resolver = createAbiResolver([sourcify, etherscan]);
    const result = await resolver.fetchAbi(1, "0xabc");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Sourcify HTTP 404: Not Found");
      expect(result.error).toContain("no Etherscan API key");
    }
  });

  it("works with a single source", async () => {
    const sourcify = makeSource({
      ok: true,
      abi: MOCK_ABI,
      source: "sourcify",
    });
    const resolver = createAbiResolver([sourcify]);
    const result = await resolver.fetchAbi(1, "0xabc");
    expect(result.ok).toBe(true);
  });

  it("returns error for empty sources array", async () => {
    const resolver = createAbiResolver([]);
    const result = await resolver.fetchAbi(1, "0xabc");
    expect(result.ok).toBe(false);
  });
});
