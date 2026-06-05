import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import { resetCatalog } from "@/entities/chain/model/testing/resetCatalog";
import { ChainSelector } from "./ChainSelector";

function resetCatalogStatus(status: "static" | "static-fallback" = "static") {
  resetCatalog();
  if (status !== "static") useChainCatalog.setState({ status });
}

function renderSelector(value = 1) {
  const onChange = vi.fn();
  render(
    <ToastProvider>
      <ChainSelector value={value} onChange={onChange} />
    </ToastProvider>,
  );
  return { onChange };
}

describe("ChainSelector", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    resetCatalogStatus();
  });

  it("trigger shows the current chain name", () => {
    renderSelector(1);
    expect(
      screen.getByRole("button", { name: /ethereum/i }),
    ).toBeInTheDocument();
  });

  it("opens with the search focused and a full-list count row", async () => {
    renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    const search = screen.getByRole("textbox", { name: /search networks/i });
    expect(search).toHaveFocus();
    const total = useChainCatalog.getState().entries.length;
    expect(screen.getByText(`${total} total`)).toBeInTheDocument();
  });

  it("narrows the list and highlights matches when typing a name", async () => {
    renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "Ethe",
    );
    const listbox = screen.getByRole("listbox");
    expect(
      within(listbox).getByText((_t, el) => el?.textContent === "Ethereum"),
    ).toBeInTheDocument();
    // Base should not match "Ethe"
    expect(
      within(listbox).queryByText(
        (_t, el) => el?.tagName === "SPAN" && el.textContent === "Base",
      ),
    ).toBeNull();
    // <mark> highlight present
    expect(listbox.querySelector("mark")).not.toBeNull();
  });

  it("matches by numeric chain id", async () => {
    renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "8453",
    );
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Base")).toBeInTheDocument();
  });

  it("selects via ArrowDown + Enter and closes", async () => {
    const { onChange } = renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    const search = screen.getByRole("textbox", { name: /search networks/i });
    // first row is Ethereum (active 0); ArrowDown → Base (id 8453)
    await userEvent.type(search, "{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith(8453);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape", async () => {
    renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "{Escape}",
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on an outside mousedown", async () => {
    renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("restores the empty query on reopen", async () => {
    renderSelector(1);
    const trigger = screen.getByRole("button", { name: /ethereum/i });
    await userEvent.click(trigger);
    await userEvent.type(
      screen.getByRole("textbox", { name: /search networks/i }),
      "Base",
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(trigger);
    expect(
      screen.getByRole("textbox", { name: /search networks/i }),
    ).toHaveValue("");
  });

  it("Add custom chain opens the modal (dropdown closes)", async () => {
    renderSelector();
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /add custom chain/i }),
    );
    // The shared Modal renders its title as a div (not a heading) but sets
    // role="dialog" — query the open modal by that role.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // the dropdown is gone
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("adding a chain selects it", async () => {
    const { onChange } = renderSelector();
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /add custom chain/i }),
    );
    await userEvent.type(screen.getByLabelText(/network name/i), "Testlandia");
    await userEvent.type(screen.getByLabelText(/chain id/i), "999777");
    await userEvent.type(
      screen.getByLabelText(/rpc url/i),
      "http://127.0.0.1:9999",
    );
    await userEvent.type(screen.getByLabelText(/currency symbol/i), "TLD");
    await userEvent.click(screen.getByRole("button", { name: /add chain/i }));
    expect(onChange).toHaveBeenCalledWith(999777);
    // modal closed
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the static-fallback notice when the catalog fell back", async () => {
    resetCatalogStatus("static-fallback");
    renderSelector(1);
    await userEvent.click(screen.getByRole("button", { name: /ethereum/i }));
    expect(
      screen.getByText(/showing built-in networks — full list unavailable/i),
    ).toBeInTheDocument();
  });
});
