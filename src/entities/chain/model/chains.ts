import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  foundry,
} from "viem/chains";
import type { Chain as ViemChain } from "viem";

export type TChainDisplay = {
  id: number;
  name: string;
  short: string;
  color: string;
};

/** Curated default public RPC per supported chain (viem's built-in defaults can rot —
 *  e.g. mainnet's eth.merkle.io went dead). Settings rpcOverrides always win over these. */
export const DEFAULT_RPC_URLS: Record<number, string> = {
  1: "https://eth.drpc.org",
  8453: "https://base.drpc.org",
  42161: "https://arbitrum.drpc.org",
  10: "https://optimism.drpc.org",
  137: "https://polygon.drpc.org",
  11155111: "https://sepolia.drpc.org",
  31337: "http://127.0.0.1:8545",
};

const META: Record<number, { short: string; color: string }> = {
  1: { short: "ETH", color: "#627eea" },
  8453: { short: "BASE", color: "#0052ff" },
  42161: { short: "ARB", color: "#28a0f0" },
  10: { short: "OP", color: "#ff0420" },
  137: { short: "POL", color: "#8247e5" },
  11155111: { short: "SEP", color: "#9b6dff" },
  31337: { short: "LOC", color: "#6b7682" },
};
/** Curated short/color overrides for the supported chains, exposed for the
 *  catalog's display generator so curated entries stay authoritative. Returns
 *  undefined for non-curated ids. */
export function getCuratedMeta(
  id: number,
): { short: string; color: string } | undefined {
  return META[id];
}

const SUPPORTED: ViemChain[] = [
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  // viem's `foundry` chain omits a Multicall3 address, so `client.multicall`
  // (used by the Properties section) would throw on chain 31337. Multicall3
  // lives at the same canonical address everywhere; declare it here so batched
  // reads work on a local Anvil node once the contract is present (it is on
  // mainnet-fork nodes, and the integration harness injects it via setCode).
  {
    ...foundry,
    name: "Localhost · Anvil",
    contracts: {
      ...foundry.contracts,
      multicall3: {
        address: "0xca11bde05977b3631167028862be2a173976ca11",
      },
    },
  },
];
export const SUPPORTED_VIEM_CHAINS: ViemChain[] = SUPPORTED;
function toDisplay(c: ViemChain): TChainDisplay {
  const m = META[c.id];
  return {
    id: c.id,
    name: c.name,
    short: m?.short ?? c.nativeCurrency.symbol,
    color: m?.color ?? "#6b7682",
  };
}
export const CHAIN_LIST: TChainDisplay[] = SUPPORTED.map(toDisplay);
const BY_ID = new Map<number, TChainDisplay>(CHAIN_LIST.map((c) => [c.id, c]));
export function getChainDisplay(id: number): TChainDisplay {
  return (
    BY_ID.get(id) ?? {
      id,
      name: `Chain ${id}`,
      short: String(id),
      color: "#6b7682",
    }
  );
}
