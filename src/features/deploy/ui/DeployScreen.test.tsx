import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Abi } from "abitype";
import type { PublicClient } from "viem";
import { ToastProvider } from "@/shared/ui";
import type { RpcProvider } from "@/shared/ports/rpc";
import { useContractsStore } from "@/entities/contract/model/store";
import { DeployScreen } from "./DeployScreen";

const ACCOUNT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const DEPLOYED = "0x1234567890123456789012345678901234567890" as const;
const HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

/* ── controllable wagmi stubs ───────────────────────────── */
let accountStub: { address: `0x${string}` | undefined; isConnected: boolean };
let chainIdStub: number;
let deployContractAsync: ReturnType<typeof vi.fn>;

vi.mock("wagmi", () => ({
  useAccount: () => accountStub,
  useChainId: () => chainIdStub,
  useDeployContract: () => ({ deployContractAsync }),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

/* A 2-arg constructor: (uint256, address). */
const nonPayableAbi: Abi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "supply", type: "uint256" },
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "function",
    name: "x",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

/* A payable, no-arg constructor. */
const payableAbi: Abi = [
  { type: "constructor", stateMutability: "payable", inputs: [] },
];

const BYTECODE = "0x60806040" as const;

function makeRpc(waitImpl?: () => Promise<unknown>): {
  rpc: RpcProvider;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
} {
  const waitForTransactionReceipt = vi.fn().mockImplementation(
    waitImpl ??
      (() =>
        Promise.resolve({
          status: "success",
          contractAddress: DEPLOYED,
          gasUsed: 1284902n,
        })),
  );
  const client = { waitForTransactionReceipt } as unknown as PublicClient;
  const getClient = vi.fn().mockReturnValue(client);
  return { rpc: { getClient }, waitForTransactionReceipt };
}

function renderScreen(rpc: RpcProvider) {
  return render(
    <ToastProvider>
      <DeployScreen deps={{ rpc }} />
    </ToastProvider>,
  );
}

const ABI_PH = '[ { "type": "constructor", "inputs": [...] } ]';
const BYTECODE_PH = "0x60806040…";

/**
 * Fill the ABI/bytecode textareas via fireEvent — userEvent.type treats "{" and
 * "[" as special key descriptors, which JSON breaks on.
 */
function fillArtifact(abi: string, bytecode: string): void {
  fireEvent.change(screen.getByPlaceholderText(ABI_PH), {
    target: { value: abi },
  });
  fireEvent.change(screen.getByPlaceholderText(BYTECODE_PH), {
    target: { value: bytecode },
  });
}

beforeEach(() => {
  accountStub = { address: ACCOUNT, isConnected: true };
  chainIdStub = 1;
  deployContractAsync = vi.fn().mockResolvedValue(HASH);
  pushMock.mockClear();
  useContractsStore.setState({ contracts: [] });
});

describe("DeployScreen", () => {
  it("paste valid ABI + bytecode → constructor ParamInputs appear", () => {
    renderScreen(makeRpc().rpc);

    fillArtifact(JSON.stringify(nonPayableAbi), BYTECODE);

    expect(screen.getByText("supply")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
    // nonpayable → no ETH value field.
    expect(screen.queryByText("ETH value")).not.toBeInTheDocument();
  });

  it("payable constructor → EthValueInput appears", () => {
    renderScreen(makeRpc().rpc);

    fillArtifact(JSON.stringify(payableAbi), BYTECODE);

    expect(screen.getByText("ETH value")).toBeInTheDocument();
  });

  it("bad ABI JSON → inline error, placeholder instead of inputs", () => {
    renderScreen(makeRpc().rpc);

    fillArtifact("{not json", BYTECODE);

    expect(screen.getByText("invalid JSON")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Paste an ABI and bytecode to configure the deployment.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("supply")).not.toBeInTheDocument();
  });

  it("happy deploy → parsed args, result block, Save adds to store + navigates", async () => {
    const user = userEvent.setup();
    const { waitForTransactionReceipt } = makeRpc();
    const rpc = {
      getClient: vi.fn().mockReturnValue({ waitForTransactionReceipt }),
    };
    render(
      <ToastProvider>
        <DeployScreen deps={{ rpc: rpc as unknown as RpcProvider }} />
      </ToastProvider>,
    );

    fillArtifact(JSON.stringify(nonPayableAbi), BYTECODE);

    await user.type(screen.getByPlaceholderText("0"), "1000");
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );

    await user.click(screen.getByRole("button", { name: /^Deploy$/ }));

    await screen.findByText("Deployment");
    expect(deployContractAsync).toHaveBeenCalledWith({
      abi: nonPayableAbi,
      bytecode: BYTECODE,
      args: [1000n, ACCOUNT],
      value: undefined,
    });
    expect(screen.getByText("1,284,902")).toBeInTheDocument();
    // Truncated address shows in both the result block and the success toast.
    expect(screen.getAllByText("0x123456…567890").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Save to contracts/ }));

    const contracts = useContractsStore.getState().contracts;
    expect(contracts).toHaveLength(1);
    const added = contracts[0]!;
    expect(added.name).toBe(`Deployed 0x123456…567890`);
    expect(added.chainId).toBe(1);
    expect(added.address).toBe(DEPLOYED);
    expect(added.abi).toEqual(nonPayableAbi);
    expect(pushMock).toHaveBeenCalledWith(`/?c=${added.id}`);
  });

  it("failed deploy → inline danger error, no result block", async () => {
    deployContractAsync = vi
      .fn()
      .mockRejectedValue({ shortMessage: "User rejected the request" });
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);

    fillArtifact(JSON.stringify(nonPayableAbi), BYTECODE);
    await user.type(screen.getByPlaceholderText("0"), "1000");
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );

    await user.click(screen.getByRole("button", { name: /^Deploy$/ }));

    // Appears both inline (danger text) and in the error toast.
    await waitFor(() =>
      expect(
        screen.getAllByText("User rejected the request").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Deployment")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Save to contracts/ }),
    ).not.toBeInTheDocument();
  });

  it("not connected → Deploy disabled with connect title", () => {
    accountStub = { address: undefined, isConnected: false };
    renderScreen(makeRpc().rpc);

    fillArtifact(JSON.stringify(payableAbi), BYTECODE);

    const deployBtn = screen.getByRole("button", { name: /^Deploy$/ });
    expect(deployBtn).toBeDisabled();
    expect(deployBtn).toHaveAttribute("title", "Connect a wallet to deploy");
  });

  it("file browse → ABI textarea filled, constructor inputs appear (embedded bytecode)", async () => {
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);

    const artifactObj = { abi: nonPayableAbi, bytecode: { object: "0x60aa" } };
    const file = new File([JSON.stringify(artifactObj)], "Token.json", {
      type: "application/json",
    });

    const input = screen.getByLabelText(
      "Browse for a .json artifact",
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByText("supply")).toBeInTheDocument());
    expect(screen.getByText("owner")).toBeInTheDocument();
    // ABI textarea now holds the artifact JSON.
    const abiArea = screen.getByPlaceholderText(
      '[ { "type": "constructor", "inputs": [...] } ]',
    ) as HTMLTextAreaElement;
    expect(abiArea.value).toContain('"supply"');

    // The embedded bytecode path is live: deploying succeeds.
    await user.type(screen.getByPlaceholderText("0"), "5");
    await user.type(
      screen.getByPlaceholderText("0x0000000000000000000000000000000000000000"),
      ACCOUNT,
    );
    await user.click(screen.getByRole("button", { name: /^Deploy$/ }));
    await screen.findByText("Deployment");
    expect(deployContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({ bytecode: "0x60aa" }),
    );
  });
});
