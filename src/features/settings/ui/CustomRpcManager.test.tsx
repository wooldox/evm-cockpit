import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSettingsStore } from "@/entities/settings/model/store";
import { CustomRpcManager } from "./CustomRpcManager";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const okTest = vi.fn(async () => ({
  ok: true as const,
  info: "block 21,000,000",
}));

function renderMgr(currentChainId = 1) {
  return render(
    <CustomRpcManager
      currentChainId={currentChainId}
      deps={{ testRpcFn: okTest }}
    />,
  );
}

describe("CustomRpcManager", () => {
  beforeEach(() => {
    useSettingsStore.setState({ rpcOverrides: {} });
    okTest.mockClear();
  });

  it("adds a custom RPC for the selected chain (defaults to current)", async () => {
    renderMgr(1); // Ethereum
    await userEvent.type(
      screen.getByLabelText(/custom rpc url/i),
      "https://eth.example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(useSettingsStore.getState().rpcOverrides[1]).toBe(
      "https://eth.example.com",
    );
    // a row now lists it
    expect(screen.getByText("https://eth.example.com")).toBeInTheDocument();
  });

  it("accepts a local http node URL (no dot required)", async () => {
    renderMgr(1);
    await userEvent.type(
      screen.getByLabelText(/custom rpc url/i),
      "http://127.0.0.1:8545",
    );
    expect(screen.getByRole("button", { name: /^add$/i })).toBeEnabled();
  });

  it("blocks a second RPC for a chain that already has one", async () => {
    useSettingsStore.setState({
      rpcOverrides: { 1: "https://old.example.com" },
    });
    renderMgr(1);
    await userEvent.type(
      screen.getByLabelText(/custom rpc url/i),
      "https://new.example.com",
    );
    expect(
      screen.getByText(/already have an RPC for Ethereum/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();
  });

  it("removes a custom RPC (delete control is always present, no hover)", async () => {
    useSettingsStore.setState({
      rpcOverrides: { 1: "https://eth.example.com" },
    });
    renderMgr(1);
    const remove = screen.getByRole("button", {
      name: /remove rpc for ethereum/i,
    });
    expect(remove).toBeInTheDocument();
    await userEvent.click(remove);
    expect(useSettingsStore.getState().rpcOverrides[1]).toBeUndefined();
    expect(screen.queryByText("https://eth.example.com")).toBeNull();
  });

  it("tests a custom RPC and shows the result", async () => {
    useSettingsStore.setState({
      rpcOverrides: { 1: "https://eth.example.com" },
    });
    renderMgr(1);
    await userEvent.click(screen.getByRole("button", { name: /^test$/i }));
    expect(okTest).toHaveBeenCalledWith("https://eth.example.com");
    expect(await screen.findByText(/block 21,000,000/)).toBeInTheDocument();
  });

  it("shows the empty state when there are no custom RPCs", () => {
    renderMgr(1);
    expect(screen.getByText(/no custom rpcs yet/i)).toBeInTheDocument();
  });

  it("lists overrides for chains other than the selected one", () => {
    useSettingsStore.setState({
      rpcOverrides: { 8453: "https://base.example.com" },
    });
    renderMgr(1); // selected = Ethereum, but the Base override still lists
    const row = screen.getByText("https://base.example.com").closest("div")!;
    expect(within(row).getByText("Base")).toBeInTheDocument();
  });
});
