import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ToastProvider } from "@/shared/ui";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import type { TContract } from "@/entities/contract/model/types";
import { ContractHeader } from "./ContractHeader";

/* ── next/navigation mock ───────────────────────────────── */
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

/* ── app-shell mock (openEdit not exercised here) ───────── */
vi.mock("@/widgets/app-shell/AppShellProvider", () => ({
  useAppShell: () => ({ openEdit: vi.fn() }),
}));

const ADDR = "0x1234567890123456789012345678901234567890" as const;

const contract: TContract = {
  id: "abc123",
  name: "USD Coin",
  chainId: 1,
  address: ADDR,
  abi: erc20Abi,
  source: "sourcify",
  addedAt: 0,
};

beforeEach(() => {
  pushMock.mockClear();
});

describe("ContractHeader", () => {
  it("History button deep-links to /history?c=<id>", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ContractHeader contract={contract} onRemoved={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /History/ }));

    expect(pushMock).toHaveBeenCalledWith("/history?c=abc123");
  });
});
