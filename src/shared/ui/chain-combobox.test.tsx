import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChainCombobox } from "./chain-combobox";
import type { TPickerChain } from "./chain-picker";

const ENTRIES: TPickerChain[] = [
  { id: 1, name: "Ethereum", short: "ETH", color: "#5b8def" },
  { id: 8453, name: "Base", short: "BASE", color: "#3aa675" },
  { id: 137, name: "Polygon", short: "POL", color: "#a05ad6" },
  { id: 31337, name: "Localhost · Anvil", short: "DEV", color: "#6b7682" },
];

function renderCombobox(value = 1) {
  const onChange = vi.fn();
  render(
    <ChainCombobox
      value={value}
      onChange={onChange}
      entries={ENTRIES}
      aria-label="Chain"
    />,
  );
  return { onChange };
}

describe("ChainCombobox", () => {
  it("trigger shows the selected chain name + id and combobox role", () => {
    renderCombobox(8453);
    const trigger = screen.getByRole("combobox", { name: "Chain" });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Base");
    expect(trigger).toHaveTextContent("8453");
  });

  it("falls back to 'Chain <id>' when the value is unknown", () => {
    renderCombobox(99999);
    expect(screen.getByRole("combobox", { name: "Chain" })).toHaveTextContent(
      "Chain 99999",
    );
  });

  it("opens on click with the search focused", async () => {
    renderCombobox(1);
    await userEvent.click(screen.getByRole("combobox", { name: "Chain" }));
    expect(
      screen.getByRole("textbox", { name: /search networks/i }),
    ).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Chain" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("search → select fires onChange with the id and closes", async () => {
    const { onChange } = renderCombobox(1);
    await userEvent.click(screen.getByRole("combobox", { name: "Chain" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "Local",
    );
    const listbox = screen.getByRole("listbox");
    await userEvent.click(
      within(listbox).getByText(
        (_t, el) =>
          el?.tagName === "SPAN" && el.textContent === "Localhost · Anvil",
      ),
    );
    expect(onChange).toHaveBeenCalledWith(31337);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape", async () => {
    renderCombobox(1);
    await userEvent.click(screen.getByRole("combobox", { name: "Chain" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "{Escape}",
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on an outside mousedown", async () => {
    renderCombobox(1);
    await userEvent.click(screen.getByRole("combobox", { name: "Chain" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // Regression: inside a Modal, the modal content stops mousedown propagation
  // (to guard its backdrop-close). A bubble-phase outside listener would never
  // fire; the capture-phase listener must still close the popover.
  it("closes on an outside click even when an ancestor stops mousedown propagation", async () => {
    const onChange = vi.fn();
    render(
      <div onMouseDown={(e) => e.stopPropagation()}>
        <ChainCombobox
          value={1}
          onChange={onChange}
          entries={ENTRIES}
          aria-label="Chain"
        />
        <button type="button">outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Chain" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
