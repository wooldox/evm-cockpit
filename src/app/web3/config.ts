import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { Chain, Transport } from 'viem';
import { SUPPORTED_VIEM_CHAINS } from '@/entities/chain/model/chains';
import { createE2EConfig } from './configE2E';
import { IS_E2E } from './e2e';
import { dynamicHttp } from './dynamicHttp';

// RainbowKit requires a non-empty tuple: readonly [Chain, ...Chain[]].
// SUPPORTED_VIEM_CHAINS is now the FULL set of viem chains (curated 7 first,
// then every other bundled chain) — wagmi/RainbowKit can switch to any of them.
// It's a mutable ViemChain[] — assert it to the tuple type.
const chains = SUPPORTED_VIEM_CHAINS as unknown as readonly [Chain, ...Chain[]];

// dynamicHttp resolves the RPC URL (settings override → curated default → viem
// chain default) lazily, when wagmi instantiates each chain's client. Overrides
// set before connecting take effect; mid-session override changes may need a
// reload for already-created clients.
const transports = Object.fromEntries(
  chains.map((chain) => [chain.id, dynamicHttp(chain.id)]),
) as { [chainId: number]: Transport };

// E2E build: swap the WalletConnect-backed getDefaultConfig for the mock-wallet
// config (see configE2E.ts), selected by the build-time IS_E2E flag.
//
// IS_E2E reads NEXT_PUBLIC_E2E, which Next inlines at build time: the E2E build
// (`build:e2e`) sets it to "1" so the mock branch is taken; a normal `next build`
// leaves it unset so this expression resolves to getDefaultConfig at runtime and
// the mock connector is never instantiated. (Turbopack does not prune the unused
// E2E branch from the bundle when the var is unset: the never-executed mock
// config call + the public Anvil test address DO appear in the production chunk
// — verified. This is acceptable: it is inert dead code referencing only public
// test constants, no secrets.)
export const config = IS_E2E
  ? createE2EConfig(chains, transports)
  : getDefaultConfig({
      appName: 'EVM Cockpit',
      projectId:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
        'cc-dev-placeholder',
      chains,
      transports,
      ssr: false, // static export — client-only
    });
