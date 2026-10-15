import type { Abi } from 'abitype';
import type { TAddress, TContract } from '@/entities/contract/model/types';
import {
  decodeShare,
  parseSharePayload,
  type TShareContract,
} from '@/shared/lib/share/codec';

const IMPORT_PREFIX = '#import=';

/** Same contract = same chain + address (case-insensitive). */
const keyOf = (c: { chainId: number; address: string }) =>
  `${c.chainId}:${c.address.toLowerCase()}`;

/** Drop repeats of the same chain+address within one payload (first wins). */
export function dedupeItems(items: TShareContract[]): TShareContract[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = keyOf(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function findSaved(
  item: TShareContract,
  contracts: TContract[],
): TContract | undefined {
  const k = keyOf(item);
  return contracts.find((c) => keyOf(c) === k);
}

export function toNewContract(item: TShareContract): TContract {
  return {
    id: crypto.randomUUID(),
    name: item.name,
    chainId: item.chainId,
    address: item.address as TAddress,
    abi: item.abi as Abi,
    source: item.source,
    proxy: item.proxy
      ? {
          kind: item.proxy.kind,
          implAddress: item.proxy.implAddress as TAddress,
          implAbi: item.proxy.implAbi as Abi | undefined,
        }
      : undefined,
    addedAt: Date.now(),
  };
}

export type TReadResult =
  | { ok: true; items: TShareContract[] }
  | { ok: false; error: string };

/**
 * Decode a `#import=<token>` location hash. Returns `null` when the hash isn't
 * an import link (nothing to do). Never adds anything — the caller shows the
 * review step.
 */
export async function readImportHash(
  hash: string,
): Promise<TReadResult | null> {
  if (!hash.startsWith(IMPORT_PREFIX)) return null;
  const raw = hash.slice(IMPORT_PREFIX.length);
  // base64url is URL-safe so decoding is normally a no-op, but some browsers
  // may percent-encode the fragment — decode defensively, falling back to raw.
  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    token = raw;
  }
  try {
    return { ok: true, items: dedupeItems(await decodeShare(token)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Parse an exported `.json` file (v1 single-contract or v2 bundle). */
export async function readShareFile(file: File): Promise<TReadResult> {
  try {
    const items = parseSharePayload(JSON.parse(await file.text()));
    return { ok: true, items: dedupeItems(items) };
  } catch {
    return { ok: false, error: 'not a valid contract export' };
  }
}
