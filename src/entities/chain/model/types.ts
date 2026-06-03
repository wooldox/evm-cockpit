import type { TChainId } from "@/entities/contract/model/types";

export type TChainExplorer = { name: string; url: string };

export type TChain = {
  id: TChainId;
  name: string;
  rpcUrls: string[];
  explorers: TChainExplorer[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
};
