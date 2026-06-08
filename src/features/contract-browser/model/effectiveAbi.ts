import type { Abi } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import { categorizeAbi } from "@/shared/lib/abi/categorize";
import { dedupeAbi } from "@/shared/lib/abi/dedupeAbi";
import type { TAbiCategories } from "@/entities/contract/model/types";

/**
 * Proxy-aware ABI: contract's own ABI plus the implementation ABI when known,
 * de-duplicated by canonical signature. Merging a proxy with its impl routinely
 * produces duplicate items (e.g. a UUPS proxy and impl both declare
 * `Upgraded(address)`); `dedupeAbi` keeps the first occurrence so the same
 * function/event can't render twice (React key collisions) or resolve
 * ambiguously. First-occurrence wins, matching viem's own selector resolution.
 */
export function getEffectiveAbi(c: TContract): Abi {
  return dedupeAbi(
    c.proxy?.implAbi ? ([...c.abi, ...c.proxy.implAbi] as Abi) : c.abi,
  );
}

export function getBrowserSections(c: TContract): TAbiCategories {
  return categorizeAbi(getEffectiveAbi(c));
}
