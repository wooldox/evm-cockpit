import type { Transport } from 'viem';
import { resolveRpcUrls } from '@/entities/chain/model/resolveRpcUrls';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import { useSettingsStore } from '@/entities/settings/model/store';
import { rpcTransport } from '@/shared/adapters/rpcTransport';

/**
 * A wagmi transport that resolves its RPC fallback list lazily (override →
 * curated default → catalog RPCs) when wagmi instantiates the chain's client,
 * and tries each URL in turn. Overrides set before connecting take effect;
 * mid-session override changes may need a reload for already-created clients.
 *
 * Extracted from config.ts so it can be tested without executing
 * getDefaultConfig (which spins up WalletConnect).
 */
export function dynamicHttp(chainId: number): Transport {
  return (params) => {
    const overrides = useSettingsStore.getState().rpcOverrides;
    const catalogUrls = useChainCatalog.getState().byId.get(chainId)?.rpcUrls;
    return rpcTransport(resolveRpcUrls(chainId, overrides, catalogUrls))(
      params,
    );
  };
}
