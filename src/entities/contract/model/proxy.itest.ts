import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { getEffectiveAbi } from '@/features/contract-browser/model/effectiveAbi';
import { createViemRpc } from '@/shared/adapters/viem-rpc';
import {
  clientsFor,
  deployArtifact,
  loadArtifact,
  startAnvil,
  type AnvilHandle,
} from '@/test/anvil';
import { detectProxy } from './proxy';
import type { TContract } from './types';

/**
 * Real EIP-1967 proxy detection through the production `detectProxy`, which
 * reads storage via an injected `RpcProvider` (the real viem-rpc adapter). A
 * SlimProxy delegates to a CounterV1 implementation; detection must surface the
 * impl address, and the proxy-aware effective ABI must let us read/write the
 * impl methods at the proxy address.
 */
describe('detectProxy (integration)', () => {
  let anvil: AnvilHandle;
  let implAddress: `0x${string}`;
  let proxyAddress: `0x${string}`;

  beforeAll(async () => {
    anvil = await startAnvil();
    implAddress = await deployArtifact(anvil.rpcUrl, 'CounterV1');
    proxyAddress = await deployArtifact(anvil.rpcUrl, 'SlimProxy', [
      implAddress,
    ]);
  }, 30_000);

  afterAll(async () => {
    await anvil?.stop();
  });

  it('detects the EIP-1967 implementation behind the proxy', async () => {
    const rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    const result = await detectProxy(rpc, 31337, proxyAddress);

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('eip1967');
    expect(result?.implAddress.toLowerCase()).toBe(implAddress.toLowerCase());
  });

  it('returns null for a non-proxy contract', async () => {
    const rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    const result = await detectProxy(rpc, 31337, implAddress);
    expect(result).toBeNull();
  });

  it('reads and writes impl methods at the proxy via the effective ABI', async () => {
    const rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    const detected = await detectProxy(rpc, 31337, proxyAddress);
    expect(detected).not.toBeNull();

    const { abi: implAbi } = loadArtifact('CounterV1');
    const { abi: proxyAbi } = loadArtifact('SlimProxy');

    // Mirror how the app builds a proxied TContract: own (proxy) ABI plus the
    // implementation ABI captured in `proxy.implAbi`.
    const contract: TContract = {
      id: 'itest-proxy',
      name: 'Counter Proxy',
      chainId: 31337,
      address: proxyAddress,
      abi: proxyAbi,
      source: 'manual',
      addedAt: 0,
      proxy: {
        kind: 'eip1967',
        implAddress: getAddress(implAddress),
        implAbi,
      },
    };

    const effectiveAbi = getEffectiveAbi(contract);
    const fnNames = effectiveAbi
      .filter((item) => item.type === 'function')
      .map((item) => item.name);
    expect(fnNames).toContain('increment');
    expect(fnNames).toContain('count');

    const client = rpc.getClient(31337);

    // Reads through the effective ABI at the PROXY address resolve via delegate.
    const before = await client.readContract({
      address: proxyAddress,
      abi: effectiveAbi,
      functionName: 'count',
    });
    expect(before).toBe(0n);

    // Drive a state-changing impl method at the proxy address.
    const { wallet, pub } = clientsFor(anvil.rpcUrl);
    const hash = await wallet.writeContract({
      address: proxyAddress,
      abi: effectiveAbi,
      functionName: 'increment',
      account: wallet.account ?? null,
      chain: null,
    });
    await pub.waitForTransactionReceipt({ hash });

    const after = await client.readContract({
      address: proxyAddress,
      abi: effectiveAbi,
      functionName: 'count',
    });
    expect(after).toBe(1n);
  });
});
