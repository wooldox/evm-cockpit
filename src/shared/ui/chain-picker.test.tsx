import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChainPickerPanel } from "./chain-picker";
import type { TPickerChain } from "./chain-picker";

const ENTRIES: TPickerChain[] = [
  { id: 1, name: "Ethereum", short: "ETH", color: "#5b8def" },
  { id: 8453, name: "Base", short: "BASE", color: "#3aa675" },
  { id: 137, name: "Polygon", short: "POL", color: "#a05ad6" },
];

function renderPanel(extra?: Partial<Parameters<typeof ChainPickerPanel>[0]>) {
  const onSelect = vi.fn();
  const onRequestClose = vi.fn();
  render(
    <ChainPickerPanel
      entries={ENTRIES}
      value={1}
      onSelect={onSelect}
      onRequestClose={onRequestClose}
      {...extra}
    />,
  );
  return { onSelect, onRequestClose };
}

describe("ChainPickerPanel", () => {
  it("shows the full count and a listbox of all entries", () => {
    renderPanel();
    expect(screen.getByText("3 total")).toBeInTheDocument();
    expect(
      within(screen.getByRole("listbox")).getByText("Ethereum"),
    ).toBeInTheDocument();
  });

  it("filters by name and highlights the match", async () => {
    renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "Base",
    );
    const listbox = screen.getByRole("listbox");
    expect(
      within(listbox).getByText(
        (_t, el) => el?.tagName === "SPAN" && el.textContent === "Base",
      ),
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByText(
        (_t, el) => el?.tagName === "SPAN" && el.textContent === "Ethereum",
      ),
    ).toBeNull();
    expect(listbox.querySelector("mark")).not.toBeNull();
  });

  it("filters by numeric chain id", async () => {
    renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "137",
    );
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Polygon")).toBeInTheDocument();
  });

  it("selects via ArrowDown + Enter", async () => {
    const { onSelect } = renderPanel();
    const search = screen.getByRole("textbox", { name: /search networks/i });
    // first row Ethereum (active 0); ArrowDown → Base (8453)
    await userEvent.type(search, "{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(8453);
  });

  it("Esc asks the owner to close", async () => {
    const { onRequestClose } = renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "{Escape}",
    );
    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it("renders a notice and footer when provided", () => {
    renderPanel({
      notice: "showing built-in networks",
      footer: <div>FOOTER</div>,
    });
    expect(screen.getByText("showing built-in networks")).toBeInTheDocument();
    expect(screen.getByText("FOOTER")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "zzzzz",
    );
    expect(screen.getByText(/no networks match/i)).toBeInTheDocument();
  });
});
