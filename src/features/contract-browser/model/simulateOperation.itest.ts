import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeFunctionData } from "viem";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import {
  ANVIL_ACCOUNTS,
  clientsFor,
  deployArtifact,
  loadArtifact,
  startAnvil,
  type AnvilHandle,
} from "@/test/anvil";
import { createViemRpc } from "@/shared/adapters/viem-rpc";
import { simulateOperation } from "./simulateOperation";

/**
 * Exercises {@link simulateOperation} against a live Anvil node through the REAL
 * viem-rpc adapter, plus a real `writeContract` round-trip that proves the path
 * `useSendOperation` wraps. The fixture token reverts via a custom error
 * (`InsufficientBalance`) and a plain `require` string (`"not owner"`), so we
 * assert the exact decoded-revert formats the production `decodeRevert` emits.
 */
describe("simulateOperation (integration)", () => {
  let anvil: AnvilHandle;
  const INITIAL_SUPPLY = 1000n * 10n ** 18n;

  let contract: TContract;
  let rpc: ReturnType<typeof createViemRpc>;

  // Grab an AbiFunction off the artifact ABI by name + input arity (the token
  // overloads `mint`, so arity disambiguates).
  function fnByName(name: string, inputsLength: number): AbiFunction {
    const fn = contract.abi.find(
      (e): e is AbiFunction =>
        e.type === "function" &&
        e.name === name &&
        e.inputs.length === inputsLength,
    );
    if (!fn) throw new Error(`no function ${name}/${inputsLength} in ABI`);
    return fn;
  }

  beforeAll(async () => {
    anvil = await startAnvil();
    const address = await deployArtifact(anvil.rpcUrl, "TestToken", [
      "Cockpit Token",
      "CKPT",
      INITIAL_SUPPLY,
    ]);

    const { abi } = loadArtifact("TestToken");
    rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    contract = {
      id: "t1",
      name: "Cockpit Token",
      chainId: 31337,
      address,
      abi,
      source: "manual",
      addedAt: 0,
    };
  }, 30_000);

  afterAll(async () => {
    await anvil?.stop();
  });

  it("simulates a successful transfer with gas, calldata, fees and nonce", async () => {
    const transfer = fnByName("transfer", 2);
    const args = [ANVIL_ACCOUNTS[1], 10n ** 18n] as const;

    const res = await simulateOperation(
      { rpc },
      { contract, fn: transfer, args: [...args], account: ANVIL_ACCOUNTS[0] },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.gas).toBeGreaterThan(0n);
    expect(res.data).toBe(
      encodeFunctionData({
        abi: contract.abi,
        functionName: "transfer",
        args: [...args],
      }),
    );
    // Anvil supports EIP-1559, so fees must be present and positive.
    expect(res.fees).toBeDefined();
    expect(res.fees?.maxFeePerGas).toBeGreaterThan(0n);
    expect(typeof res.nonce).toBe("number");
  });

  it("decodes a custom-error revert (InsufficientBalance) with both args", async () => {
    const transfer = fnByName("transfer", 2);
    // Transfer more than the entire supply: account0 has INITIAL_SUPPLY.
    const requested = 2000n * 10n ** 18n;

    const res = await simulateOperation(
      { rpc },
      {
        contract,
        fn: transfer,
        args: [ANVIL_ACCOUNTS[1], requested],
        account: ANVIL_ACCOUNTS[0],
      },
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe("revert");
    expect(res.message).toContain("InsufficientBalance");
    // decodeRevert renders custom-error args via String(): bigints → decimal.
    expect(res.message).toContain(requested.toString());
    expect(res.message).toContain(INITIAL_SUPPLY.toString());
  });

  it("decodes an Error(string) revert (not owner) in decodeRevert format", async () => {
    const burnFrom = fnByName("burnFrom", 2);

    const res = await simulateOperation(
      { rpc },
      {
        contract,
        fn: burnFrom,
        args: [ANVIL_ACCOUNTS[1], 1n],
        account: ANVIL_ACCOUNTS[1], // not the owner (account0 deployed)
      },
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe("revert");
    // decodeRevert formats Error(string) as: reverted: "<reason>"
    expect(res.message).toBe('reverted: "not owner"');
  });

  it("simulates without an account (eth_call from the zero address)", async () => {
    const transfer = fnByName("transfer", 2);

    const res = await simulateOperation(
      { rpc },
      {
        contract,
        fn: transfer,
        args: [ANVIL_ACCOUNTS[1], 10n ** 18n],
        account: undefined,
      },
    );

    // The zero address holds no balance, so the transfer reverts — but the key
    // point is that an account-less simulation resolves to a result at all.
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe("revert");
    expect(res.message).toContain("InsufficientBalance");
  });

  it("round-trips a REAL send: writeContract → receipt → balance increased", async () => {
    const { wallet, pub } = clientsFor(anvil.rpcUrl);
    const recipient = ANVIL_ACCOUNTS[1];
    const amount = 5n * 10n ** 18n;

    const before = (await pub.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "balanceOf",
      args: [recipient],
    })) as bigint;

    const hash = await wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "transfer",
      args: [recipient, amount],
      account: wallet.account ?? null,
      chain: null,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const after = (await pub.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "balanceOf",
      args: [recipient],
    })) as bigint;

    expect(after - before).toBe(amount);
  });
});
