import { createPublicClient, defineChain, http } from 'viem';
import type { Chain, PublicClient } from 'viem';
import { SUPPORTED_VIEM_CHAINS } from '@/entities/chain/model/chains';
import { resolveRpcUrl } from '@/entities/chain/model/resolveRpcUrl';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import type { TCatalogChain } from '@/entities/chain/model/catalog';
import type { RpcProvider } from '@/shared/ports/rpc';

const CHAIN_MAP = new Map(SUPPORTED_VIEM_CHAINS.map((c) => [c.id, c]));

/** Synthesize a minimal viem Chain from a catalog entry (chains not bundled
 *  with viem). 18 decimals is the EVM default and the catalog doesn't carry
 *  precision; the symbol doubles as the currency name. */
function synthChain(entry: TCatalogChain): Chain {
  return defineChain({
    id: entry.id,
    name: entry.name,
    nativeCurrency: {
      name: entry.nativeSymbol,
      symbol: entry.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: { default: { http: entry.rpcUrls } },
    ...(entry.explorerUrl
      ? {
          blockExplorers: {
            default: { name: 'Explorer', url: entry.explorerUrl },
          },
        }
      : {}),
  });
}

export function createViemRpc(
  getOverrides: () => Record<number, string>,
): RpcProvider {
  const cache = new Map<string, PublicClient>();

  return {
    getClient(chainId: number): PublicClient {
      const viemChain = CHAIN_MAP.get(chainId);

      // Known viem chain: resolution order is override → curated default →
      // viem chain default (unchanged behavior).
      if (viemChain) {
        const url: string | undefined = resolveRpcUrl(chainId, getOverrides());
        const cacheKey = `${chainId}:${url ?? 'default'}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const client = createPublicClient({
          chain: viemChain,
          transport: http(url),
        });
        cache.set(cacheKey, client);
        return client;
      }

      // Catalog-only chain: synthesize a viem Chain from the catalog entry and
      // resolve the URL with the entry's sanitized RPCs as the last tier.
      const entry = useChainCatalog.getState().byId.get(chainId);
      if (!entry) {
        throw new Error(`unknown chain ${chainId} — not in the catalog`);
      }

      const url: string | undefined = resolveRpcUrl(
        chainId,
        getOverrides(),
        entry.rpcUrls,
      );
      if (url === undefined && entry.rpcUrls.length === 0) {
        throw new Error(`no RPC known for chain ${chainId}`);
      }

      const cacheKey = `${chainId}:${url ?? 'default'}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const client = createPublicClient({
        chain: synthChain(entry),
        transport: http(url),
      });
      cache.set(cacheKey, client);
      return client;
    },
  };
}
