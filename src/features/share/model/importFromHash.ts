import type { Abi } from "abitype";
import type { TContract, TAddress } from "@/entities/contract/model/types";
import { decodeContractShare } from "@/shared/lib/share/codec";

const IMPORT_PREFIX = "#import=";

export type ImportResult =
  | { ok: true; contract: TContract; deduped: boolean }
  | { ok: false; error: string };

export type ImportDeps = {
  getContracts: () => TContract[];
  addContract: (c: TContract) => void;
};

/**
 * Import a contract from a `#import=<token>` location hash.
 *
 * Returns `null` when the hash carries no `#import=` prefix (not an error —
 * just nothing to do). Otherwise decodes the share token and either de-dupes
 * against an existing contract (same chainId + lowercased address) or builds a
 * fresh contract and adds it.
 */
export async function importFromHash(
  hash: string,
  deps: ImportDeps,
): Promise<ImportResult | null> {
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

  let payload;
  try {
    payload = await decodeContractShare(token);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const address = payload.address as TAddress;
  const addrLower = address.toLowerCase();

  const existing = deps
    .getContracts()
    .find(
      (c) =>
        c.chainId === payload.chainId && c.address.toLowerCase() === addrLower,
    );
  if (existing) {
    return { ok: true, contract: existing, deduped: true };
  }

  const contract: TContract = {
    id: crypto.randomUUID(),
    name: payload.name,
    chainId: payload.chainId,
    address,
    abi: payload.abi as Abi,
    source: payload.source,
    proxy: payload.proxy
      ? {
          kind: payload.proxy.kind,
          implAddress: payload.proxy.implAddress as TAddress,
          implAbi: payload.proxy.implAbi as Abi | undefined,
        }
      : undefined,
    addedAt: Date.now(),
  };
  deps.addContract(contract);
  return { ok: true, contract, deduped: false };
}
