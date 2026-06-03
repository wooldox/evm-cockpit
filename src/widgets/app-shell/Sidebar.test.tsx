import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...p
  }: {
    href: string | object;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...p}>
      {children}
    </a>
  ),
}));

import { Sidebar } from "./Sidebar";
import { AppShellProvider } from "./AppShellProvider";
import { useContractsStore } from "@/entities/contract/model/store";
import type { TContract } from "@/entities/contract/model/types";

const mk = (id: string, name: string, chainId = 1): TContract => ({
  id,
  name,
  chainId,
  address: `0x${id.padStart(40, "0")}` as `0x${string}`,
  abi: [],
  source: "manual",
  addedAt: 0,
});

describe("Sidebar", () => {
  beforeEach(() => useContractsStore.setState({ contracts: [] }));

  it("shows the empty state with no contracts", () => {
    render(
      <AppShellProvider>
        <Sidebar />
      </AppShellProvider>,
    );
    expect(screen.getByText(/no saved contracts/i)).toBeInTheDocument();
  });

  it("renders a seeded contract grouped by chain", () => {
    useContractsStore.setState({ contracts: [mk("1", "USD Coin")] });
    render(
      <AppShellProvider>
        <Sidebar />
      </AppShellProvider>,
    );
    expect(screen.getByText("USD Coin")).toBeInTheDocument();
    // Chain group header shows the chain name — chainId 1 = "Ethereum"
    // (may appear in multiple nodes: scope tab + group header)
    expect(screen.getAllByText(/ethereum/i).length).toBeGreaterThan(0);
  });
});
