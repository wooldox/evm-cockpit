import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";
import type { Chain as ViemChain } from "viem";

export type TChainDisplay = {
  id: number;
  name: string;
  short: string;
  color: string;
};

const META: Record<number, { short: string; color: string }> = {
  1: { short: "ETH", color: "#627eea" },
  8453: { short: "BASE", color: "#0052ff" },
  42161: { short: "ARB", color: "#28a0f0" },
  10: { short: "OP", color: "#ff0420" },
  137: { short: "POL", color: "#8247e5" },
  11155111: { short: "SEP", color: "#9b6dff" },
};
const SUPPORTED: ViemChain[] = [
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
];
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
