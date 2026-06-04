import { SUPPORTED_VIEM_CHAINS } from "./chains";

/** Block-explorer base URL for a chain, or undefined when unknown/unsupported. */
export function explorerUrl(chainId: number): string | undefined {
  return SUPPORTED_VIEM_CHAINS.find((c) => c.id === chainId)?.blockExplorers
    ?.default.url;
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
