import { describe, it, expect, beforeEach } from "vitest";
import { useRerunStore, type TRerunIntent } from "./store";

const intent: TRerunIntent = {
  contractId: "a",
  fnName: "balanceOf",
  argCount: 1,
  args: { owner: "0xabc" },
  type: "read",
};

describe("rerun store", () => {
  beforeEach(() => useRerunStore.setState({ intent: null }));

  it("request stores the intent", () => {
    useRerunStore.getState().request(intent);
    expect(useRerunStore.getState().intent).toEqual(intent);
  });

  it("consume returns the intent and clears it", () => {
    useRerunStore.getState().request(intent);
    const got = useRerunStore.getState().consume();
    expect(got).toEqual(intent);
    expect(useRerunStore.getState().intent).toBeNull();
  });

  it("consume on an empty store returns null", () => {
    expect(useRerunStore.getState().consume()).toBeNull();
  });
});
