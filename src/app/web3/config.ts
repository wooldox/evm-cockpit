import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import type { Chain } from "viem";
import { SUPPORTED_VIEM_CHAINS } from "@/entities/chain/model/chains";

// RainbowKit requires a non-empty tuple: readonly [Chain, ...Chain[]]
// SUPPORTED_VIEM_CHAINS is a mutable ViemChain[] — assert it to the tuple type.
const chains = SUPPORTED_VIEM_CHAINS as unknown as readonly [Chain, ...Chain[]];

const transports = Object.fromEntries(
  chains.map((chain) => [
    chain.id,
    http(), // default public RPC
    // TODO: wire settings rpcOverrides here
  ]),
) as { [chainId: number]: ReturnType<typeof http> };

export const config = getDefaultConfig({
  appName: "EVM Cockpit",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "cc-dev-placeholder",
  chains,
  transports,
  ssr: false, // static export — client-only
});
