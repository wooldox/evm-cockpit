import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  foundry,
} from 'viem/chains';
import * as allViemChains from 'viem/chains';
import type { Chain as ViemChain } from 'viem';

export type TChainDisplay = {
  id: number;
  name: string;
  short: string;
  color: string;
};

/** Curated default public RPC per supported chain (viem's built-in defaults can rot —
 *  e.g. mainnet's eth.merkle.io went dead). Settings rpcOverrides always win over these. */
export const DEFAULT_RPC_URLS: Record<number, string> = {
  1: 'https://eth.drpc.org',
  8453: 'https://base.drpc.org',
  42161: 'https://arbitrum.drpc.org',
  10: 'https://optimism.drpc.org',
  137: 'https://polygon.drpc.org',
  11155111: 'https://sepolia.drpc.org',
  31337: 'http://127.0.0.1:8545',
};

const META: Record<number, { short: string; color: string }> = {
  1: { short: 'ETH', color: '#627eea' },
  8453: { short: 'BASE', color: '#0052ff' },
  42161: { short: 'ARB', color: '#28a0f0' },
  10: { short: 'OP', color: '#ff0420' },
  137: { short: 'POL', color: '#8247e5' },
  11155111: { short: 'SEP', color: '#9b6dff' },
  31337: { short: 'LOC', color: '#6b7682' },
};
/** Curated short/color overrides for the supported chains, exposed for the
 *  catalog's display generator so curated entries stay authoritative. Returns
 *  undefined for non-curated ids. */
export function getCuratedMeta(
  id: number,
): { short: string; color: string } | undefined {
  return META[id];
}

/** Curated chains, in priority/display order. These keep their exact object
 *  identity (notably the Localhost · Anvil multicall3 override) and win over
 *  any same-id chain bundled with viem. */
const CURATED: ViemChain[] = [
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  // viem's `foundry` chain omits a Multicall3 address, so `client.multicall`
  // (used by the Properties section) would throw on chain 31337. Multicall3
  // lives at the same canonical address everywhere; declare it here so batched
  // reads work on a local Anvil node once the contract is present (it is on
  // mainnet-fork nodes, and the integration harness injects it via setCode).
  {
    ...foundry,
    name: 'Localhost · Anvil',
    contracts: {
      ...foundry.contracts,
      multicall3: {
        address: '0xca11bde05977b3631167028862be2a173976ca11',
      },
    },
  },
];

/** The curated, app-authoritative chains (display order + the 31337 override).
 *  catalog.ts uses these as sort leaders / precedence; chains.ts derives
 *  display fallbacks from them. SUPPORTED_VIEM_CHAINS is the full superset. */
export const CURATED_VIEM_CHAINS: ViemChain[] = CURATED;

/** Minimal structural guard for a chain-shaped value from viem/chains. */
function isViemChain(v: unknown): v is ViemChain {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'number') return false;
  if (typeof o.name !== 'string') return false;
  const nc = o.nativeCurrency;
  if (typeof nc !== 'object' || nc === null) return false;
  const rpc = o.rpcUrls;
  if (typeof rpc !== 'object' || rpc === null) return false;
  // A config chain MUST carry a usable default http RPC: wagmi creates a
  // transport for every chain in the config, and viem's http(undefined) throws
  // UrlRequiredError when the chain has no default URL to fall back on
  // (viem's `arc` ships `rpcUrls.default.http: []` and crashed app startup).
  const def = (rpc as Record<string, unknown>).default;
  if (typeof def !== 'object' || def === null) return false;
  const http = (def as Record<string, unknown>).http;
  return Array.isArray(http) && typeof http[0] === 'string' && http[0] !== '';
}

/**
 * All chains wagmi/viem should know about: the curated set first (preserving
 * object identity + order), then every other structurally-valid chain bundled
 * with viem, deduped by id (curated win). Order beyond the curated head is
 * stable but otherwise unspecified.
 */
function buildSupported(): ViemChain[] {
  const out: ViemChain[] = [...CURATED];
  const seen = new Set(CURATED.map((c) => c.id));
  for (const raw of Object.values(allViemChains)) {
    if (!isViemChain(raw)) continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push(raw);
  }
  return out;
}

export const SUPPORTED_VIEM_CHAINS: ViemChain[] = buildSupported();
function toDisplay(c: ViemChain): TChainDisplay {
  const m = META[c.id];
  return {
    id: c.id,
    name: c.name,
    short: m?.short ?? c.nativeCurrency.symbol,
    color: m?.color ?? '#6b7682',
  };
}
export const CHAIN_LIST: TChainDisplay[] = CURATED.map(toDisplay);
const BY_ID = new Map<number, TChainDisplay>(CHAIN_LIST.map((c) => [c.id, c]));
export function getChainDisplay(id: number): TChainDisplay {
  return (
    BY_ID.get(id) ?? {
      id,
      name: `Chain ${id}`,
      short: String(id),
      color: '#6b7682',
    }
  );
}
