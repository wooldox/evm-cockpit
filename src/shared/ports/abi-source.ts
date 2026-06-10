import type { Abi } from 'abitype';
export type AbiFetchResult =
  | { ok: true; abi: Abi; source: 'sourcify' | 'etherscan' }
  | { ok: false; error: string };
/** Fetches a verified ABI for an address on a chain. */
export interface AbiSource {
  fetchAbi(chainId: number, address: string): Promise<AbiFetchResult>;
}
