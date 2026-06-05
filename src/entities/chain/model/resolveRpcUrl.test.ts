import { describe, it, expect } from "vitest";
import { resolveRpcUrl } from "./resolveRpcUrl";
import { DEFAULT_RPC_URLS } from "./chains";

describe("resolveRpcUrl", () => {
  it("uses the user override when present", () => {
    expect(resolveRpcUrl(1, { 1: "https://my.rpc" })).toBe("https://my.rpc");
  });

  it("falls back to the curated default when no override", () => {
    expect(resolveRpcUrl(1, {})).toBe(DEFAULT_RPC_URLS[1]);
  });

  it("returns undefined for an unknown chain with no override", () => {
    expect(resolveRpcUrl(999999, {})).toBeUndefined();
  });

  it("treats an empty-string override as absent (falls through to curated)", () => {
    expect(resolveRpcUrl(1, { 1: "" })).toBe(DEFAULT_RPC_URLS[1]);
  });

  it("treats a whitespace-only override as absent (falls through to curated)", () => {
    expect(resolveRpcUrl(1, { 1: "   " })).toBe(DEFAULT_RPC_URLS[1]);
  });

  it("returns undefined for an unknown chain with an empty override", () => {
    expect(resolveRpcUrl(999999, { 999999: "  " })).toBeUndefined();
  });

  it("falls back to the first catalog RPC for a chain with no curated default", () => {
    expect(
      resolveRpcUrl(999999, {}, ["https://a.example", "https://b.example"]),
    ).toBe("https://a.example");
  });

  it("prefers the override over the catalog RPCs", () => {
    expect(
      resolveRpcUrl(999999, { 999999: "https://my.rpc" }, ["https://a"]),
    ).toBe("https://my.rpc");
  });

  it("prefers the curated default over the catalog RPCs", () => {
    expect(resolveRpcUrl(1, {}, ["https://a.example"])).toBe(
      DEFAULT_RPC_URLS[1],
    );
  });

  it("returns undefined when catalog RPCs are empty", () => {
    expect(resolveRpcUrl(999999, {}, [])).toBeUndefined();
  });
});
