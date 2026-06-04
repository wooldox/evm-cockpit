import { DEFAULT_RPC_URLS } from "./chains";

/**
 * Resolve the RPC URL for a chain.
 *
 * Resolution order: user override → curated DEFAULT_RPC_URLS → undefined
 * (viem chain default). Override values may be empty/whitespace strings (user
 * cleared the field) — these are treated as absent and fall through.
 */
export function resolveRpcUrl(
  chainId: number,
  overrides: Record<number, string>,
): string | undefined {
  const override = overrides[chainId]?.trim();
  if (override) return override;
  return DEFAULT_RPC_URLS[chainId];
}
