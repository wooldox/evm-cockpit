import { describe, it, expect, vi, afterEach } from "vitest";
import { createEtherscanAbiSource } from "./etherscan";

const MOCK_ABI = [
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEtherscanAbiSource", () => {
  it("returns ok:false immediately when no API key is provided — fetch is NOT called", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const source = createEtherscanAbiSource(() => "");
    const result = await source.fetchAbi(
      1,
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/api key/i);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns ok+abi when status is '1' and result is a JSON ABI string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "1",
          message: "OK",
          result: JSON.stringify(MOCK_ABI),
        }),
      }),
    );

    const source = createEtherscanAbiSource(() => "MY_API_KEY");
    const result = await source.fetchAbi(
      1,
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("etherscan");
      expect(result.abi).toEqual(MOCK_ABI);
    }

    expect(fetch).toHaveBeenCalledWith(
      "https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getabi&address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&apikey=MY_API_KEY",
    );
  });

  it("returns ok:false when status is '0' (contract not verified)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "0",
          message: "NOTOK",
          result: "Contract source code not verified",
        }),
      }),
    );

    const source = createEtherscanAbiSource(() => "MY_API_KEY");
    const result = await source.fetchAbi(1, "0xdeadbeef");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not verified|NOTOK/i);
    }
  });

  it("returns ok:false with result text when rate-limited (result takes precedence over message)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "0",
          message: "NOTOK",
          result: "Max rate limit reached",
        }),
      }),
    );

    const source = createEtherscanAbiSource(() => "MY_API_KEY");
    const result = await source.fetchAbi(1, "0xdeadbeef");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Max rate limit reached");
    }
  });

  it("returns ok:false when fetch throws a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connection refused")),
    );

    const source = createEtherscanAbiSource(() => "MY_API_KEY");
    const result = await source.fetchAbi(1, "0xdeadbeef");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/connection refused/i);
    }
  });
});
