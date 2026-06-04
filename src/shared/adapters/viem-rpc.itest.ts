import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AbiFunction } from "abitype";
import { getBrowserSections } from "@/features/contract-browser/model/effectiveAbi";
import type { TContract } from "@/entities/contract/model/types";
import {
  ANVIL_ACCOUNTS,
  deployArtifact,
  ensureMulticall3,
  loadArtifact,
  startAnvil,
  type AnvilHandle,
} from "@/test/anvil";
import { createViemRpc } from "./viem-rpc";

/**
 * Reads + multicall through the REAL viem-rpc adapter against a live Anvil
 * node, built exactly the way production does it: `createViemRpc(getOverrides)`
 * → `getClient(31337)`. Anvil's chain id (31337) is now a supported chain.
 */
describe("viem-rpc adapter (integration)", () => {
  let anvil: AnvilHandle;
  let tokenAddress: `0x${string}`;
  const INITIAL_SUPPLY = 1000n * 10n ** 18n;

  // The deployed-token contract as the app models it (effective ABI = own ABI).
  let contract: TContract;

  beforeAll(async () => {
    anvil = await startAnvil();
    // Production reads use `client.multicall`, which needs Multicall3 deployed.
    // A fresh Anvil node has no code at the canonical address, so install it.
    await ensureMulticall3(anvil.rpcUrl);

    tokenAddress = await deployArtifact(anvil.rpcUrl, "TestToken", [
      "Cockpit Token",
      "CKPT",
      INITIAL_SUPPLY,
    ]);

    const { abi } = loadArtifact("TestToken");
    contract = {
      id: "itest-token",
      name: "Cockpit Token",
      chainId: 31337,
      address: tokenAddress,
      abi,
      source: "manual",
      addedAt: 0,
    };
  }, 30_000);

  afterAll(async () => {
    await anvil?.stop();
  });

  it("multicalls no-arg properties via the adapter (like useProperties)", async () => {
    const rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    const client = rpc.getClient(31337);

    const sections = getBrowserSections(contract);
    const properties = sections.properties;

    const contracts: {
      address: `0x${string}`;
      abi: typeof contract.abi;
      functionName: string;
    }[] = properties.map((fn) => ({
      address: contract.address,
      abi: contract.abi,
      functionName: fn.name,
    }));

    const res = await client.multicall({
      contracts: contracts as Parameters<
        typeof client.multicall
      >[0]["contracts"],
      allowFailure: true,
    });

    // Every call must succeed (proves Multicall3 is present + batching works).
    for (const r of res) {
      expect((r as { status: string }).status).toBe("success");
    }

    const byName = new Map<string, unknown>(
      properties.map((fn, i) => [
        fn.name,
        (res[i] as { result: unknown }).result,
      ]),
    );

    expect(byName.get("name")).toBe("Cockpit Token");
    expect(byName.get("symbol")).toBe("CKPT");
    expect(byName.get("decimals")).toBe(18);
    expect(byName.get("totalSupply")).toBe(INITIAL_SUPPLY);
  });

  it("reads a getter (balanceOf) through the adapter client", async () => {
    const rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    const client = rpc.getClient(31337);

    const balance = await client.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "balanceOf",
      args: [ANVIL_ACCOUNTS[0]],
    });

    expect(balance).toBe(INITIAL_SUPPLY);
  });

  it("memoizes the client for the same chain + url", () => {
    const rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    const client = rpc.getClient(31337);
    expect(rpc.getClient(31337)).toBe(client);
  });

  it("categorizes the artifact ABI into the expected sections", () => {
    const sections = getBrowserSections(contract);

    expect(sections.properties.length).toBeGreaterThanOrEqual(4);
    expect(sections.getters.length).toBeGreaterThanOrEqual(2);
    expect(sections.operations.length).toBeGreaterThanOrEqual(5);

    // Both `mint` overloads must survive categorization.
    const mints = sections.operations.filter(
      (fn: AbiFunction) => fn.name === "mint",
    );
    expect(mints).toHaveLength(2);

    expect(sections.events).toHaveLength(3);
  });
});
