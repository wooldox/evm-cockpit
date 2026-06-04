import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pad } from "viem";
import {
  ANVIL_ACCOUNTS,
  clientsFor,
  deployArtifact,
  loadArtifact,
  startAnvil,
  type AnvilHandle,
} from "./anvil";

describe("anvil harness smoke test", () => {
  let anvil: AnvilHandle;

  beforeAll(async () => {
    anvil = await startAnvil();
  });

  afterAll(async () => {
    await anvil?.stop();
  });

  it("starts a node on chain 31337", async () => {
    const { pub } = clientsFor(anvil.rpcUrl);
    expect(await pub.getChainId()).toBe(31337);
  });

  it("deploys TestToken and reads its state", async () => {
    const initialSupply = 10n ** 21n;
    const address = await deployArtifact(anvil.rpcUrl, "TestToken", [
      "Cockpit Token",
      "CKPT",
      initialSupply,
    ]);

    const { pub } = clientsFor(anvil.rpcUrl);
    const { abi } = loadArtifact("TestToken");

    const symbol = await pub.readContract({
      address,
      abi,
      functionName: "symbol",
    });
    expect(symbol).toBe("CKPT");

    const balance = await pub.readContract({
      address,
      abi,
      functionName: "balanceOf",
      args: [ANVIL_ACCOUNTS[0]],
    });
    expect(balance).toBe(initialSupply);
  });

  it("deploys CounterV1 behind SlimProxy and delegates calls", async () => {
    const impl = await deployArtifact(anvil.rpcUrl, "CounterV1");
    const proxy = await deployArtifact(anvil.rpcUrl, "SlimProxy", [impl]);

    const { pub, wallet } = clientsFor(anvil.rpcUrl);

    // EIP-1967 implementation slot should hold the impl address (padded).
    const slot =
      "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
    const stored = await pub.getStorageAt({ address: proxy, slot });
    expect(stored?.toLowerCase()).toBe(pad(impl).toLowerCase());

    // Drive CounterV1 through the proxy address using the impl ABI.
    const { abi } = loadArtifact("CounterV1");
    const incHash = await wallet.writeContract({
      address: proxy,
      abi,
      functionName: "increment",
      account: wallet.account ?? null,
      chain: null,
    });
    await pub.waitForTransactionReceipt({ hash: incHash });

    const count = await pub.readContract({
      address: proxy,
      abi,
      functionName: "count",
    });
    expect(count).toBe(1n);
  });
});
