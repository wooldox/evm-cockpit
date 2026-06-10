import { http } from 'wagmi';
import type { Transport } from 'viem';
import { resolveRpcUrl } from '@/entities/chain/model/resolveRpcUrl';
import { useSettingsStore } from '@/entities/settings/model/store';

/**
 * A wagmi transport that resolves its RPC URL lazily from the settings store
 * (override → curated default → viem chain default) when wagmi instantiates
 * the chain's client. Overrides set before connecting take effect; mid-session
 * override changes may need a reload for already-created clients.
 *
 * Extracted from config.ts so it can be tested without executing
 * getDefaultConfig (which spins up WalletConnect).
 */
export function dynamicHttp(chainId: number): Transport {
  return (params) => {
    const overrides = useSettingsStore.getState().rpcOverrides;
    return http(resolveRpcUrl(chainId, overrides))(params);
  };
}
