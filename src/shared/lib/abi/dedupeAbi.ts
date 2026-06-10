import { formatAbiItem } from 'viem/utils';
import type { Abi, AbiItem } from 'viem';

/**
 * Canonical de-dup key for an ABI item. Functions, events and errors are keyed
 * by their full signature (`formatAbiItem` expands tuples, so overloads with
 * different shapes stay distinct); constructor/fallback/receive are keyed by
 * kind alone (an ABI has at most one of each).
 */
function abiKey(item: AbiItem): string {
  if (
    item.type === 'function' ||
    item.type === 'event' ||
    item.type === 'error'
  ) {
    return `${item.type}:${formatAbiItem(item)}`;
  }
  return item.type;
}

/**
 * Remove duplicate ABI items, keeping the first occurrence of each canonical
 * signature. Merging a proxy ABI with its implementation ABI routinely yields
 * duplicates — e.g. a UUPS proxy and its impl both declare `Upgraded(address)`
 * — which otherwise surface as React key collisions in the events/functions
 * dropdowns and as ambiguous selections. First-occurrence wins, matching viem's
 * own "first match in the array" resolution for a given name/selector.
 */
export function dedupeAbi(abi: Abi): Abi {
  const seen = new Set<string>();
  const out: AbiItem[] = [];
  for (const item of abi) {
    const key = abiKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  // Referential stability: hand back the original when nothing was removed.
  return out.length === abi.length ? abi : (out as Abi);
}
