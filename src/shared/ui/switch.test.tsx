import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

describe("Switch", () => {
  it("reflects checked and reports the new value when toggled", async () => {
    const onChange = vi.fn();
    // Switch wraps a hidden checkbox in a <label> with no spread props,
    // so we query by role only (no accessible name available).
    render(<Switch checked={false} onChange={onChange} />);
    const cb = screen.getByRole("checkbox");
    expect(cb).not.toBeChecked();
    await userEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
