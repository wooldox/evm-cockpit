import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { useContractsStore } from "@/entities/contract/model/store";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import { toSharePayload } from "@/shared/lib/share/codec";
import type { TContract } from "@/entities/contract/model/types";
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

  // ── 3. Import file: valid export prefills the form + activates manual tab ──

  it("import file: valid export prefills fields and switches to manual tab", async () => {
    renderModal();
    await screen.findByRole("dialog");

    const exportContract: TContract = {
      id: "x",
      name: "Imported Token",
      chainId: 137,
      address: VALID_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      source: "manual",
      addedAt: 0,
    };
    const json = JSON.stringify(toSharePayload(exportContract), null, 2);
    const file = new File([json], "export.contract.json", {
      type: "application/json",
    });

    const input = screen.getByLabelText(/import contract export file/i);
    await userEvent.upload(input, file);

    // Name prefilled
    await waitFor(() =>
      expect(screen.getByDisplayValue("Imported Token")).toBeInTheDocument(),
    );
    // Address prefilled
    expect(screen.getByDisplayValue(VALID_ADDRESS)).toBeInTheDocument();
    // Manual tab is active → ABI textarea is shown with the ABI JSON
    const textarea = screen.getByPlaceholderText(/\[ \{ "type"/i);
    expect((textarea as HTMLTextAreaElement).value).toContain('"type"');
  });

  it("import file: a proxy contract export is preserved on save", async () => {
    renderModal();
    await screen.findByRole("dialog");

    const implAddress =
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;
    const exportContract: TContract = {
      id: "x",
      name: "Proxy Token",
      chainId: 1,
      address: VALID_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      source: "manual",
      proxy: {
        kind: "eip1967",
        implAddress,
        implAbi: erc20Abi,
      },
      addedAt: 0,
    };
    const json = JSON.stringify(toSharePayload(exportContract), null, 2);
    const file = new File([json], "export.contract.json", {
      type: "application/json",
    });

    const input = screen.getByLabelText(/import contract export file/i);
    await userEvent.upload(input, file);

    // Wait for prefill to land, then save.
    await waitFor(() =>
      expect(screen.getByDisplayValue("Proxy Token")).toBeInTheDocument(),
    );
    const submitBtn = screen.getByRole("button", { name: /add contract/i });
    await userEvent.click(submitBtn);

    const added = useContractsStore.getState().contracts[0]!;
    expect(added.proxy).toEqual({
      kind: "eip1967",
      implAddress,
      implAbi: erc20Abi,
    });
  });

  it("import file: editing the address after import drops the proxy", async () => {
    renderModal();
    await screen.findByRole("dialog");

    const exportContract: TContract = {
      id: "x",
      name: "Proxy Token",
      chainId: 1,
      address: VALID_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      source: "manual",
      proxy: {
        kind: "eip1967",
        implAddress:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        implAbi: erc20Abi,
      },
      addedAt: 0,
    };
    const json = JSON.stringify(toSharePayload(exportContract), null, 2);
    const file = new File([json], "export.contract.json", {
      type: "application/json",
    });

    const input = screen.getByLabelText(/import contract export file/i);
    await userEvent.upload(input, file);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Proxy Token")).toBeInTheDocument(),
    );

    // Edit the address → the imported proxy becomes stale and is dropped.
    const otherAddress = "0x9999999999999999999999999999999999999999";
    const addrInput = screen.getByDisplayValue(VALID_ADDRESS);
    await userEvent.clear(addrInput);
    await userEvent.paste(otherAddress);

    const submitBtn = screen.getByRole("button", { name: /add contract/i });
    await userEvent.click(submitBtn);

    const added = useContractsStore.getState().contracts[0]!;
    expect(added.address).toBe(otherAddress);
    expect(added.proxy).toBeUndefined();
  });

  it("import file: invalid file shows error and leaves fields untouched", async () => {
    renderModal();
    await screen.findByRole("dialog");

    const file = new File(["{ not a valid export }"], "bad.json", {
      type: "application/json",
    });
    const input = screen.getByLabelText(/import contract export file/i);
    await userEvent.upload(input, file);

    expect(
      await screen.findByText(/not a valid contract export/i),
    ).toBeInTheDocument();

    // Name field still empty (untouched)
    const nameInput = screen.getByPlaceholderText(
      /my contract/i,
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("");
  });
});
