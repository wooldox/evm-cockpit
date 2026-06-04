import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/shared/ui";
import { AppShellProvider } from "@/widgets/app-shell/AppShellProvider";
import { useContractsStore } from "@/entities/contract/model/store";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import type { TContract } from "@/entities/contract/model/types";
import { ContractBrowser } from "./ContractBrowser";

/* ── next/navigation mock ───────────────────────────────── */
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("c=test1"),
}));

/* ── hoist-safe mock clients ────────────────────────────── */
const { mockClient } = vi.hoisted(() => {
  const mockClient = {
    multicall: vi.fn(),
    readContract: vi.fn(),
  };
  return { mockClient };
});

vi.mock("@/app/web3/services", () => ({
  viemRpc: { getClient: () => mockClient },
  abiResolver: { fetchAbi: vi.fn() },
}));

/* ── contract fixtures ───────────────────────────────────── */
const ADDR = "0x1234567890123456789012345678901234567890" as const;

const baseContract: TContract = {
  id: "test1",
  name: "USD Coin",
  chainId: 1,
  address: ADDR,
  abi: erc20Abi,
  source: "sourcify",
  addedAt: 0,
};

const proxyContract: TContract = {
  ...baseContract,
  proxy: {
    kind: "eip1967",
    implAddress: "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
    // no implAbi
  },
};

/* ── multicall default response (3 zero-input view fns: name, decimals, totalSupply) ── */
const MULTICALL_RESULTS = [
  { status: "success" as const, result: "USD Coin" },
  { status: "success" as const, result: 6 },
  { status: "success" as const, result: 24891003472n },
];

/* ── render helper ───────────────────────────────────────── */
function renderBrowser(contract: TContract, onRemoved = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AppShellProvider>
          <ContractBrowser contract={contract} onRemoved={onRemoved} />
        </AppShellProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/* ── tests ───────────────────────────────────────────────── */
describe("ContractBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.multicall.mockResolvedValue(MULTICALL_RESULTS);
    mockClient.readContract.mockResolvedValue(1000n);
    useContractsStore.setState({ contracts: [baseContract] });
  });

  /* 1. Header ──────────────────────────────────────────── */
  it("shows contract name, source badge, and proxy row when proxy is set", () => {
    useContractsStore.setState({ contracts: [proxyContract] });
    renderBrowser(proxyContract);

    // contract name in h1
    expect(
      screen.getByRole("heading", { name: /USD Coin/i }),
    ).toBeInTheDocument();

    // source badge
    expect(screen.getByText("sourcify")).toBeInTheDocument();

    // proxy section: "implementation ABI unavailable"
    expect(
      screen.getByText(/implementation ABI unavailable/i),
    ).toBeInTheDocument();
  });

  /* 2. Properties ──────────────────────────────────────── */
  it("renders multicalled property values after loading", async () => {
    renderBrowser(baseContract);

    // wait for totalSupply bigint to render (definitive proof multicall resolved)
    // fmtBig(24891003472n) → "24,891,003,472"
    await screen.findByText("24,891,003,472");

    // The properties grid renders all three values from multicall
    // name = "USD Coin" (appears twice: header h1 + properties row, use getAllByText)
    const usdCoinNodes = screen.getAllByText("USD Coin");
    expect(usdCoinNodes.length).toBeGreaterThan(0);
  });

  /* 3. Getter call ─────────────────────────────────────── */
  it("validates args before calling, then calls with valid address", async () => {
    const user = userEvent.setup();
    renderBrowser(baseContract);

    // Expand the balanceOf card by clicking its header button
    const balanceOfBtn = await screen.findByRole("button", {
      name: /balanceOf/i,
    });
    await user.click(balanceOfBtn);

    // The param input for "owner" should now be visible
    const ownerInput = screen.getByPlaceholderText(
      "0x0000000000000000000000000000000000000000",
    );

    // Type an invalid address
    await user.type(ownerInput, "notanaddress");

    // Click Call
    const callBtn = screen.getByRole("button", { name: /^Call$/i });
    await user.click(callBtn);

    // Arg error should appear; readContract NOT called
    await screen.findByText(/invalid address/i);
    expect(mockClient.readContract).not.toHaveBeenCalled();

    // Clear and paste a valid address
    await user.clear(ownerInput);
    const validAddr = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    await user.paste(validAddr);

    await user.click(callBtn);

    // Wait for the result to appear: 1000n → "1,000"
    await screen.findByText("1,000");
    expect(mockClient.readContract).toHaveBeenCalledOnce();
  });

  /* 4. Search / filter ─────────────────────────────────── */
  it("filters functions by search query and shows empty state for gibberish", async () => {
    const user = userEvent.setup();
    renderBrowser(baseContract);

    // Wait for initial render to settle (properties loaded)
    await screen.findByText("USD Coin");

    const filterInput = screen.getByPlaceholderText(
      /Filter functions across all sections/i,
    );

    // Type "balanceof" — properties section should hide (name/decimals/totalSupply filtered out)
    // but balanceOf getter card should remain
    await user.type(filterInput, "balanceof");

    // The balanceOf card should be visible
    await waitFor(() => {
      expect(screen.getByText("balanceOf")).toBeInTheDocument();
    });

    // Properties (name, decimals, totalSupply) should be filtered out
    // The section renders filtered rows, which means these fn names are gone
    await waitFor(() => {
      expect(screen.queryByText("name")).not.toBeInTheDocument();
      expect(screen.queryByText("decimals")).not.toBeInTheDocument();
      expect(screen.queryByText("totalSupply")).not.toBeInTheDocument();
    });

    // Now type gibberish to replace the current filter
    await user.clear(filterInput);
    await user.type(filterInput, "zzzz");

    // Empty state should appear
    await screen.findByText(/No functions match/i);
  });

  /* 5. Remove ──────────────────────────────────────────── */
  it("removes the contract and calls onRemoved when confirmed", async () => {
    const user = userEvent.setup();
    const onRemoved = vi.fn();
    useContractsStore.setState({ contracts: [baseContract] });
    renderBrowser(baseContract, onRemoved);

    // Mock window.confirm to return true
    vi.spyOn(window, "confirm").mockReturnValue(true);

    // Click the trash/remove button (title="Remove")
    const removeBtn = screen.getByTitle("Remove");
    await user.click(removeBtn);

    // Store should be empty
    expect(useContractsStore.getState().contracts).toHaveLength(0);

    // onRemoved callback should be called
    expect(onRemoved).toHaveBeenCalledOnce();
  });
});
