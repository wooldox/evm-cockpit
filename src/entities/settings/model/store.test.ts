import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "./store";
import type { Density } from "./store";

describe("settings store", () => {
  beforeEach(() =>
    useSettingsStore.setState({
      rpcOverrides: {},
      etherscanApiKey: "",
      density: "comfortable",
    }),
  );

  it("has correct initial state", () => {
    const s = useSettingsStore.getState();
    expect(s.rpcOverrides).toEqual({});
    expect(s.etherscanApiKey).toBe("");
    expect(s.density).toBe("comfortable");
  });

  it("setRpcOverride adds an entry", () => {
    useSettingsStore
      .getState()
      .setRpcOverride(1, "https://mainnet.example.com");
    expect(useSettingsStore.getState().rpcOverrides[1]).toBe(
      "https://mainnet.example.com",
    );
  });

  it("setRpcOverride updates an existing entry", () => {
    useSettingsStore.getState().setRpcOverride(1, "https://old.example.com");
    useSettingsStore.getState().setRpcOverride(1, "https://new.example.com");
    expect(useSettingsStore.getState().rpcOverrides[1]).toBe(
      "https://new.example.com",
    );
  });

  it("clearRpcOverride removes an entry", () => {
    useSettingsStore
      .getState()
      .setRpcOverride(1, "https://mainnet.example.com");
    useSettingsStore
      .getState()
      .setRpcOverride(137, "https://polygon.example.com");
    useSettingsStore.getState().clearRpcOverride(1);
    expect(useSettingsStore.getState().rpcOverrides[1]).toBeUndefined();
    expect(useSettingsStore.getState().rpcOverrides[137]).toBe(
      "https://polygon.example.com",
    );
  });

  it("clearRpcOverride is a no-op for unknown chainId", () => {
    useSettingsStore
      .getState()
      .setRpcOverride(1, "https://mainnet.example.com");
    useSettingsStore.getState().clearRpcOverride(999);
    expect(Object.keys(useSettingsStore.getState().rpcOverrides)).toHaveLength(
      1,
    );
  });

  it("setEtherscanApiKey persists the key", () => {
    useSettingsStore.getState().setEtherscanApiKey("MY_KEY_123");
    expect(useSettingsStore.getState().etherscanApiKey).toBe("MY_KEY_123");
  });

  it("setDensity updates density", () => {
    useSettingsStore.getState().setDensity("compact");
    expect(useSettingsStore.getState().density).toBe<Density>("compact");
  });

  it("setDensity can toggle back to comfortable", () => {
    useSettingsStore.getState().setDensity("compact");
    useSettingsStore.getState().setDensity("comfortable");
    expect(useSettingsStore.getState().density).toBe<Density>("comfortable");
  });

  it("setRpcOverride does not clobber other chains", () => {
    useSettingsStore
      .getState()
      .setRpcOverride(1, "https://mainnet.example.com");
    useSettingsStore
      .getState()
      .setRpcOverride(137, "https://polygon.example.com");
    useSettingsStore
      .getState()
      .setRpcOverride(10, "https://optimism.example.com");
    const overrides = useSettingsStore.getState().rpcOverrides;
    expect(Object.keys(overrides)).toHaveLength(3);
    expect(overrides[1]).toBe("https://mainnet.example.com");
    expect(overrides[137]).toBe("https://polygon.example.com");
    expect(overrides[10]).toBe("https://optimism.example.com");
  });
});
