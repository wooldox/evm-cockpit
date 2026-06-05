import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import { buildStaticCatalog } from "@/entities/chain/model/catalog";

/** Reset the chain catalog store to a clean static state for tests:
 *  custom: [] + entries/byId re-derived from a fresh static catalog so
 *  duplicate checks read a known, pristine catalog. */
export function resetCatalog(): void {
  const fresh = buildStaticCatalog();
  useChainCatalog.setState({
    base: fresh,
    custom: [],
    entries: fresh,
    byId: new Map(fresh.map((c) => [c.id, c])),
    status: "static",
  });
}
