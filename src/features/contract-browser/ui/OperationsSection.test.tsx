import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  encodeErrorResult,
  type PublicClient,
} from "viem";
import { ToastProvider } from "@/shared/ui";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import type { THistoryEntry } from "@/entities/history/model/types";
import { OperationsSection } from "./OperationsSection";

const ADDR = "0x1234567890123456789012345678901234567890" as const;
const ACCOUNT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

/* ── controllable wagmi stubs ───────────────────────────── */
let accountStub: {
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  isConnected: boolean;
};
let switchChainAsync: ReturnType<typeof vi.fn>;
let writeContractAsync: ReturnType<typeof vi.fn>;

vi.mock("wagmi", () => ({
  useAccount: () => accountStub,
  useSwitchChain: () => ({ switchChainAsync }),
  useWriteContract: () => ({ writeContractAsync }),
}));

const baseContract: TContract = {
  id: "test1",
  name: "USD Coin",
  chainId: 1,
  address: ADDR,
  abi: erc20Abi,
  source: "manual",
  addedAt: 0,
};

/* ── fake rpc client ────────────────────────────────────── */
type FakeClient = {
  simulateContract: ReturnType<typeof vi.fn>;
  estimateContractGas: ReturnType<typeof vi.fn>;
  estimateFeesPerGas: ReturnType<typeof vi.fn>;
  getTransactionCount: ReturnType<typeof vi.fn>;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
};

function makeFakeClient(overrides?: Partial<FakeClient>): FakeClient {
  return {
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    estimateContractGas: vi.fn().mockResolvedValue(21000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
    }),
    getTransactionCount: vi.fn().mockResolvedValue(7),
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue({ status: "success", blockNumber: 99n }),
    ...overrides,
  };
}

function makeDeps(client: FakeClient): {
  rpc: RpcProvider;
  addHistory: (e: Omit<THistoryEntry, "id" | "timestamp">) => void;
} {
  return {
    rpc: {
      getClient: vi.fn().mockReturnValue(client as unknown as PublicClient),
    },
    addHistory: vi.fn(),
  };
}

function renderSection(
  client: FakeClient,
  contract: TContract = baseContract,
  q = "",
) {
  const deps = makeDeps(client);
  const utils = render(
    <ToastProvider>
      <OperationsSection contract={contract} q={q} deps={deps} />
    </ToastProvider>,
  );
  return { ...utils, deps };
}

/** Expand a write fn card by clicking its header button. */
async function expand(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const btn = await screen.findByRole("button", { name });
  await user.click(btn);
}

beforeEach(() => {
  accountStub = { address: ACCOUNT, chainId: 1, isConnected: true };
  switchChainAsync = vi.fn().mockResolvedValue(undefined);
  writeContractAsync = vi.fn().mockResolvedValue(HASH);
});

describe("OperationsSection", () => {
  it("renders EthValueInput for payable fn but not for nonpayable", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^deposit/);
    expect(screen.getByText("ETH value")).toBeInTheDocument();

    await expand(user, /^transfer/);
    // transfer is nonpayable — its card has no ETH value field.
    // Only one "ETH value" label total (from deposit).
    expect(screen.getAllByText("ETH value")).toHaveLength(1);
  });

  it("simulate success → Will succeed + Est. gas + Sign enabled", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "100");

    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));

    await screen.findByText("Will succeed");
    expect(screen.getByText("Est. gas")).toBeInTheDocument();
    expect(screen.getByText("21,000")).toBeInTheDocument();

    const sign = screen.getByRole("button", { name: /Sign & Send/ });
    expect(sign).toBeEnabled();
  });

  it("simulate revert → Will revert + reason + Sign disabled + lock note", async () => {
    const user = userEvent.setup();
    const data = encodeErrorResult({
      abi: erc20Abi,
      errorName: "InsufficientBalance",
      args: [1n, 2n],
    });
    const reverted = new ContractFunctionRevertedError({
      abi: erc20Abi,
      data,
      functionName: "transfer",
    });
    const wrapped = new BaseError("wrapper", { cause: reverted });
    renderSection(
      makeFakeClient({
        simulateContract: vi.fn().mockRejectedValue(wrapped),
      }),
    );

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "100");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));

    await screen.findByText("Will revert");
    expect(screen.getByText(/InsufficientBalance/)).toBeInTheDocument();
    expect(
      screen.getByText(/Sign blocked while revert is predicted/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign & Send/ })).toBeDisabled();
  });

  it("rpc-kind failure → inline error, no verdict", async () => {
    const user = userEvent.setup();
    renderSection(
      makeFakeClient({
        simulateContract: vi
          .fn()
          .mockRejectedValue(
            new HttpRequestError({ url: "https://x", status: 500 }),
          ),
      }),
    );

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "100");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));

    await screen.findByText(/simulation could not run/);
    expect(screen.queryByText("Will revert")).not.toBeInTheDocument();
    expect(screen.queryByText("Will succeed")).not.toBeInTheDocument();
  });

  it("editing an arg after a successful sim hides the verdict", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^transfer/);
    const toInput = screen.getByPlaceholderText(
      "0x0000000000000000000000000000000000000000",
    );
    await user.type(toInput, ACCOUNT);
    await user.type(screen.getByPlaceholderText("0"), "100");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    // Any edit invalidates the stale sim.
    await user.type(toInput, "0");
    await waitFor(() =>
      expect(screen.queryByText("Will succeed")).not.toBeInTheDocument(),
    );
  });

  it("disconnected wallet → Sign disabled with connect title", async () => {
    accountStub = {
      address: undefined,
      chainId: undefined,
      isConnected: false,
    };
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "100");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    const sign = screen.getByRole("button", { name: /Sign & Send/ });
    expect(sign).toBeDisabled();
    expect(sign).toHaveAttribute("title", "Connect a wallet to sign");
  });

  it("successful send → writeContractAsync gets parsed args+value+gas, inline confirmed", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "1");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    await user.click(screen.getByRole("button", { name: /Sign & Send/ }));

    await screen.findByText(/Confirmed in block 99/);
    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ADDR,
        functionName: "transfer",
        args: [ACCOUNT, 1n],
        gas: 21000n,
        chainId: 1,
      }),
    );
  });

  it("double-click Sign & Send → writeContractAsync once, one Sending toast", async () => {
    // writeContractAsync parks on a deferred so the first send stays in-flight
    // while the second click lands.
    let resolveWrite: (h: `0x${string}`) => void = () => {};
    writeContractAsync = vi.fn().mockReturnValue(
      new Promise<`0x${string}`>((res) => {
        resolveWrite = res;
      }),
    );
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "1");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    const sign = screen.getByRole("button", { name: /Sign & Send/ });
    // Two rapid clicks before the first send resolves.
    await user.click(sign);
    await user.click(sign);

    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Sending transfer\(\)/)).toHaveLength(1);

    // Let the in-flight send complete cleanly.
    resolveWrite(HASH);
    await screen.findByText(/Confirmed in block 99/);
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
  });

  it("payable send → writeContractAsync gets value in wei (1 ether)", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^deposit/);
    // Default unit is ether; "1" ⇒ 1000000000000000000 wei.
    await user.type(screen.getByPlaceholderText("0.0"), "1");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    await user.click(screen.getByRole("button", { name: /Sign & Send/ }));

    await screen.findByText(/Confirmed in block 99/);
    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "deposit",
        value: 1000000000000000000n,
      }),
    );
  });

  it("toggling the unit after a successful sim hides the verdict", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^deposit/);
    await user.type(screen.getByPlaceholderText("0.0"), "1");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    // Switching the unit invalidates the stale sim.
    await user.click(screen.getByRole("button", { name: "wei" }));
    await waitFor(() =>
      expect(screen.queryByText("Will succeed")).not.toBeInTheDocument(),
    );
  });

  it("download click triggers a json download named <fn>-tx.json", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const user = userEvent.setup();
    renderSection(makeFakeClient());

    await expand(user, /^transfer/);
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.type(screen.getByPlaceholderText("0"), "1");
    await user.click(screen.getByRole("button", { name: /^Simulate$/ }));
    await screen.findByText("Will succeed");

    await user.click(screen.getByRole("button", { name: /Download/ }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("transfer-tx.json");

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
