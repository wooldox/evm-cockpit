import { describe, it, expect } from "vitest";
import { getEffectiveAbi, getBrowserSections } from "./effectiveAbi";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import { categorizeAbi } from "@/shared/lib/abi/categorize";
import type { TContract } from "@/entities/contract/model/types";

const ADDR = "0x1234567890123456789012345678901234567890" as const;

function makeContract(overrides?: Partial<TContract>): TContract {
  return {
    id: "test-id",
    name: "TestToken",
    chainId: 1,
    address: ADDR,
    abi: erc20Abi,
    source: "manual",
    addedAt: 0,
    ...overrides,
  };
}

describe("getEffectiveAbi", () => {
  it("returns contract.abi when no proxy", () => {
    const c = makeContract();
    expect(getEffectiveAbi(c)).toBe(c.abi);
  });

  it("returns contract.abi when proxy has no implAbi", () => {
    const c = makeContract({
      proxy: {
        kind: "eip1967",
        implAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
    });
    expect(getEffectiveAbi(c)).toBe(c.abi);
  });

  it("merges abi + proxy.implAbi when both present", () => {
    const c = makeContract({
      proxy: {
        kind: "eip1967",
        implAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        implAbi: erc20Abi,
      },
    });
    const result = getEffectiveAbi(c);
    expect(result).toHaveLength(erc20Abi.length * 2);
  });
});

describe("getBrowserSections", () => {
  it("no proxy → same counts as categorizeAbi(erc20Abi)", () => {
    const c = makeContract();
    const sections = getBrowserSections(c);
    const expected = categorizeAbi(erc20Abi);

    expect(sections.properties.length).toBe(expected.properties.length);
    expect(sections.getters.length).toBe(expected.getters.length);
    expect(sections.operations.length).toBe(expected.operations.length);
    expect(sections.events.length).toBe(expected.events.length);
  });

  it("with proxy.implAbi = erc20Abi → function counts double", () => {
    const c = makeContract({
      proxy: {
        kind: "eip1967",
        implAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        implAbi: erc20Abi,
      },
    });
    const sections = getBrowserSections(c);
    const base = categorizeAbi(erc20Abi);

    expect(sections.properties.length).toBe(base.properties.length * 2);
    expect(sections.getters.length).toBe(base.getters.length * 2);
    expect(sections.operations.length).toBe(base.operations.length * 2);
  });
});
