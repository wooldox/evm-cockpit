import type { PublicClient } from 'viem';
/** Provides a viem public client per chain (default public RPC or user override). */
export interface RpcProvider {
  getClient(chainId: number): PublicClient;
}
