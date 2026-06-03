import { describe, it, expect } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy classes and drops falsy", () => {
    expect(cx("a", false, "b", undefined, null, "c")).toBe("a b c");
  });

  it("includes numbers and empty string behaves as falsy-coercion (filter(Boolean))", () => {
    // number 0 is falsy, positive numbers are truthy
    expect(cx("a", 0 as unknown as number, 1 as unknown as number)).toBe("a 1");
  });
});
