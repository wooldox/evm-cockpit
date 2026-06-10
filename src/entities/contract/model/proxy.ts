import { getAddress } from 'viem';
import type { RpcProvider } from '@/shared/ports/rpc';

/** EIP-1967 implementation slot (transparent proxy / UUPS). */
const EIP1967_IMPL_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;

/** EIP-1967 beacon slot. */
const EIP1967_BEACON_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as const;

/** ABI for the beacon's `implementation()` getter. */
const IMPLEMENTATION_ABI = [
  {
    name: 'implementation',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

/** Parse the last 20 bytes of a 32-byte storage slot as a checksummed address. */
function slotToAddress(slot: `0x${string}`): `0x${string}` | null {
  // Strip leading "0x" then take the last 40 hex chars (20 bytes).
  const hex = slot.slice(2).toLowerCase();
  const addrHex = hex.slice(-40);
  if (/^0+$/.test(addrHex)) return null; // all-zero → not a proxy
  return getAddress(`0x${addrHex}`);
}

export type ProxyKind = 'eip1967' | 'beacon';

export interface ProxyResult {
  kind: ProxyKind;
  implAddress: `0x${string}`;
}

/**
 * Detect whether `address` on `chainId` is a proxy contract.
 *
 * Checks EIP-1967 implementation slot first (covers transparent + UUPS), then
 * EIP-1967 beacon slot.  All network calls go through `rpc.getClient(chainId)`
 * so callers can inject a mock in tests.
 *
 * @returns `{ kind, implAddress }` or `null` when no proxy pattern is found.
 */
export async function detectProxy(
  rpc: RpcProvider,
  chainId: number,
  address: `0x${string}`,
): Promise<ProxyResult | null> {
  const client = rpc.getClient(chainId);

  // ── 1. EIP-1967 implementation slot (UUPS / transparent proxy) ──────────
  const implSlotValue = await client.getStorageAt({
    address,
    slot: EIP1967_IMPL_SLOT,
  });

  if (implSlotValue) {
    const implAddress = slotToAddress(implSlotValue);
    if (implAddress !== null) {
      return { kind: 'eip1967', implAddress };
    }
  }

  // ── 2. EIP-1967 beacon slot ──────────────────────────────────────────────
  const beaconSlotValue = await client.getStorageAt({
    address,
    slot: EIP1967_BEACON_SLOT,
  });

  if (beaconSlotValue) {
    const beaconAddress = slotToAddress(beaconSlotValue);
    if (beaconAddress !== null) {
      // Ask the beacon contract for its current implementation.
      const implAddress = (await client.readContract({
        address: beaconAddress,
        abi: IMPLEMENTATION_ABI,
        functionName: 'implementation',
      })) as `0x${string}`;

      return { kind: 'beacon', implAddress: getAddress(implAddress) };
    }
  }

  return null;
}
