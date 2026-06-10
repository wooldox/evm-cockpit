import { SUPPORTED_VIEM_CHAINS } from './chains';
import { useChainCatalog } from './catalogStore';

/** Block-explorer base URL for a chain, or undefined when unknown/unsupported.
 *  Prefers viem's built-in explorer, then falls back to the catalog entry. */
export function explorerUrl(chainId: number): string | undefined {
  const viem = SUPPORTED_VIEM_CHAINS.find((c) => c.id === chainId)
    ?.blockExplorers?.default.url;
  if (viem) return viem;
  return useChainCatalog.getState().byId.get(chainId)?.explorerUrl;
}

/** Explorer transaction URL, or undefined when the chain has no known explorer. */
export function txUrl(chainId: number, hash: string): string | undefined {
  const base = explorerUrl(chainId);
  return base ? `${base}/tx/${hash}` : undefined;
}

/** Explorer address URL, or undefined when the chain has no known explorer. */
export function addressUrl(
  chainId: number,
  address: string,
): string | undefined {
  const base = explorerUrl(chainId);
  return base ? `${base}/address/${address}` : undefined;
}
