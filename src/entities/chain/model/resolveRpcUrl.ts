import { DEFAULT_RPC_URLS } from "./chains";

/**
 * Resolve the RPC URL for a chain.
 *
 * Resolution order: user override → curated DEFAULT_RPC_URLS → first sanitized
 * catalog RPC (for non-viem chains that have no built-in viem default) →
 * undefined (lets viem use the chain's own default rpc). Override values may be
 * empty/whitespace strings (user cleared the field) — treated as absent.
 *
 * `catalogRpcUrls` is only consulted for catalog-only chains, where the caller
 * (the rpc adapter) has the catalog entry's sanitized https RPCs on hand.
 */
export function resolveRpcUrl(
  chainId: number,
  overrides: Record<number, string>,
  catalogRpcUrls?: readonly string[],
): string | undefined {
  const override = overrides[chainId]?.trim();
  if (override) return override;
  const curated = DEFAULT_RPC_URLS[chainId];
  if (curated) return curated;
  if (catalogRpcUrls && catalogRpcUrls.length > 0) return catalogRpcUrls[0];
  return undefined;
}
