import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Chain, Transport } from "viem";
import { SUPPORTED_VIEM_CHAINS } from "@/entities/chain/model/chains";
import { dynamicHttp } from "./dynamicHttp";

// RainbowKit requires a non-empty tuple: readonly [Chain, ...Chain[]]
// SUPPORTED_VIEM_CHAINS is a mutable ViemChain[] — assert it to the tuple type.
const chains = SUPPORTED_VIEM_CHAINS as unknown as readonly [Chain, ...Chain[]];

// dynamicHttp resolves the RPC URL (settings override → curated default → viem
// chain default) lazily, when wagmi instantiates each chain's client. Overrides
// set before connecting take effect; mid-session override changes may need a
// reload for already-created clients.
const transports = Object.fromEntries(
  chains.map((chain) => [chain.id, dynamicHttp(chain.id)]),
) as { [chainId: number]: Transport };

export const config = getDefaultConfig({
  appName: "EVM Cockpit",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "cc-dev-placeholder",
  chains,
  transports,
  ssr: false, // static export — client-only
});
