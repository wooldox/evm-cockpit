import { DEFAULT_RPC_URLS } from './chains';

/**
 * Resolve the ordered RPC fallback list for a chain: the first URL is tried
 * first, the next one when it fails (see rpcTransport).
 *
 * Order: user override (exclusive — an explicit endpoint is never silently
 * traded for a public one) → curated DEFAULT_RPC_URLS → the catalog entry's
 * sanitized RPCs (viem's own defaults, extended by chainlist.org). Override
 * values may be empty/whitespace (user cleared the field) — treated as absent.
 *
 * An empty result means "no URL known" — the caller lets viem use the chain's
 * own default rpc.
 */
export function resolveRpcUrls(
  chainId: number,
  overrides: Record<number, string>,
  catalogRpcUrls?: readonly string[],
): string[] {
  const override = overrides[chainId]?.trim();
  if (override) return [override];
  return [
    ...new Set([
      ...(DEFAULT_RPC_URLS[chainId] ?? []),
      ...(catalogRpcUrls ?? []),
    ]),
  ];
}
