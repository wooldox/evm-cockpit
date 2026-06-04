import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { PublicClient } from "viem";
import type { Abi, AbiEvent } from "abitype";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import { trunc } from "@/shared/lib/format";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { EventsSection } from "./EventsSection";

const ADDR = "0x1234567890123456789012345678901234567890" as const;
const FROM = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const TO = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const TXHASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

/* A second event so the select has options to switch between. */
const approvalEvent: AbiEvent = {
  type: "event",
  name: "Approval",
  inputs: [
    { name: "owner", type: "address", indexed: true },
    { name: "spender", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ],
  anonymous: false,
};

const abiWithTwoEvents: Abi = [...erc20Abi, approvalEvent];

/* Partially-named event: second input is unnamed → viem returns ALL args
   positionally, so fetchEventLogs normalizes to {"0":…, "1":…}. */
const partiallyNamedEvent: AbiEvent = {
  type: "event",
  name: "Foo",
  inputs: [
    { name: "owner", type: "address", indexed: false },
    { name: "", type: "uint256", indexed: false },
  ],
  anonymous: false,
};

/* Fully-unnamed event → positional args + arg0/arg1 headers. */
const unnamedEvent: AbiEvent = {
  type: "event",
  name: "Bar",
  inputs: [
    { name: "", type: "address", indexed: false },
    { name: "", type: "uint256", indexed: false },
  ],
  anonymous: false,
};

const baseContract: TContract = {
  id: "test1",
  name: "USD Coin",
  chainId: 1,
  address: ADDR,
  abi: abiWithTwoEvents,
  source: "manual",
  addedAt: 0,
};

/* Contract with no events (strip the event entries). */
const noEventsContract: TContract = {
  ...baseContract,
  abi: erc20Abi.filter((item) => item.type !== "event") as Abi,
};

const partiallyNamedContract: TContract = {
  ...baseContract,
  abi: [partiallyNamedEvent] as Abi,
};

const unnamedContract: TContract = {
  ...baseContract,
  abi: [unnamedEvent] as Abi,
};

/* ── fake rpc client ────────────────────────────────────── */
type FakeClient = {
  getLogs: ReturnType<typeof vi.fn>;
  getBlockNumber: ReturnType<typeof vi.fn>;
};

function makeFakeClient(overrides?: Partial<FakeClient>): FakeClient {
  return {
    getLogs: vi.fn().mockResolvedValue([]),
    getBlockNumber: vi.fn().mockResolvedValue(50000n),
    ...overrides,
  };
}

function makeDeps(client: FakeClient): { rpc: RpcProvider } {
  return {
    rpc: {
      getClient: vi.fn().mockReturnValue(client as unknown as PublicClient),
    },
  };
}

function renderSection(
  client: FakeClient,
  contract: TContract = baseContract,
  q = "",
) {
  const deps = makeDeps(client);
  const utils = render(<EventsSection contract={contract} q={q} deps={deps} />);
  return { ...utils, deps };
}

/** A single decoded Transfer log as viem's getLogs would return it. */
function transferLog(over?: { value?: bigint }) {
  return {
    blockNumber: 12345n,
    transactionHash: TXHASH,
    logIndex: 0,
    args: { from: FROM, to: TO, value: over?.value ?? 1000n },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EventsSection", () => {
  it("renders event signature options and the idle hint", () => {
    renderSection(makeFakeClient());

    expect(
      screen.getByText(/Pick an event and block range/i),
    ).toBeInTheDocument();

    // Both events present as <option>s with full signatures.
    expect(
      screen.getByRole("option", { name: "Transfer(address,address,uint256)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Approval(address,address,uint256)" }),
    ).toBeInTheDocument();
  });

  it("renders nothing when the contract has no events", () => {
    const { container } = renderSection(makeFakeClient(), noEventsContract);
    expect(container).toBeEmptyDOMElement();
  });

  it("happy fetch with explicit from/to → dynamic headers, decoded cells, tx link, footer", async () => {
    const user = userEvent.setup();
    const client = makeFakeClient({
      getLogs: vi.fn().mockResolvedValue([transferLog()]),
    });
    renderSection(client);

    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    // Dynamic headers from the Transfer event inputs.
    await screen.findByRole("columnheader", { name: "from" });
    expect(
      screen.getByRole("columnheader", { name: "to" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "value" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Block" }),
    ).toBeInTheDocument();

    // Block number rendered with locale formatting.
    expect(screen.getByText("12,345")).toBeInTheDocument();

    // Decoded uint arg cell.
    expect(screen.getByText("1,000")).toBeInTheDocument();

    // Tx explorer link (chainId 1 → etherscan). Address cells also render
    // explorer links, so target the tx link by its href.
    const txLink = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.includes("/tx/"));
    expect(txLink).toHaveAttribute("href", `https://etherscan.io/tx/${TXHASH}`);

    // Footer note.
    expect(screen.getByText(/1 logs · 1 RPC calls/)).toBeInTheDocument();

    // getLogs called with the explicit range.
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 100n, toBlock: 200n }),
    );
    expect(client.getBlockNumber).not.toHaveBeenCalled();
  });

  it("empty From → loadDefaultRange path resolves latest−9999 and fetches", async () => {
    const user = userEvent.setup();
    const client = makeFakeClient({
      getBlockNumber: vi.fn().mockResolvedValue(50000n),
      getLogs: vi.fn().mockResolvedValue([transferLog()]),
    });
    renderSection(client);

    // Leave From empty, To empty.
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    await screen.findByText("12,345");

    // getBlockNumber drives both the default range and the "latest" To.
    expect(client.getBlockNumber).toHaveBeenCalled();

    // From input populated with latest − 9999 = 40001.
    expect(screen.getByDisplayValue("40001")).toBeInTheDocument();

    // getLogs ran starting from the resolved default.
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 40001n }),
    );
  });

  it("error → danger text + settings hint", async () => {
    const user = userEvent.setup();
    const client = makeFakeClient({
      getLogs: vi.fn().mockRejectedValue(new Error("rpc exploded")),
    });
    renderSection(client);

    // Use a small range so bisecting bottoms out and rethrows quickly.
    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    await screen.findByText("rpc exploded");
    expect(
      screen.getByText(/set a custom RPC in Settings/i),
    ).toBeInTheDocument();
  });

  it("shows the truncated note when the result is capped", async () => {
    const user = userEvent.setup();
    // 1000+ logs in one window → truncated.
    const many = Array.from({ length: 1001 }, (_, i) => ({
      blockNumber: 12345n,
      transactionHash: TXHASH,
      logIndex: i,
      args: { from: FROM, to: TO, value: 1n },
    }));
    const client = makeFakeClient({
      getLogs: vi.fn().mockResolvedValue(many),
    });
    renderSection(client);

    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    await screen.findByText(/showing first 1000 — narrow the range/i);
  });

  it("empty done result shows the no-logs message", async () => {
    const user = userEvent.setup();
    renderSection(makeFakeClient({ getLogs: vi.fn().mockResolvedValue([]) }));

    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    await screen.findByText(/No logs in this range\./i);
  });

  it("switching the selected event resets the results table", async () => {
    const user = userEvent.setup();
    const client = makeFakeClient({
      getLogs: vi.fn().mockResolvedValue([transferLog()]),
    });
    renderSection(client);

    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));
    await screen.findByText("12,345");

    // Switch to the Approval event → table is gone, idle hint returns.
    await user.selectOptions(
      screen.getByRole("combobox"),
      "Approval(address,address,uint256)",
    );

    await waitFor(() =>
      expect(screen.queryByText("12,345")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Pick an event and block range/i),
    ).toBeInTheDocument();
  });

  it("partially-named event: positional args render in both named and arg cells", async () => {
    const user = userEvent.setup();
    // Second input unnamed → viem returns positional args; normalizeLog keys
    // them "0"/"1". The named "owner" cell must still resolve via positional.
    const client = makeFakeClient({
      getLogs: vi.fn().mockResolvedValue([
        {
          blockNumber: 12345n,
          transactionHash: TXHASH,
          logIndex: 0,
          args: { "0": FROM, "1": 5n },
        },
      ]),
    });
    renderSection(client, partiallyNamedContract);

    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    // Headers: named first input, positional fallback for the unnamed one.
    await screen.findByRole("columnheader", { name: "owner" });
    expect(
      screen.getByRole("columnheader", { name: "arg1" }),
    ).toBeInTheDocument();

    // The "owner" address cell renders (truncated) — proves positional lookup
    // works for a named input within a positionally-decoded event.
    expect(screen.getByText(trunc(FROM, 6))).toBeInTheDocument();
    // The unnamed uint cell renders its value.
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("fully-unnamed event: arg0/arg1 headers + positional cells render", async () => {
    const user = userEvent.setup();
    const client = makeFakeClient({
      getLogs: vi.fn().mockResolvedValue([
        {
          blockNumber: 12345n,
          transactionHash: TXHASH,
          logIndex: 0,
          args: { "0": FROM, "1": 7n },
        },
      ]),
    });
    renderSection(client, unnamedContract);

    await user.type(
      screen.getByPlaceholderText("auto (last 10k blocks)"),
      "100",
    );
    await user.type(screen.getByPlaceholderText("latest"), "200");
    await user.click(screen.getByRole("button", { name: /Fetch logs/i }));

    await screen.findByRole("columnheader", { name: "arg0" });
    expect(
      screen.getByRole("columnheader", { name: "arg1" }),
    ).toBeInTheDocument();

    expect(screen.getByText(trunc(FROM, 6))).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("q filter hides non-matching events but keeps the section visible", () => {
    // q="transfer" → only Transfer shows in the select; Approval filtered out.
    renderSection(makeFakeClient(), baseContract, "transfer");

    expect(
      screen.getByRole("option", { name: "Transfer(address,address,uint256)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", {
        name: "Approval(address,address,uint256)",
      }),
    ).not.toBeInTheDocument();

    // Section itself stays rendered (header + idle hint present).
    expect(screen.getByText("Events")).toBeInTheDocument();
  });
});
