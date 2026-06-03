import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useContractsStore } from "./store";
import type { TContract } from "./types";

const mk = (id: string, chainId = 1): TContract => ({
  id,
  name: `C${id}`,
  chainId,
  address: `0x${id.padStart(40, "0")}` as `0x${string}`,
  abi: [],
  source: "manual",
  addedAt: 0,
});

describe("contracts store", () => {
  beforeEach(() => useContractsStore.setState({ contracts: [] }));

  it("adds a contract", () => {
    useContractsStore.getState().add(mk("1"));
    expect(useContractsStore.getState().contracts).toHaveLength(1);
  });

  it("getById returns the contract", () => {
    useContractsStore.getState().add(mk("1"));
    expect(useContractsStore.getState().getById("1")?.name).toBe("C1");
  });

  it("updates a contract", () => {
    useContractsStore.getState().add(mk("1"));
    useContractsStore.getState().update("1", { name: "renamed" });
    expect(useContractsStore.getState().getById("1")?.name).toBe("renamed");
  });

  it("removes a contract", () => {
    useContractsStore.getState().add(mk("1"));
    useContractsStore.getState().remove("1");
    expect(useContractsStore.getState().contracts).toHaveLength(0);
  });

  it("adds, gets, updates, removes in sequence", () => {
    const s = useContractsStore.getState();
    s.add(mk("1"));
    expect(useContractsStore.getState().getById("1")?.name).toBe("C1");
    useContractsStore.getState().update("1", { name: "renamed" });
    expect(useContractsStore.getState().getById("1")?.name).toBe("renamed");
    useContractsStore.getState().remove("1");
    expect(useContractsStore.getState().contracts).toHaveLength(0);
  });

  it("getById returns undefined for missing id", () => {
    expect(useContractsStore.getState().getById("nope")).toBeUndefined();
  });

  it("update is a no-op for unknown id", () => {
    useContractsStore.getState().add(mk("1"));
    useContractsStore.getState().update("999", { name: "ghost" });
    expect(useContractsStore.getState().contracts).toHaveLength(1);
    expect(useContractsStore.getState().getById("1")?.name).toBe("C1");
  });

  it("stores multiple contracts", () => {
    useContractsStore.getState().add(mk("1"));
    useContractsStore.getState().add(mk("2", 137));
    useContractsStore.getState().add(mk("3", 10));
    expect(useContractsStore.getState().contracts).toHaveLength(3);
    expect(useContractsStore.getState().getById("2")?.chainId).toBe(137);
  });
});
