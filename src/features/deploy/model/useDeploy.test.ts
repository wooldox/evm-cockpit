import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Abi } from "abitype";
import type { PublicClient } from "viem";
import type { RpcProvider } from "@/shared/ports/rpc";

const ACCOUNT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const DEPLOYED = "0x1234567890123456789012345678901234567890" as const;
const HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

// --- module-level wagmi stubs, controlled per-test ---
let accountStub: { address: `0x${string}` | undefined; isConnected: boolean };
let chainIdStub: number;
let deployContractAsync: ReturnType<typeof vi.fn>;

vi.mock("wagmi", () => ({
  useAccount: () => accountStub,
  useChainId: () => chainIdStub,
  useDeployContract: () => ({ deployContractAsync }),
}));

import { useDeploy, type DeployState } from "./useDeploy";

// A small ABI with a non-payable constructor taking (uint256, address).
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

// A small ABI with a payable, no-arg constructor.
const payableAbi: Abi = [
  { type: "constructor", stateMutability: "payable", inputs: [] },
];

const BYTECODE = "0x60806040" as const;

function makeRpc(waitImpl?: () => Promise<unknown>): {
  rpc: RpcProvider;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
  getClient: ReturnType<typeof vi.fn>;
} {
  const waitForTransactionReceipt = vi.fn().mockImplementation(
    waitImpl ??
      (() =>
        Promise.resolve({
          status: "success",
          contractAddress: DEPLOYED,
          gasUsed: 21000n,
        })),
  );
  const client = { waitForTransactionReceipt } as unknown as PublicClient;
  const getClient = vi.fn().mockReturnValue(client);
  return { rpc: { getClient }, waitForTransactionReceipt, getClient };
}

beforeEach(() => {
  accountStub = { address: ACCOUNT, isConnected: true };
  chainIdStub = 1;
  deployContractAsync = vi.fn().mockResolvedValue(HASH);
});

describe("useDeploy — parseArtifact", () => {
  it("valid array ABI + bytecode → ready with constructorInputs", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(nonPayableAbi), BYTECODE),
    );
    expect(result.current.artifact.status).toBe("ready");
    if (result.current.artifact.status !== "ready")
      throw new Error("not ready");
    expect(result.current.artifact.artifact.bytecode).toBe(BYTECODE);
    expect(result.current.artifact.artifact.constructorInputs).toHaveLength(2);
    expect(result.current.artifact.artifact.payable).toBe(false);
  });

  it("payable constructor → payable true", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(payableAbi), BYTECODE),
    );
    if (result.current.artifact.status !== "ready")
      throw new Error("not ready");
    expect(result.current.artifact.artifact.payable).toBe(true);
    expect(result.current.artifact.artifact.constructorInputs).toHaveLength(0);
  });

  it("both empty → empty", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() => result.current.parseArtifact("  ", "\n"));
    expect(result.current.artifact.status).toBe("empty");
  });

  it("invalid JSON → abiError 'invalid JSON'", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() => result.current.parseArtifact("{not json", BYTECODE));
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.abiError).toBe("invalid JSON");
    expect(result.current.artifact.bytecodeError).toBeUndefined();
  });

  it("non-array non-artifact object → abiError", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify({ foo: 1 }), BYTECODE),
    );
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.abiError).toBe(
      "ABI must be a JSON array (or an artifact object with .abi)",
    );
  });

  it("empty array ABI → abiError 'ABI is empty'", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() => result.current.parseArtifact("[]", BYTECODE));
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.abiError).toBe("ABI is empty");
  });

  it("no-0x bytecode → bytecodeError", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(payableAbi), "deadbeef"),
    );
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.bytecodeError).toBe(
      "bytecode must be 0x-prefixed hex",
    );
  });

  it("odd-length bytecode → bytecodeError", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(payableAbi), "0x123"),
    );
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.bytecodeError).toBe(
      "bytecode must be 0x-prefixed hex",
    );
  });

  it("missing bytecode → bytecodeError 'bytecode required'", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() => result.current.parseArtifact(JSON.stringify(payableAbi), ""));
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.bytecodeError).toBe("bytecode required");
  });

  it("both bad → both errors collected", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    act(() => result.current.parseArtifact("{bad", "nothex"));
    if (result.current.artifact.status !== "invalid")
      throw new Error("not invalid");
    expect(result.current.artifact.abiError).toBe("invalid JSON");
    expect(result.current.artifact.bytecodeError).toBe(
      "bytecode must be 0x-prefixed hex",
    );
  });

  it("artifact object {abi, bytecode:{object}} + empty bytecodeRaw → ready w/ embedded", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    const artifactObj = { abi: payableAbi, bytecode: { object: "0x60aa" } };
    act(() => result.current.parseArtifact(JSON.stringify(artifactObj), ""));
    if (result.current.artifact.status !== "ready")
      throw new Error("not ready");
    expect(result.current.artifact.artifact.bytecode).toBe("0x60aa");
  });

  it("artifact object with string bytecode + empty bytecodeRaw → ready w/ embedded", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    const artifactObj = { abi: payableAbi, bytecode: "0x60bb" };
    act(() => result.current.parseArtifact(JSON.stringify(artifactObj), ""));
    if (result.current.artifact.status !== "ready")
      throw new Error("not ready");
    expect(result.current.artifact.artifact.bytecode).toBe("0x60bb");
  });

  it("explicit bytecodeRaw wins over embedded", () => {
    const { result } = renderHook(() => useDeploy({ rpc: makeRpc().rpc }));
    const artifactObj = { abi: payableAbi, bytecode: { object: "0x60aa" } };
    act(() =>
      result.current.parseArtifact(JSON.stringify(artifactObj), "0x60cc"),
    );
    if (result.current.artifact.status !== "ready")
      throw new Error("not ready");
    expect(result.current.artifact.artifact.bytecode).toBe("0x60cc");
  });

  it("re-parsing resets a prior deploy result", async () => {
    const { rpc } = makeRpc();
    const { result } = renderHook(() => useDeploy({ rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(payableAbi), BYTECODE),
    );
    await act(async () => {
      await result.current.deploy({});
    });
    expect(result.current.deployState.status).toBe("confirmed");
    act(() =>
      result.current.parseArtifact(JSON.stringify(payableAbi), BYTECODE),
    );
    expect(result.current.deployState.status).toBe("idle");
  });
});

describe("useDeploy — deploy", () => {
  function setupReady(abi: Abi = nonPayableAbi) {
    const rpcBits = makeRpc();
    const hook = renderHook(() => useDeploy({ rpc: rpcBits.rpc }));
    act(() => hook.result.current.parseArtifact(JSON.stringify(abi), BYTECODE));
    return { ...rpcBits, result: hook.result };
  }

  const GOOD_ARGS = { supply: "1000", owner: ACCOUNT };

  it("not connected → failed, nothing called", async () => {
    accountStub = { address: undefined, isConnected: false };
    const { result, getClient } = setupReady();
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy(GOOD_ARGS);
    });
    expect(resolved?.status).toBe("failed");
    if (resolved?.status !== "failed") throw new Error("not failed");
    expect(resolved.error).toBe("connect a wallet to deploy");
    expect(deployContractAsync).not.toHaveBeenCalled();
    expect(getClient).not.toHaveBeenCalled();
  });

  it("arg validation failure → argErrors set, no calls", async () => {
    const { result, getClient } = setupReady();
    await act(async () => {
      await result.current.deploy({ supply: "notanumber", owner: ACCOUNT });
    });
    expect(result.current.argErrors.supply).toBeDefined();
    expect(deployContractAsync).not.toHaveBeenCalled();
    expect(getClient).not.toHaveBeenCalled();
    expect(result.current.deployState.status).toBe("idle");
  });

  it("happy path → deployContractAsync called with parsed args, confirmed w/ address+gas", async () => {
    const { result, waitForTransactionReceipt, getClient } = setupReady();
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy(GOOD_ARGS);
    });
    expect(deployContractAsync).toHaveBeenCalledWith({
      abi: nonPayableAbi,
      bytecode: BYTECODE,
      args: [1000n, ACCOUNT],
      value: undefined,
    });
    expect(getClient).toHaveBeenCalledWith(1);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: HASH });
    expect(resolved?.status).toBe("confirmed");
    if (resolved?.status !== "confirmed") throw new Error("not confirmed");
    expect(resolved.hash).toBe(HASH);
    expect(resolved.contractAddress).toBe(DEPLOYED);
    expect(resolved.gasUsed).toBe(21000n);
    expect(result.current.deployState.status).toBe("confirmed");
  });

  it("uses wallet chainId for the receipt client", async () => {
    chainIdStub = 137;
    const { result, getClient } = setupReady();
    await act(async () => {
      await result.current.deploy(GOOD_ARGS);
    });
    expect(getClient).toHaveBeenCalledWith(137);
  });

  it("null contractAddress in receipt → failed", async () => {
    const rpcBits = makeRpc(() =>
      Promise.resolve({
        status: "success",
        contractAddress: null,
        gasUsed: 1n,
      }),
    );
    const { result } = renderHook(() => useDeploy({ rpc: rpcBits.rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(nonPayableAbi), BYTECODE),
    );
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy(GOOD_ARGS);
    });
    expect(resolved?.status).toBe("failed");
    if (resolved?.status !== "failed") throw new Error("not failed");
    expect(resolved.error).toBe("no contract address in receipt");
  });

  it("user-reject (shortMessage) → failed with that message, no receipt fetch", async () => {
    deployContractAsync = vi
      .fn()
      .mockRejectedValue({ shortMessage: "User rejected the request" });
    const { result, waitForTransactionReceipt } = setupReady();
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy(GOOD_ARGS);
    });
    expect(resolved?.status).toBe("failed");
    if (resolved?.status !== "failed") throw new Error("not failed");
    expect(resolved.error).toBe("User rejected the request");
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("reverted receipt → failed 'deployment reverted on-chain'", async () => {
    const rpcBits = makeRpc(() =>
      Promise.resolve({
        status: "reverted",
        contractAddress: null,
        gasUsed: 1n,
      }),
    );
    const { result } = renderHook(() => useDeploy({ rpc: rpcBits.rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(nonPayableAbi), BYTECODE),
    );
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy(GOOD_ARGS);
    });
    expect(resolved?.status).toBe("failed");
    if (resolved?.status !== "failed") throw new Error("not failed");
    expect(resolved.error).toBe("deployment reverted on-chain");
  });

  it("receipt fetch throws → failed with message", async () => {
    const rpcBits = makeRpc(() => Promise.reject(new Error("timeout")));
    const { result } = renderHook(() => useDeploy({ rpc: rpcBits.rpc }));
    act(() =>
      result.current.parseArtifact(JSON.stringify(nonPayableAbi), BYTECODE),
    );
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy(GOOD_ARGS);
    });
    expect(resolved?.status).toBe("failed");
    if (resolved?.status !== "failed") throw new Error("not failed");
    expect(resolved.error).toBe("timeout");
  });

  it("payable value parsed to wei", async () => {
    const { result } = setupReady(payableAbi);
    await act(async () => {
      await result.current.deploy({}, { amount: "1", unit: "ether" });
    });
    expect(deployContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({ value: 1_000_000_000_000_000_000n }),
    );
  });

  it("re-entrant deploy while first in-flight is ignored", async () => {
    let resolveDeploy: (h: `0x${string}`) => void = () => {};
    deployContractAsync = vi.fn().mockReturnValue(
      new Promise<`0x${string}`>((res) => {
        resolveDeploy = res;
      }),
    );
    const { result } = setupReady();

    let firstDeploy: Promise<DeployState> = Promise.resolve({ status: "idle" });
    act(() => {
      firstDeploy = result.current.deploy(GOOD_ARGS);
    });
    expect(result.current.deployState.status).toBe("wallet");

    await act(async () => {
      await result.current.deploy(GOOD_ARGS);
    });
    expect(deployContractAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDeploy(HASH);
      await firstDeploy;
    });
    expect(deployContractAsync).toHaveBeenCalledTimes(1);
    expect(result.current.deployState.status).toBe("confirmed");
  });

  it("deploy before artifact ready → no-op (returns idle)", async () => {
    const { rpc } = makeRpc();
    const { result } = renderHook(() => useDeploy({ rpc }));
    let resolved: DeployState | undefined;
    await act(async () => {
      resolved = await result.current.deploy({});
    });
    expect(resolved?.status).toBe("idle");
    expect(deployContractAsync).not.toHaveBeenCalled();
  });

  it("resetDeploy → idle + clears errors, keeps artifact", async () => {
    const { result } = setupReady();
    await act(async () => {
      await result.current.deploy({ supply: "bad", owner: ACCOUNT });
    });
    expect(result.current.argErrors.supply).toBeDefined();
    act(() => result.current.resetDeploy());
    expect(result.current.deployState.status).toBe("idle");
    expect(result.current.argErrors).toEqual({});
    expect(result.current.artifact.status).toBe("ready");
  });
});
