import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { useContractsStore } from "@/entities/contract/model/store";
import { AddContractModal } from "./AddContractModal";

// next/navigation is used transitively by some imports
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ABI =
  '[{"type":"function","name":"x","inputs":[],"outputs":[],"stateMutability":"view"}]';

function renderModal(onClose = vi.fn()) {
  return render(
    <ToastProvider>
      <AddContractModal onClose={onClose} />
    </ToastProvider>,
  );
}

describe("AddContractModal", () => {
  beforeEach(() => {
    useContractsStore.setState({ contracts: [] });
  });

  // ── 1. Manual mode: invalid ABI shows error and disables submit ──────────

  it("manual mode: invalid JSON ABI shows error and disables submit", async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    // Modal uses createPortal + useEffect mount gate → wait for it
    await screen.findByRole("dialog");

    // Switch to manual ABI mode (the Segment tab)
    await userEvent.click(screen.getByRole("tab", { name: /paste manually/i }));

    // Fill name
    await userEvent.type(
      screen.getByPlaceholderText(/my contract/i),
      "TestContract",
    );

    // Fill a valid Ethereum address (42 chars)
    await userEvent.type(
      screen.getByPlaceholderText(/0x0000000000000000000000000000000000000000/),
      VALID_ADDRESS,
    );

    // Type invalid JSON into the ABI textarea
    // Use paste to avoid userEvent treating { as a key descriptor
    const textarea = screen.getByPlaceholderText(/\[ \{ "type"/i);
    await userEvent.click(textarea);
    await userEvent.paste("not valid json {");

    // ABI error message should appear
    expect(screen.getByText(/abi must be valid json/i)).toBeInTheDocument();

    // Submit button ("Add contract") should be disabled
    const submitBtn = screen.getByRole("button", { name: /add contract/i });
    expect(submitBtn).toBeDisabled();
  });

  // ── 2. Manual happy path: valid inputs → store gains entry, onClose fires ─

  it("manual mode: valid inputs → adds contract with source:manual, fires onClose", async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    await screen.findByRole("dialog");

    // Switch to manual mode
    await userEvent.click(screen.getByRole("tab", { name: /paste manually/i }));

    // Fill name
    await userEvent.type(
      screen.getByPlaceholderText(/my contract/i),
      "MyToken",
    );

    // Fill valid address
    await userEvent.type(
      screen.getByPlaceholderText(/0x0000000000000000000000000000000000000000/),
      VALID_ADDRESS,
    );

    // Paste valid ABI JSON array into textarea
    // userEvent.type interprets { and [ as key descriptors — use paste instead
    const textarea = screen.getByPlaceholderText(/\[ \{ "type"/i);
    await userEvent.click(textarea);
    await userEvent.paste(VALID_ABI);

    // Submit button should now be enabled
    const submitBtn = screen.getByRole("button", { name: /add contract/i });
    expect(submitBtn).not.toBeDisabled();

    // Click submit
    await userEvent.click(submitBtn);

    // Store should have one contract with source: "manual"
    const contracts = useContractsStore.getState().contracts;
    expect(contracts).toHaveLength(1);
    const added = contracts[0]!;
    expect(added.source).toBe("manual");
    expect(added.name).toBe("MyToken");
    expect(added.address).toBe(VALID_ADDRESS);

    // onClose should have been called
    expect(onClose).toHaveBeenCalledOnce();
  });
});
