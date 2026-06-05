import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import { resetCatalog as resetStore } from "@/entities/chain/model/testing/resetCatalog";
import { AddChainModal } from "./AddChainModal";

function setup() {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(
    <ToastProvider>
      <AddChainModal onClose={onClose} onAdded={onAdded} />
    </ToastProvider>,
  );
  return { onClose, onAdded };
}

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/network name/i), "Testlandia");
  await userEvent.type(screen.getByLabelText(/chain id/i), "999777");
  await userEvent.type(
    screen.getByLabelText(/rpc url/i),
    "http://127.0.0.1:9999",
  );
  await userEvent.type(screen.getByLabelText(/currency symbol/i), "TLD");
}

describe("AddChainModal", () => {
  beforeEach(resetStore);

  it("Add chain is disabled until the form is valid", async () => {
    setup();
    expect(screen.getByRole("button", { name: /add chain/i })).toBeDisabled();
    await fillValid();
    expect(screen.getByRole("button", { name: /add chain/i })).toBeEnabled();
  });

  it("shows the duplicate-id error and keeps Add disabled", async () => {
    setup();
    await fillValid();
    await userEvent.clear(screen.getByLabelText(/chain id/i));
    await userEvent.type(screen.getByLabelText(/chain id/i), "1");
    expect(
      screen.getByText(/this chain id already exists/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add chain/i })).toBeDisabled();
  });

  it("strips non-digits typed into the chain id", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/chain id/i), "12ab3");
    expect(screen.getByLabelText(/chain id/i)).toHaveValue("123");
  });

  it("submits: adds to the catalog store, fires onAdded with the id, closes", async () => {
    const { onClose, onAdded } = setup();
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: /add chain/i }));
    expect(useChainCatalog.getState().byId.get(999777)?.source).toBe("custom");
    expect(onAdded).toHaveBeenCalledWith(999777);
    expect(onClose).toHaveBeenCalled();
  });

  it("the accent swatch updates the glyph preview color", async () => {
    setup();
    await fillValid();
    // Swatch buttons expose their hex as the accessible name (via title).
    const swatches = screen.getAllByRole("button", { name: /^#/ });
    expect(swatches).toHaveLength(8);
    await userEvent.click(swatches[7]!);
    // glyph shows the symbol's first letter on the chosen color
    const glyph = screen.getByText("T", { selector: "span" });
    expect(glyph).toHaveStyle({ background: "#22c55e" });
  });

  it("Cancel closes without adding", async () => {
    const { onClose } = setup();
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(useChainCatalog.getState().byId.has(999777)).toBe(false);
  });
});
