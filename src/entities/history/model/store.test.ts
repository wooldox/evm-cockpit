import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore, record, MAX_ENTRIES } from "./store";
import type { THistoryEntry } from "./types";

const mk = (id: string, contractId = "c1"): THistoryEntry => ({
  id,
  contractId,
  chainId: 1,
  type: "read",
  fnName: "balanceOf",
  args: {},
  status: "ok",
  timestamp: Number(id) || 0,
});

describe("history store", () => {
  beforeEach(() => useHistoryStore.setState({ entries: [] }));

  it("prepends added entries (newest first)", () => {
    useHistoryStore.getState().add(mk("1"));
    useHistoryStore.getState().add(mk("2"));
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).toBe("2");
    expect(entries[1]?.id).toBe("1");
  });

  it("caps at MAX_ENTRIES, evicting the oldest", () => {
    for (let i = 1; i <= MAX_ENTRIES + 5; i++) {
      useHistoryStore.getState().add(mk(String(i)));
    }
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(MAX_ENTRIES);
    // newest survives at the front
    expect(entries[0]?.id).toBe(String(MAX_ENTRIES + 5));
    // first-added (oldest) is gone
    expect(entries.some((e) => e.id === "1")).toBe(false);
  });

  it("clear empties the list", () => {
    useHistoryStore.getState().add(mk("1"));
    useHistoryStore.getState().clear();
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("clearForContract removes only matching entries", () => {
    useHistoryStore.getState().add(mk("1", "a"));
    useHistoryStore.getState().add(mk("2", "b"));
    useHistoryStore.getState().add(mk("3", "a"));
    useHistoryStore.getState().clearForContract("a");
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.contractId).toBe("b");
  });

  it("record fills id and timestamp then adds", () => {
    const before = Date.now();
    record({
      contractId: "c1",
      chainId: 1,
      type: "read",
      fnName: "name",
      args: {},
      status: "ok",
      result: '"Token"',
    });
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.id).toBeTruthy();
    expect(typeof entry.id).toBe("string");
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.result).toBe('"Token"');
  });
});
