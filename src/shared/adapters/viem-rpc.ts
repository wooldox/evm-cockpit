import { createPublicClient, http } from "viem";
import type { PublicClient } from "viem";
import { SUPPORTED_VIEM_CHAINS } from "@/entities/chain/model/chains";
import { resolveRpcUrl } from "@/entities/chain/model/resolveRpcUrl";
import type { RpcProvider } from "@/shared/ports/rpc";

const CHAIN_MAP = new Map(SUPPORTED_VIEM_CHAINS.map((c) => [c.id, c]));

export function createViemRpc(
  getOverrides: () => Record<number, string>,
): RpcProvider {
  const cache = new Map<string, PublicClient>();

  return {
    getClient(chainId: number): PublicClient {
      const chain = CHAIN_MAP.get(chainId);
      if (!chain) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      // Resolution order: settings override → curated default → viem chain default
      const url: string | undefined = resolveRpcUrl(chainId, getOverrides());
      const cacheKey = `${chainId}:${url ?? "default"}`;

      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const client = createPublicClient({
        chain,
        transport: http(url),
      });

      cache.set(cacheKey, client);
      return client;
    },
  };
}
