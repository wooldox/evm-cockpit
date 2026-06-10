import type { Chain, Transport } from 'viem';
import { createConfig } from 'wagmi';
import { mock } from 'wagmi/connectors';
import { ANVIL_ACCOUNT_0 } from './e2e';

/**
 * E2E-only wagmi config: a plain config whose sole connector is wagmi's `mock`.
 *
 * The mock connector's provider forwards every unhandled JSON-RPC method
 * (eth_sendTransaction + all reads) straight to the chain's static
 * rpcUrls.default.http[0] — which for Localhost · Anvil (31337) is
 * http://127.0.0.1:8545. Anvil's default accounts are unlocked, so it signs
 * server-side: no local key handling needed. defaultConnected + reconnect keep
 * the wallet connected across the e2e suite's IndexedDB-reset reload.
 *
 * Isolated in its own module so the `mock` import is only pulled in when the
 * E2E branch in config.ts references it — keeping it out of production builds.
 */
export function createE2EConfig(
  chains: readonly [Chain, ...Chain[]],
  transports: { [chainId: number]: Transport },
) {
  return createConfig({
    chains,
    transports,
    connectors: [
      mock({
        accounts: [ANVIL_ACCOUNT_0],
        features: { defaultConnected: true, reconnect: true },
      }),
    ],
    ssr: false,
  });
}
