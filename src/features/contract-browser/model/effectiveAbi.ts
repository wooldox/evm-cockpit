import type { Abi } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import { categorizeAbi } from "@/shared/lib/abi/categorize";
import type { TAbiCategories } from "@/entities/contract/model/types";

/** Proxy-aware ABI: contract's own ABI plus the implementation ABI when known. */
export function getEffectiveAbi(c: TContract): Abi {
  return c.proxy?.implAbi ? ([...c.abi, ...c.proxy.implAbi] as Abi) : c.abi;
}

export function getBrowserSections(c: TContract): TAbiCategories {
  return categorizeAbi(getEffectiveAbi(c));
}
