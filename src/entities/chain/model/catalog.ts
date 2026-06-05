import * as allViemChains from "viem/chains";
import { getCuratedMeta, CURATED_VIEM_CHAINS } from "./chains";

/**
 * The full, app-wide chain catalog. Built statically from every chain bundled
 * with viem, then optionally extended at runtime by merging the community
 * chainid.network list (see catalogStore). Curated entries from chains.ts stay
 * authoritative (name/short/color), notably the 31337 "Localhost · Anvil"
 * override.
 */
export type TCatalogChain = {
  id: number;
  name: string;
  short: string;
  color: string;
  /** Sanitized https URLs (may be empty for viem chains — the adapter falls
   *  back to viem's built-in default rpc). */
  rpcUrls: string[];
  /** Block-explorer base URL, trailing slash stripped. */
  explorerUrl?: string;
  nativeSymbol: string;
  testnet?: boolean;
  source: "viem" | "remote";
};

/** ~10 muted hues that read well on both our dark and light tokens. */
const PALETTE = [
  "#6b7682",
  "#5b8def",
  "#3aa675",
  "#c9772f",
  "#a05ad6",
  "#d05b8c",
  "#4aa6a6",
  "#b58a2f",
  "#7a86c4",
  "#c25b5b",
] as const;

/**
 * Keep ONLY https:// URLs (this is a static https host — http:// is mixed
 * content, wss:// isn't an http endpoint, and ${...} API-key templates are
 * unusable). Trim, dedupe, cap at 3.
 */
export function sanitizeRpcUrls(urls: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url.startsWith("https://")) continue;
    if (url.includes("${")) continue;
    if (out.includes(url)) continue;
    out.push(url);
    if (out.length === 3) break;
  }
  return out;
}

/** Deterministic small mixing hash → palette index (id alone is enough). */
function paletteColor(id: number): string {
  const idx = ((id * 2654435761) >>> 0) % PALETTE.length;
  // idx is always in-range; the assertion satisfies noUncheckedIndexedAccess.
  return PALETTE[idx]!;
}

/** First letters of up to 4 words, upcased. */
function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * Resolve a chain's short label + color. Curated META wins; otherwise the
 * native symbol (when a usable 2..6 chars) upcased, else the name's initials.
 * Color: curated, else a deterministic palette pick.
 */
export function genDisplay(
  id: number,
  name: string,
  symbol: string,
): { short: string; color: string } {
  const curated = getCuratedMeta(id);
  if (curated) return { short: curated.short, color: curated.color };

  const sym = symbol.trim();
  const short =
    sym.length >= 2 && sym.length <= 6 ? sym.toUpperCase() : nameInitials(name);
  return { short, color: paletteColor(id) };
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Structural shape we read off a viem chain export. */
type ViemChainLike = {
  id: number;
  name: string;
  nativeCurrency: { symbol: string };
  rpcUrls: { default: { http?: readonly string[] } };
  blockExplorers?: { default?: { url?: string } };
  testnet?: boolean;
};

function isViemChainLike(v: unknown): v is ViemChainLike {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "number") return false;
  if (typeof o.name !== "string") return false;
  const rpc = o.rpcUrls;
  if (typeof rpc !== "object" || rpc === null) return false;
  if (!("default" in rpc)) return false;
  const nc = o.nativeCurrency;
  if (typeof nc !== "object" || nc === null) return false;
  return typeof (nc as Record<string, unknown>).symbol === "string";
}

function toCatalogChain(c: ViemChainLike): TCatalogChain {
  const { short, color } = genDisplay(c.id, c.name, c.nativeCurrency.symbol);
  const explorer = c.blockExplorers?.default?.url;
  const entry: TCatalogChain = {
    id: c.id,
    name: c.name,
    short,
    color,
    rpcUrls: sanitizeRpcUrls(c.rpcUrls.default.http ?? []),
    nativeSymbol: c.nativeCurrency.symbol,
    source: "viem",
  };
  if (explorer) entry.explorerUrl = stripTrailingSlash(explorer);
  if (c.testnet === true) entry.testnet = true;
  return entry;
}

/** Curated supported ids, in chains.ts declaration order (sort leaders). */
const CURATED_IDS = CURATED_VIEM_CHAINS.map((c) => c.id);
const CURATED_RANK = new Map<number, number>(
  CURATED_IDS.map((id, i) => [id, i]),
);

function sortCatalog(a: TCatalogChain, b: TCatalogChain): number {
  const ra = CURATED_RANK.get(a.id);
  const rb = CURATED_RANK.get(b.id);
  if (ra !== undefined && rb !== undefined) return ra - rb;
  if (ra !== undefined) return -1;
  if (rb !== undefined) return 1;
  return a.name.localeCompare(b.name);
}

/**
 * Build the static catalog from every viem chain. Curated chains.ts entries
 * (CURATED_VIEM_CHAINS) take precedence on collision so the 31337 name
 * override survives. Sorted: curated ids first (declaration order), then the
 * rest alphabetically by name.
 */
export function buildStaticCatalog(): TCatalogChain[] {
  const byId = new Map<number, TCatalogChain>();

  for (const raw of Object.values(allViemChains)) {
    if (!isViemChainLike(raw)) continue;
    if (byId.has(raw.id)) continue;
    byId.set(raw.id, toCatalogChain(raw));
  }

  // Curated entries win — overwrite whatever viem produced for the same id.
  for (const c of CURATED_VIEM_CHAINS) {
    if (isViemChainLike(c)) byId.set(c.id, toCatalogChain(c));
  }

  return [...byId.values()].sort(sortCatalog);
}

export type TRemoteChain = unknown; // validated internally

type RemoteChainValid = {
  chainId: number;
  name: string;
  rpc: string[];
  explorerUrl: string;
  symbol: string;
};

function validateRemote(v: unknown): RemoteChainValid | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;

  const { chainId, name, rpc, explorers, nativeCurrency } = o;
  if (
    typeof chainId !== "number" ||
    !Number.isInteger(chainId) ||
    chainId <= 0
  ) {
    return undefined;
  }
  if (typeof name !== "string" || name.length === 0) return undefined;
  if (!Array.isArray(rpc) || rpc.length === 0) return undefined;
  if (!rpc.every((u): u is string => typeof u === "string")) return undefined;
  if (!Array.isArray(explorers) || explorers.length === 0) return undefined;

  const first = explorers[0];
  if (typeof first !== "object" || first === null) return undefined;
  const explorerUrl = (first as Record<string, unknown>).url;
  if (typeof explorerUrl !== "string" || explorerUrl.length === 0)
    return undefined;

  if (typeof nativeCurrency !== "object" || nativeCurrency === null)
    return undefined;
  const symbol = (nativeCurrency as Record<string, unknown>).symbol;
  if (typeof symbol !== "string" || symbol.length === 0) return undefined;

  return { chainId, name, rpc, explorerUrl, symbol };
}

const TESTNET_RE = /testnet|sepolia|holesky|goerli/i;

/**
 * Merge a community chainid.network list into the base catalog. Malformed
 * items are skipped silently; ids already in base are skipped; items whose rpc
 * sanitizes to empty are skipped. Remote entries are appended after base
 * (which keeps its sort contract), sorted alphabetically by name.
 */
export function mergeCatalog(
  base: TCatalogChain[],
  remote: unknown[],
): TCatalogChain[] {
  const seen = new Set(base.map((c) => c.id));
  const added: TCatalogChain[] = [];

  for (const item of remote) {
    const v = validateRemote(item);
    if (!v) continue;
    if (seen.has(v.chainId)) continue;

    const rpcUrls = sanitizeRpcUrls(v.rpc);
    if (rpcUrls.length === 0) continue;

    const { short, color } = genDisplay(v.chainId, v.name, v.symbol);
    const entry: TCatalogChain = {
      id: v.chainId,
      name: v.name,
      short,
      color,
      rpcUrls,
      explorerUrl: stripTrailingSlash(v.explorerUrl),
      nativeSymbol: v.symbol,
      source: "remote",
    };
    if (TESTNET_RE.test(v.name)) entry.testnet = true;

    seen.add(v.chainId);
    added.push(entry);
  }

  added.sort((a, b) => a.name.localeCompare(b.name));
  return [...base, ...added];
}
